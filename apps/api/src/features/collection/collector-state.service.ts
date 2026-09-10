import { Inject, Injectable } from '@nestjs/common';
import {
  CollectorStateRepository,
  type CollectorEventInput,
} from './collector-state.repository.js';
import { CollectionRepository } from './collection.repository.js';
import { CollectorProtocolService, assertExecution } from './collector-protocol.service.js';
import { CollectorReceiptRepository } from './collector-receipt.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { collectionDigest } from './collection-url.js';
import { fail } from '../../shared/errors.js';
@Injectable()
export class CollectorStateService {
  constructor(
    @Inject(CollectorStateRepository) private readonly repository: CollectorStateRepository,
    @Inject(CollectionRepository) private readonly collection: CollectionRepository,
    @Inject(CollectorProtocolService) private readonly protocol: CollectorProtocolService,
    @Inject(CollectorReceiptRepository) private readonly receipts: CollectorReceiptRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async status(windowHours = 24) {
    const counts = await this.repository.candidateCounts();
    const recentErrorCounts = await this.repository.recentErrors(windowHours);
    const count = (status: string) => counts.find((row) => row.status === status)?.count ?? 0;
    return {
      asOf: new Date().toISOString(),
      windowHours,
      candidateCounts: {
        pending: count('PENDING'),
        running: count('RUNNING'),
        new: count('NEW'),
        fetchFailed: count('FETCH_FAILED'),
      },
      disabledSourceCount: await this.repository.disabledSources(),
      recentErrorCounts,
    };
  }
  executionState(candidateId: string, collectorId: string, executionId: string) {
    return this.work.transaction(async () => {
      const candidate = await this.collection.find(candidateId, true);
      if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
      assertExecution(candidate, collectorId, executionId);
      if (candidate.status === 'APPROVED' || candidate.status === 'REJECTED')
        return { candidateId: Number(candidateId), status: candidate.status, terminal: true };
      return {
        candidateId: Number(candidateId),
        status: candidate.status,
        collectorExecutionId: candidate.collectorExecutionId,
        lockVersion: candidate.lockVersion,
        leaseUntil: candidate.leaseUntil?.toISOString() ?? null,
        attemptCount: candidate.attemptCount,
        resultPayloadSha256: candidate.resultPayloadSha256?.toString('hex') ?? null,
        images:
          candidate.status === 'NEW'
            ? (await this.collection.images(candidateId)).map((image) => ({
                candidateImageId: Number(image.id),
                position: image.position,
                previewSourceSha256: image.previewSourceSha256?.toString('hex') ?? null,
                previewPath: image.previewStorageKey
                  ? `/api/v1/admin/collect/candidates/${candidateId}/images/${image.id}/preview`
                  : null,
                previewExpiresAt: image.previewExpiresAt?.toISOString() ?? null,
              }))
            : [],
      };
    });
  }
  event(collectorId: string, key: string, body: CollectorEventInput) {
    const receiptKey = this.protocol.key(collectorId, 'collectorOperationalEvent', key, body);
    return this.work.lock(
      `collect:event-key:${collectorId}:${receiptKey.keyHash.toString('hex')}`,
      () =>
        this.work.lock(`collect:event:${collectorId}:${body.deliveryId}`, () =>
          this.work.transaction(async () => {
            const previous = await this.protocol.replay(receiptKey);
            if (previous) return previous.data;
            const requestHash = collectionDigest(body);
            const existing = await this.repository.delivery(collectorId, body.deliveryId);
            if (existing && !existing.requestHash.equals(requestHash))
              fail(409, 'IDEMPOTENCY_CONFLICT');
            if (!existing && +new Date(body.occurredAt) > Date.now() + 300000)
              fail(400, 'VALIDATION_FAILED');
            const event =
              existing ?? (await this.repository.createEvent(collectorId, body, requestHash));
            const data = {
              eventId: event.id,
              acceptedAt: event.createdAt.toISOString(),
              deduplicated: existing !== null,
            };
            await this.receipts.save(receiptKey, 202, data);
            return data;
          })
        )
    );
  }
}
