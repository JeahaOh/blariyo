import { Inject, Injectable } from '@nestjs/common';
import { CollectionCleanupRepository } from './collection-cleanup.repository.js';
import { CollectionRepository } from './collection.repository.js';
import { CollectionService } from './collection.service.js';
import { CollectorLeaseRepository } from './collector-lease.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { fail } from '../../shared/errors.js';
@Injectable()
export class CollectionCleanupService {
  constructor(
    @Inject(CollectionCleanupRepository) private readonly repository: CollectionCleanupRepository,
    @Inject(CollectionRepository) private readonly collection: CollectionRepository,
    @Inject(CollectionService) private readonly service: CollectionService,
    @Inject(CollectorLeaseRepository) private readonly leases: CollectorLeaseRepository,
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async run() {
    await this.repository.expireOperationalData();
    for (const id of await this.repository.candidates())
      await this.work.lock(`collect:candidate:${id}`, () =>
        this.work.transaction(async () => {
          const candidate = await this.collection.find(id, true);
          if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
          if (candidate.status === 'PENDING' && Date.now() - +candidate.requestedAt > 86400000) {
            console.error(
              JSON.stringify({ event: 'COLLECTOR_PENDING_STALE', candidateId: Number(id) })
            );
            return;
          }
          if (candidate.status === 'RUNNING') {
            const expired = await this.leases.expireUnclaimable(id);
            for (const candidateId of expired)
              console.error(
                JSON.stringify({ event: 'LEASE_EXPIRED', candidateId: Number(candidateId) })
              );
            if (expired.length) return;
          }
          const expired = ['NEW', 'FETCH_FAILED'].includes(candidate.status)
            ? candidate.fetchedAt && Date.now() - +candidate.fetchedAt > 30 * 86400000
            : candidate.status === 'REJECTED' &&
              candidate.reviewedAt &&
              Date.now() - +candidate.reviewedAt > 30 * 86400000;
          if (expired) {
            await this.service.discardPreviewsInTransaction(id, 'system:collector');
            await this.repository.removeCandidate(id);
          } else
            for (const image of await this.repository.expiredPreviews(id)) {
              await this.outbox.enqueue({
                type: 'OBJECT_DELETE_PRIVATE',
                aggregateType: 'STORAGE_OBJECT',
                aggregateId: null,
                payload: { privateStorageKey: image.key },
                actor: 'system:collector',
              });
              await this.repository.clearPreview(image.id);
            }
        })
      );
  }
}
