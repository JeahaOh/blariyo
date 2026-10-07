import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DiscordCleanupRepository, type CleanupClaim, type CleanupResult } from '../features/collection/discord-cleanup.js';
import { DatabaseContext } from './database.js';
import { rows } from './rows.js';

@Injectable()
export class TypeOrmDiscordCleanupRepository extends DiscordCleanupRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async claim(deliveryId: string, workerId: string): Promise<CleanupClaim | null> {
    const leaseToken = randomUUID(), attemptId = randomUUID();
    const row = rows(await this.db.manager.query(`WITH changed AS (UPDATE collect.discord_review_delivery SET
      cleanup_state='RUNNING',work_kind='CLEANUP',lease_owner=$2,lease_token=$3,attempt_id=$4,
      lease_until=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp()
      WHERE id=$1 AND cleanup_state IN ('PENDING','RETRY_WAIT','RUNNING')
      AND next_attempt_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp())
      RETURNING *) SELECT * FROM changed`, [deliveryId, workerId, leaseToken, attemptId]))[0];
    if (!row) return null;
    return { deliveryId, channelId: String(row.channel_id), headMessageId: typeof row.head_message_id === 'string' ? row.head_message_id : null,
      threadId: typeof row.thread_id === 'string' ? row.thread_id : null,
      headDeleted: row.head_deleted_at !== null, threadDeleted: row.thread_deleted_at !== null, leaseToken, attemptId };
  }
  async acknowledge(claim: CleanupClaim, result: CleanupResult): Promise<boolean> {
    const changed = rows(await this.db.manager.query(`WITH changed AS (UPDATE collect.discord_review_delivery d SET
      head_deleted_at=CASE WHEN $4 THEN COALESCE(head_deleted_at,clock_timestamp()) ELSE head_deleted_at END,
      thread_deleted_at=CASE WHEN $5 THEN COALESCE(thread_deleted_at,clock_timestamp()) ELSE thread_deleted_at END,
      cleanup_failures=cleanup_failures+CASE WHEN $6::text IS NULL THEN 0 ELSE 1 END,
      notice_next_attempt_at=CASE WHEN $6::text IS NOT NULL AND cleanup_failures+1>=2 AND notice_state<>'PENDING' THEN clock_timestamp() ELSE notice_next_attempt_at END,
      notice_state=CASE WHEN $6::text IS NOT NULL AND cleanup_failures+1>=2 THEN 'PENDING' ELSE notice_state END,
      cleanup_state=CASE WHEN $7 THEN 'BLOCKED' WHEN $6::text IS NOT NULL THEN 'RETRY_WAIT'
        WHEN EXISTS(SELECT 1 FROM collect.discord_review_part p WHERE p.delivery_id=d.id AND p.send_state IN ('SENDING','UNKNOWN'))
        OR d.head_send_state IN ('SENDING','UNKNOWN') OR d.state='EXPORTING' THEN 'RETRY_WAIT' ELSE 'DONE' END,
      next_attempt_at=clock_timestamp()+make_interval(secs=>GREATEST($8::double precision/1000,
        CASE WHEN cleanup_failures=0 THEN 60 WHEN cleanup_failures=1 THEN 300 ELSE 900 END)+random()*10),
      last_error=$6,last_ack_attempt_id=$3,lease_owner=NULL,lease_token=NULL,lease_until=NULL,work_kind=NULL,
      updated_at=clock_timestamp()
      WHERE id=$1 AND lease_token=$2 AND attempt_id=$3 AND work_kind='CLEANUP'
        AND lease_until>clock_timestamp() AND last_ack_attempt_id IS DISTINCT FROM $3 RETURNING id) SELECT id FROM changed`,
    [claim.deliveryId, claim.leaseToken, claim.attemptId, result.headDeleted, result.threadDeleted,
      result.error, result.blocked, result.retryAfterMs]));
    return changed.length === 1;
  }
}
