import { Inject, Injectable } from '@nestjs/common';
import { ReviewPublicationGuard, type ReviewPublicationFence } from '../features/posts/review-publication.guard.js';
import { DatabaseContext } from './database.js';
import { requiredRow, rows } from './rows.js';
import { fail } from '../shared/errors.js';

@Injectable()
export class TypeOrmReviewPublicationGuard extends ReviewPublicationGuard {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async assertAllowed(postId: string, fence?: ReviewPublicationFence): Promise<void> {
    const ready = requiredRow(await this.db.manager.query("SELECT to_regclass('collect.batch_review_control') IS NOT NULL AS ready"));
    if (!ready.ready) {
      if (fence) fail(503,'BATCH_REVIEW_SCHEMA_REQUIRED');
      return;
    }
    const control = rows(await this.db.manager.query(`SELECT r.* FROM collect.batch_review_control r
      WHERE r.item_id IN (SELECT item_id FROM collect.batch_review_command WHERE post_id=$1) FOR UPDATE`, [postId]))[0];
    if (!control) {
      if (fence) fail(409,'BATCH_REVIEW_SUPERSEDED');
      return;
    }
    if (fence && (control.active_command_id !== fence.commandId || Number(control.decision_epoch) !== fence.epoch))
      fail(409,'BATCH_REVIEW_SUPERSEDED');
    if (!fence && control.authority !== 'ADMIN') fail(409,'BATCH_REVIEW_COMMAND_REQUIRED');
    const command = rows(await this.db.manager.query(`SELECT *,lease_until>clock_timestamp() AS leased
      FROM collect.batch_review_command WHERE id=$1`, [control.active_command_id]))[0];
    if (!command || command.action !== 'APPROVE_PUBLISH' || (typeof command.stage !== 'string' || !['DRAFTED','PUBLISHED'].includes(command.stage)))
      fail(409,'BATCH_REVIEW_SUPERSEDED');
    if (fence && (command.lease_token !== fence.leaseToken || !command.leased)) fail(409,'BATCH_REVIEW_LEASE_LOST');
    const original = rows(await this.db.manager.query(`SELECT i.version FROM collect.batch_item i
      JOIN collect.batch_retention r ON r.item_id=i.id WHERE i.id=$1 AND i.state='FETCHED'
        AND r.retention_state='LIVE' AND r.expires_at>clock_timestamp()`, [control.item_id]))[0];
    if (!original || Number(original.version) !== Number(command.item_version)) fail(409,'BATCH_ITEM_VERSION_CONFLICT');
  }
}
