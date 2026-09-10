import { Inject, Injectable } from '@nestjs/common';
import { CollectionCleanupRepository } from '../features/collection/collection-cleanup.repository.js';
import { DatabaseContext } from './database.js';
import { requiredRow } from './rows.js';
import {
  CollectCandidateEntity,
  CollectCandidateImageEntity,
  CollectCollectorReceiptEntity,
  CollectCollectorOperationalEventEntity,
  CollectSourceRequestBudgetEntity,
  CollectSourceRequestReservationEntity,
} from './entities.js';
@Injectable()
export class TypeOrmCollectionCleanupRepository extends CollectionCleanupRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async expireOperationalData() {
    if (
      requiredRow(
        await this.db.manager.query(
          "SELECT to_regclass('collect.collector_receipt') IS NOT NULL AS ready"
        )
      ).ready !== true
    )
      return;
    await this.db.manager
      .createQueryBuilder()
      .delete()
      .from(CollectCollectorReceiptEntity)
      .where('expires_at<=now()')
      .execute();
    await this.db.manager
      .createQueryBuilder()
      .delete()
      .from(CollectSourceRequestReservationEntity)
      .where("reserved_at<now()-interval '30 days'")
      .execute();
    await this.db.manager
      .createQueryBuilder()
      .delete()
      .from(CollectSourceRequestBudgetEntity)
      .where("budget_date<(now() AT TIME ZONE 'Asia/Seoul')::date-30")
      .execute();
    await this.db.manager
      .createQueryBuilder()
      .delete()
      .from(CollectCollectorOperationalEventEntity)
      .where("created_at<now()-interval '30 days'")
      .execute();
  }
  async candidates() {
    return (
      await this.db.manager
        .createQueryBuilder(CollectCandidateEntity, 'c')
        .select('c.id')
        .where("c.status='PENDING' AND c.requested_at<=now()-interval '24 hours'")
        .orWhere(
          "c.status='RUNNING' AND c.lease_until<now() AND (c.attempt_count>=3 OR c.requested_at<=now()-interval '24 hours')"
        )
        .orWhere("c.status IN ('NEW','FETCH_FAILED') AND c.fetched_at<now()-interval '30 days'")
        .orWhere("c.status='REJECTED' AND c.reviewed_at<now()-interval '30 days'")
        .orWhere(
          'EXISTS(SELECT 1 FROM collect.candidate_image i WHERE i.candidate_id=c.id AND i.preview_expires_at<now())'
        )
        .getMany()
    ).map((row) => row.id);
  }
  async expiredPreviews(candidateId: string) {
    return (
      await this.db.manager
        .createQueryBuilder(CollectCandidateImageEntity, 'i')
        .where('i.candidate_id=:candidateId AND i.preview_expires_at<now()', { candidateId })
        .getMany()
    ).map((row) => {
      if (!row.preview_storage_key) throw new Error('MISSING_EXPIRED_PREVIEW_KEY');
      return { id: row.id, key: row.preview_storage_key };
    });
  }
  async clearPreview(imageId: string) {
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateImageEntity)
      .set({
        preview_storage_key: null,
        preview_expires_at: null,
        updated_by: 'system:collector',
        updated_at: () => 'now()',
      })
      .where('id=:imageId', { imageId })
      .execute();
  }
  async removeCandidate(candidateId: string) {
    await this.db.manager.delete(CollectCandidateImageEntity, { candidate_id: candidateId });
    await this.db.manager.delete(CollectCandidateEntity, { id: candidateId });
  }
}
