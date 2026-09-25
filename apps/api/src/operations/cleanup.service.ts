import { Inject, Injectable } from '@nestjs/common';
import { CollectionCleanupService } from '../features/collection/collection-cleanup.service.js';
import { ImagesRepository } from '../features/images/images.repository.js';
import { Storage } from '../shared/storage.js';
import { UnitOfWork } from '../shared/unit-of-work.js';
import { OutboxRepository } from './outbox.repository.js';
import { CleanupRepository } from './cleanup.repository.js';
@Injectable()
export class CleanupService {
  constructor(
    @Inject(CleanupRepository) private readonly repository: CleanupRepository,
    @Inject(CollectionCleanupService) private readonly collection: CollectionCleanupService,
    @Inject(ImagesRepository) private readonly images: ImagesRepository,
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository,
    @Inject(Storage) private readonly storage: Storage,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async run() {
    let collectionAvailable = false;
    let collectionFailure: string | undefined;
    try {
      collectionAvailable = await this.repository.collectionAvailable();
    } catch {
      collectionFailure = 'COLLECTION_SCHEMA_CHECK_FAILED';
      console.error(JSON.stringify({ event: collectionFailure }));
    }
    if (collectionAvailable) {
      try {
        await this.collection.run();
      } catch {
        collectionAvailable = false;
        collectionFailure = 'COLLECTION_CLEANUP_FAILED';
        console.error(JSON.stringify({ event: collectionFailure }));
      }
    }
    const actor = 'system:outbox-worker';
    await this.work.transaction(async () => {
      for (const image of await this.repository.lockExpiredStaged()) {
        await this.images.markPrivateDelete(image.id, actor);
        await this.outbox.enqueue({
          type: 'OBJECT_DELETE_PRIVATE',
          aggregateType: 'IMAGE',
          aggregateId: image.id,
          payload: { privateStorageKey: image.privateKey },
          actor,
        });
      }
      await this.repository.expireReceipts();
    });
    for (const bucket of ['private', 'public'] as const) {
      for (const object of await this.storage.inventory(bucket)) {
        if (Date.now() - object.createdAt.getTime() < 86400000) continue;
        if (
          bucket === 'private' &&
          !object.key.startsWith('staging/') &&
          !object.key.startsWith('content/private/staging/') &&
          !object.key.startsWith('collect-preview/')
        )
          continue;
        const collectionPreview = bucket === 'private' && object.key.startsWith('collect-preview/');
        if (collectionPreview && !collectionAvailable) continue;
        const removeOrphan = async () => {
          let referenced: boolean;
          try {
            referenced = await this.repository.referenced(bucket, object.key, collectionPreview);
          } catch (error) {
            if (!collectionPreview) throw error;
            collectionAvailable = false;
            collectionFailure ??= 'COLLECTION_REFERENCE_CHECK_FAILED';
            console.error(JSON.stringify({ event: 'COLLECTION_REFERENCE_CHECK_FAILED' }));
            return;
          }
          if (!referenced) await this.storage.delete(bucket, object.key);
        };
        const postId =
          bucket === 'public' &&
          /^(?:posts|content\/published\/posts)\/(\d+)\//.exec(object.key)?.[1];
        if (postId) await this.work.lock(`post-storage:${postId}`, removeOrphan);
        else await removeOrphan();
      }
    }
    if (collectionFailure) throw new Error(collectionFailure);
  }
}
