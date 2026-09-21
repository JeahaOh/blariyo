import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { operations } from '@blariyo/contracts/collection-api';
import { CollectionRepository } from './collection.repository.js';
import { CollectorQuotaRepository } from './collector-quota.repository.js';
import { CollectorProtocolService, assertExecution } from './collector-protocol.service.js';
import { CollectorReceiptRepository } from './collector-receipt.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { collectionDigest } from './collection-url.js';
import { ApiError, fail } from '../../shared/errors.js';
export type ReservationInput =
  operations['collectorReservation']['requestBody']['content']['application/json'];
@Injectable()
export class CollectorQuotaService {
  constructor(
    @Inject(CollectionRepository) private readonly collection: CollectionRepository,
    @Inject(CollectorQuotaRepository) private readonly repository: CollectorQuotaRepository,
    @Inject(CollectorProtocolService) private readonly protocol: CollectorProtocolService,
    @Inject(CollectorReceiptRepository) private readonly receipts: CollectorReceiptRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async reserve(sourceId: string, collectorId: string, key: string, body: ReservationInput) {
    const receiptKey = this.protocol.key(collectorId, 'collectorReservation', key, {
      sourceId,
      body,
    });
    return this.work.lock(
      `collect:reservation-key:${collectorId}:${receiptKey.keyHash.toString('hex')}`,
      () =>
        this.work.transaction(async () => {
          const existing = await this.protocol.replay(receiptKey);
          let candidateId: string | null = null;
          let candidateHost: string | null = null;
          const discovery = body.discovery === true;
          if (!discovery) {
            const candidate = await this.collection.find(String(body.candidateId), true);
            if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
            assertExecution(candidate, collectorId, body.collectorExecutionId);
            if (candidate.lockVersion !== body.lockVersion) fail(409, 'CANDIDATE_VERSION_CONFLICT');
            if (!(candidate.status === 'NEW' && ['IMAGE', 'REDIRECT'].includes(body.requestKind))) {
              const current = await this.repository.clock();
              if (candidate.status !== 'RUNNING' || !candidate.leaseUntil || candidate.leaseUntil <= current.now)
                fail(409, 'CANDIDATE_LEASE_CONFLICT');
            }
            if (candidate.sourceId !== sourceId) fail(403, 'SOURCE_NOT_ALLOWED');
            candidateId = candidate.id;
            candidateHost = new URL(candidate.originUrl).hostname;
          } else if (body.candidateId !== undefined || body.lockVersion !== undefined
              || !['ROBOTS', 'LIST', 'REDIRECT'].includes(body.requestKind)) {
            fail(400, 'VALIDATION_FAILED');
          }
          const source = await this.collection.source(sourceId, true);
          if (!source?.isActive || source.robotsAllowed !== true || !source.robotsCheckedAt
              || (candidateHost !== null && candidateHost !== source.host)
              || discovery && !(await this.collection.discoveryAllowed(sourceId)))
            fail(403, 'SOURCE_NOT_ALLOWED');
          const requestKeyHash = this.protocol.keyHash(collectorId + ':' + body.requestKey);
          const requestHash = collectionDigest({ key: receiptKey.keyHash.toString('hex'), body });
          let reservation = await this.repository.reservation(sourceId, requestKeyHash);
          const clock = await this.repository.clock();
          if (reservation) {
            if (!reservation.requestHash.equals(requestHash)) fail(409, 'IDEMPOTENCY_CONFLICT');
          } else {
            const count = await this.repository.lockedBudget(sourceId, clock.day);
            if (
              count >= source.dailyFetchLimit ||
              (source.nextRequestAt && source.nextRequestAt > clock.now)
            ) {
              const limit = count >= source.dailyFetchLimit ? clock.midnight : source.nextRequestAt;
              if (!limit) throw new Error('MISSING_QUOTA_LIMIT');
              throw new ApiError(
                429,
                'SOURCE_RATE_LIMITED',
                undefined,
                Math.max(1, Math.ceil((+limit - +clock.now) / 1000))
              );
            }
            const validUntil = new Date(Math.min(+clock.now + 10000, +clock.midnight));
            reservation = {
              id: randomUUID(),
              sourceId,
              candidateId,
              collectorId,
              executionId: body.collectorExecutionId,
              jobRequestId: body.jobRequestId,
              requestKeyHash,
              requestHash,
              requestKind: body.requestKind,
              day: clock.day,
              reservedAt: clock.now,
              validUntil,
              nextAllowedAt: new Date(+validUntil + source.requestIntervalMs),
              reservedCount: count + 1,
              remainingCount: Math.max(0, source.dailyFetchLimit - count - 1),
            };
            await this.repository.saveReservation(reservation);
            await this.repository.consume(
              sourceId,
              clock.day,
              reservation.reservedCount,
              reservation.nextAllowedAt
            );
          }
          const saved = {
            reservationId: reservation.id,
            budgetDate: reservation.day,
            reservedCount: reservation.reservedCount,
            remainingCount: reservation.remainingCount,
            validUntil: reservation.validUntil.toISOString(),
            nextAllowedAt: reservation.nextAllowedAt.toISOString(),
          };
          if (!existing) await this.receipts.save(receiptKey, 201, saved);
          return { ...saved, serverNow: clock.now.toISOString() };
        })
    );
  }
}
