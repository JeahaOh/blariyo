import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ReviewCommandRepository, type AcceptReviewCommand, type ReviewCommandRecord, type ReviewCommandStage } from '../features/collection/review-command.repository.js';
import { DatabaseContext } from './database.js';
import { rows, requiredRow } from './rows.js';
import { fail } from '../shared/errors.js';

const terminal = new Set<ReviewCommandStage>(['PUBLISHED','REJECTED','CANCELLED','NEEDS_ADMIN','FAILED']);
const transitions: Record<ReviewCommandStage, ReviewCommandStage[]> = {
  ACCEPTED: ['APPROVED','REJECTED','NEEDS_ADMIN','FAILED'],
  APPROVED: ['PREPARING','DRAFTED','NEEDS_ADMIN','FAILED'],
  PREPARING: ['DRAFTED','NEEDS_ADMIN','FAILED'],
  DRAFTED: ['PUBLISHED','NEEDS_ADMIN','FAILED'],
  PUBLISHED: [], REJECTED: [], CANCELLED: [], NEEDS_ADMIN: [], FAILED: [],
};
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((entry: unknown) => typeof entry === 'string')) throw new Error('REVIEW_RECORD_INVALID');
  return value.filter((entry): entry is string => typeof entry === 'string');
}
function record(row: Record<string, unknown>): ReviewCommandRecord {
  const origin = row.origin, action = row.action, stage = row.stage;
  if ((origin !== 'ADMIN' && origin !== 'DISCORD' && origin !== 'SYSTEM' && origin !== 'AUTO') ||
    (action !== 'APPROVE_PUBLISH' && action !== 'REJECT') || typeof stage !== 'string' || !Object.hasOwn(transitions, stage) ||
    !Buffer.isBuffer(row.content_digest) || !Buffer.isBuffer(row.selection_digest)) throw new Error('REVIEW_RECORD_INVALID');
  // Narrow through a runtime-validated list instead of trusting arbitrary database JSON.
  const validStage = Object.keys(transitions).find((value): value is ReviewCommandStage => value === stage);
  if (!validStage) throw new Error('REVIEW_RECORD_INVALID');
  return { id: String(row.id), itemId: String(row.item_id), origin, action, actor: String(row.actor),
    operatorId: typeof row.operator_id === 'string' ? row.operator_id : null, reviewerIds: strings(row.reviewer_ids),
    epoch: Number(row.decision_epoch), itemVersion: Number(row.item_version), reviewVersion: Number(row.review_version),
    contentDigest: row.content_digest.toString('hex'), selectionDigest: row.selection_digest.toString('hex'),
    excludedUnitIds: strings(row.excluded_unit_ids), requestBody: requiredRow([row.request_body]), stage: validStage,
    postId: row.post_id === null ? null : Number(row.post_id), postVersion: row.post_version === null ? null : Number(row.post_version),
    leaseToken: typeof row.lease_token === 'string' ? row.lease_token : null, finished: row.finished_at !== null };
}

