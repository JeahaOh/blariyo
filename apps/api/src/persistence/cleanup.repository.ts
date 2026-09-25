import { Inject, Injectable } from '@nestjs/common';
import { CleanupRepository } from '../operations/cleanup.repository.js';
import type { Bucket } from '../shared/storage.js';
import { DatabaseContext } from './database.js';
import { requiredRow } from './rows.js';
import {
  CollectCandidateImageEntity,
  ContentBoardPostImageEntity,
  OpsIdempotencyRequestEntity,
  OpsOutboxTaskEntity,
} from './entities.js';
@Injectable()
export class TypeOrmCleanupRepository extends CleanupRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async collectionAvailable() {
    const result: unknown = await this.db.manager.query(
      "SELECT to_regclass('collect.candidate_image')::text AS relation"
    );
    const row = requiredRow(result);
    if (row.relation !== null && typeof row.relation !== 'string')
      throw new Error('INVALID_COLLECTION_SCHEMA_RESULT');
    return row.relation !== null;
  }
  async lockExpiredStaged() {
    return (
      await this.db.manager
        .createQueryBuilder(ContentBoardPostImageEntity, 'image')
        .where(
          "image.post_id IS NULL AND image.status='STAGED' AND image.updated_at<now()-interval '24 hours'"
        )
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany()
    ).map((image) => ({ id: image.id, privateKey: image.private_storage_key }));
  }
  async expireReceipts() {
    await this.db.manager
      .createQueryBuilder()
      .delete()
      .from(OpsIdempotencyRequestEntity)
      .where('expires_at<now()')
      .execute();
  }
  async referenced(bucket: Bucket, key: string, collectionPreview: boolean) {
    const image = collectionPreview
      ? this.db.manager
          .createQueryBuilder(CollectCandidateImageEntity, 'image')
          .where('image.preview_storage_key=:key', { key })
      : this.db.manager
          .createQueryBuilder(ContentBoardPostImageEntity, 'image')
          .where(
            `image.${bucket === 'private' ? 'private_storage_key' : 'public_storage_key'}=:key AND image.status<>'DELETED'`,
            { key }
          );
    if (await image.getExists()) return true;
    return this.db.manager
      .createQueryBuilder(OpsOutboxTaskEntity, 'task')
      .where("task.status IN ('PENDING','RUNNING','FAILED','DEAD')")
      .andWhere(
        collectionPreview
          ? "task.payload->>'privateStorageKey'=:key"
          : "(task.payload->>'privateStorageKey'=:key OR task.payload->>'publicStorageKey'=:key)",
        { key }
      )
      .getExists();
  }
}
