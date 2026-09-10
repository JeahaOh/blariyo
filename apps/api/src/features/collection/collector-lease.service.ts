import { Inject, Injectable } from '@nestjs/common';
import { CollectorLeaseRepository } from './collector-lease.repository.js';
import { CollectionRepository } from './collection.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { fail, validId } from '../../shared/errors.js';
import type { SourceRecord } from './collection.model.js';
export interface ClaimInput {
  collectorId: string;
  maxItems: number;
  leaseSeconds: number;
  candidateId?: number;
}
export interface HeartbeatInput {
  collectorId: string;
  lockVersion: number;
  leaseSeconds: number;
}
export interface ClaimedCandidate {
  candidateId: string;
  originUrl: string;
  discoveryMode: 'MANUAL_URL';
  source: SourceRecord;
  attemptCount: number;
  lockVersion: number;
  leaseUntil: Date;
  collectorExecutionId?: string;
}
@Injectable()
export class CollectorLeaseService {
  constructor(
    @Inject(CollectorLeaseRepository) private readonly leases: CollectorLeaseRepository,
    @Inject(CollectionRepository) private readonly collection: CollectionRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async claim(body: ClaimInput, executionId?: string): Promise<ClaimedCandidate[]> {
    if (body.candidateId && body.maxItems !== 1) fail(400, 'VALIDATION_FAILED');
    return this.work.transaction(async () => {
      const id = body.candidateId ? String(body.candidateId) : null;
      for (const expiredId of await this.leases.expireUnclaimable(id))
        console.error(JSON.stringify({ event: 'LEASE_EXPIRED', candidateId: Number(expiredId) }));
      const candidates = await this.leases.claimable(id, body.maxItems);
      const sources = new Map(
        (await this.collection.sourcesByIds(candidates.map((candidate) => candidate.sourceId))).map(
          (source) => [source.id, source]
        )
      );
      const items: ClaimedCandidate[] = [];
      for (const candidate of candidates) {
        const source = sources.get(candidate.sourceId);
        if (!source) fail(404, 'SOURCE_NOT_FOUND');
        const lease = await this.leases.claim(
          candidate.id,
          body.collectorId,
          body.leaseSeconds,
          executionId
        );
        items.push({
          candidateId: candidate.id,
          originUrl: candidate.originUrl,
          discoveryMode: candidate.discoveryMode,
          source,
          ...lease,
          ...(executionId === undefined ? {} : { collectorExecutionId: executionId }),
        });
      }
      return items;
    });
  }
  async heartbeat(candidateId: string, body: HeartbeatInput, executionId?: string) {
    if (!validId(candidateId)) fail(404, 'CANDIDATE_NOT_FOUND');
    return this.work.transaction(async () => {
      const candidate = await this.collection.find(candidateId, true);
      if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
      if (
        executionId !== undefined &&
        (candidate.collectorId !== body.collectorId ||
          candidate.collectorExecutionId !== executionId.toLowerCase())
      )
        fail(409, 'CANDIDATE_EXECUTION_CONFLICT');
      if (
        candidate.status !== 'RUNNING' ||
        candidate.collectorId !== body.collectorId ||
        candidate.lockVersion !== body.lockVersion ||
        !candidate.leaseUntil ||
        candidate.leaseUntil <= new Date()
      )
        fail(409, 'CANDIDATE_LEASE_CONFLICT');
      const lease = await this.leases.heartbeat(
        candidateId,
        body.leaseSeconds,
        executionId !== undefined
      );
      const source = await this.collection.source(candidate.sourceId);
      if (!source) fail(404, 'SOURCE_NOT_FOUND');
      return { candidateId, ...lease, source };
    });
  }
}