@Injectable()
export class TypeOrmReviewCommandRepository extends ReviewCommandRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async accept(input: AcceptReviewCommand) {
    // Lock a request key before item authority, including retries that change the item.
    await this.db.manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`review-command:${input.actor}:${input.requestKey}`]);
    const replay = rows(await this.db.manager.query('SELECT * FROM collect.batch_review_command WHERE actor=$1 AND request_key=$2', [input.actor,input.requestKey]))[0];
    if (replay) {
      if (!Buffer.isBuffer(replay.request_hash) || replay.request_hash.toString('hex') !== input.requestHash) fail(409,'IDEMPOTENCY_CONFLICT');
      return { command: record(replay), created: false, preemptedDiscordReviewVersion: null };
    }
    await this.db.manager.query('INSERT INTO collect.batch_review_control(item_id) VALUES($1) ON CONFLICT DO NOTHING', [input.itemId]);
    const control = requiredRow(await this.db.manager.query('SELECT * FROM collect.batch_review_control WHERE item_id=$1 FOR UPDATE', [input.itemId]));
    const previous = typeof control.active_command_id === 'string' ? await this.find(control.active_command_id) : null;
    if (input.origin === 'AUTO' && rows(await this.db.manager.query('SELECT 1 FROM collect.discord_review_delivery WHERE item_id=$1',[input.itemId])).length) fail(409,'BATCH_REVIEW_SUPERSEDED');
    if (input.origin === 'AUTO' && (previous || control.authority === 'ADMIN' || input.reviewVersion !== 0)) fail(409,'BATCH_REVIEW_SUPERSEDED');
    if (input.origin !== 'ADMIN' && (control.authority === 'ADMIN' || Number(control.decision_epoch) !== input.expectedEpoch))
      fail(409,'BATCH_REVIEW_SUPERSEDED');
    if (input.origin !== 'ADMIN' && typeof control.active_command_id === 'string') {
      const current = await this.find(control.active_command_id);
      if (current && !current.finished) fail(409,'IDEMPOTENCY_IN_PROGRESS');
    }
    if (input.origin === 'ADMIN') await this.db.manager.query(`UPDATE collect.batch_review_command SET
      stage='CANCELLED',finished_at=clock_timestamp(),updated_at=clock_timestamp(),lease_owner=NULL,lease_token=NULL,lease_until=NULL
      WHERE item_id=$1 AND finished_at IS NULL`, [input.itemId]);
    const epoch = Number(control.decision_epoch)+1, id = randomUUID();
    const result = record(requiredRow(await this.db.manager.query(`INSERT INTO collect.batch_review_command
      (id,item_id,origin,action,actor,operator_id,reviewer_ids,decision_epoch,item_version,review_version,content_digest,selection_digest,
       excluded_unit_ids,evidence,request_body,request_key,request_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,decode($11,'hex'),decode($12,'hex'),$13,$14,$15,$16,decode($17,'hex')) RETURNING *`,
    [id,input.itemId,input.origin,input.action,input.actor,input.operatorId,JSON.stringify(input.reviewerIds),epoch,input.itemVersion,input.reviewVersion,
      input.contentDigest,input.selectionDigest,JSON.stringify(input.excludedUnitIds),JSON.stringify(input.evidence),JSON.stringify(input.requestBody),input.requestKey,input.requestHash])));
    await this.db.manager.query(`UPDATE collect.batch_review_control SET authority=$2,decision_epoch=$3,active_command_id=$4,
      updated_at=clock_timestamp() WHERE item_id=$1`, [input.itemId,input.origin,epoch,id]);
    return { command: result, created: true,
      preemptedDiscordReviewVersion: previous && ['DISCORD','AUTO'].includes(previous.origin) ? previous.reviewVersion : null };
  }
  async replay(actor: string, key: string, hash: string) {
    const row = rows(await this.db.manager.query('SELECT * FROM collect.batch_review_command WHERE actor=$1 AND request_key=$2',[actor,key]))[0];
    if (!row) return null;
    if (!Buffer.isBuffer(row.request_hash) || row.request_hash.toString('hex') !== hash) fail(409,'IDEMPOTENCY_CONFLICT');
    return record(row);
  }
  async find(id: string) {
    const row = rows(await this.db.manager.query('SELECT * FROM collect.batch_review_command WHERE id=$1', [id]))[0];
    return row ? record(row) : null;
  }
  async claim(id: string, workerId: string) {
    const lease = randomUUID();
    const row = rows(await this.db.manager.query(`WITH changed AS (UPDATE collect.batch_review_command c SET
      lease_owner=$2,lease_token=$3,lease_until=clock_timestamp()+interval '180 seconds',updated_at=clock_timestamp()
      FROM collect.batch_review_control r WHERE c.id=$1 AND r.item_id=c.item_id AND r.active_command_id=c.id
        AND r.decision_epoch=c.decision_epoch AND c.finished_at IS NULL AND c.next_attempt_at<=clock_timestamp()
        AND (c.lease_until IS NULL OR c.lease_until<clock_timestamp()) RETURNING c.*) SELECT * FROM changed`, [id,workerId,lease]))[0];
    return row ? record(row) : null;
  }
  async assertActive(id: string, epoch: number, leaseToken: string) {
    const command = await this.find(id);
    if (!command) fail(404,'BATCH_REVIEW_COMMAND_NOT_FOUND');
    const control = rows(await this.db.manager.query('SELECT * FROM collect.batch_review_control WHERE item_id=$1 FOR UPDATE', [command.itemId]))[0];
    if (!control || control.active_command_id !== id || Number(control.decision_epoch) !== epoch) fail(409,'BATCH_REVIEW_SUPERSEDED');
    const current = rows(await this.db.manager.query(`SELECT * FROM collect.batch_review_command WHERE id=$1
      AND decision_epoch=$2 AND lease_token=$3 AND lease_until>clock_timestamp() AND finished_at IS NULL FOR UPDATE`, [id,epoch,leaseToken]))[0];
    if (!current) fail(409,'BATCH_REVIEW_LEASE_LOST');
    return record(current);
  }
  async progress(id: string, epoch: number, leaseToken: string, expected: ReviewCommandStage,
    stage: ReviewCommandStage, post?: { id: number; version: number }, reviewVersion?: number, safeCode?: string) {
    if (safeCode !== undefined && !/^[A-Z][A-Z0-9_]{0,79}$/.test(safeCode)) throw new Error('REVIEW_ERROR_CODE_INVALID');
    const current = await this.assertActive(id,epoch,leaseToken);
    if (current.stage !== expected || !transitions[expected].includes(stage)) fail(409,'BATCH_REVIEW_STAGE_CONFLICT');
    return record(requiredRow(await this.db.manager.query(`WITH changed AS (UPDATE collect.batch_review_command SET
      stage=$2,post_id=COALESCE($3,post_id),post_version=COALESCE($4,post_version),review_version=COALESCE($6,review_version),
      finished_at=CASE WHEN $5 THEN clock_timestamp() ELSE NULL END,
      lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp(),last_error=$7
      WHERE id=$1 RETURNING *) SELECT * FROM changed`, [id,stage,post?.id ?? null,post?.version ?? null,terminal.has(stage),reviewVersion ?? null,safeCode ?? null])));
  }
  async retry(id: string, epoch: number, leaseToken: string, safeCode: string) {
    if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(safeCode)) throw new Error('REVIEW_ERROR_CODE_INVALID');
    await this.assertActive(id,epoch,leaseToken);
    await this.db.manager.query(`UPDATE collect.batch_review_command SET retry_count=retry_count+1,last_error=$2,
      next_attempt_at=clock_timestamp()+interval '1 minute',lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1`, [id,safeCode]);
  }
  async enqueueCleanup(itemId: string): Promise<string[]> {
    return rows(await this.db.manager.query(`WITH changed AS (UPDATE collect.discord_review_delivery SET
      state='CANCELLED',generation=generation+1,
      lease_token=CASE WHEN work_kind='EXPORT' THEN NULL ELSE lease_token END,
      lease_owner=CASE WHEN work_kind='EXPORT' THEN NULL ELSE lease_owner END,
      lease_until=CASE WHEN work_kind='EXPORT' THEN NULL ELSE lease_until END,
      work_kind=CASE WHEN work_kind='EXPORT' THEN NULL ELSE work_kind END,
      cleanup_state=CASE WHEN cleanup_state IN ('NONE','DONE') THEN 'PENDING' ELSE cleanup_state END,
      next_attempt_at=CASE WHEN cleanup_state IN ('NONE','DONE') THEN clock_timestamp() ELSE next_attempt_at END,updated_at=clock_timestamp()
      WHERE item_id=$1 AND state<>'CLOSED' RETURNING id) SELECT id FROM changed`, [itemId])).map(row => String(row.id));
  }
}
