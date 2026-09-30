import { Inject, Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { BatchResultRepository, type BatchResultRow } from '../features/collection/batch-result.repository.js';
import { DatabaseContext } from './database.js';
import { rows } from './rows.js';
import { fail } from '../shared/errors.js';

export const retentionColumns = `l.collected_at,l.review_finalized_at,l.expires_at,l.retention_state,
  EXTRACT(EPOCH FROM l.expires_at-clock_timestamp())*1000 AS remaining_ms`;
const text = (value: unknown): string | null => typeof value === 'string' ? value : null;
const timestamp = (value: unknown): string => {
  if (!(value instanceof Date)) throw Error('BATCH_RETENTION_INVALID');
  return value.toISOString();
};
export function batchResult(row: Record<string, unknown>, requestStarted: number): BatchResultRow {
  const state = row.retention_state;
  if (state !== 'LIVE' && state !== 'PURGE_PENDING' && state !== 'PURGE_FAILED' && state !== 'PURGED') throw Error('BATCH_RETENTION_INVALID');
  return {
    id: String(row.id), source_key: String(row.source_key), source_post_key: text(row.source_post_key),
    canonical_url: String(row.canonical_url), state: String(row.state), title: text(row.title),
    body_blocks: row.body_blocks, attachment_metadata: row.attachment_metadata, sns_links: row.sns_links,
    raw_object_key: text(row.raw_object_key), version: String(row.version),
    failure_code: text(row.failure_code), skip_reason: text(row.skip_reason),
    collected_at: timestamp(row.collected_at), review_finalized_at: row.review_finalized_at == null ? null : timestamp(row.review_finalized_at),
    expires_at: timestamp(row.expires_at), retention_state: state,
    accessDeadline: requestStarted + Number(row.remaining_ms),
  };
}
@Injectable()
export class TypeOrmBatchResultRepository extends BatchResultRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async find(itemId: string): Promise<BatchResultRow | null> {
    if (!/^[0-9a-f-]{36}$/.test(itemId)) return null;
    // Lifecycle survives payload deletion, preserving 410 until its own metadata TTL.
    const lifecycle = rows(await this.db.manager.query(`SELECT retention_state,expires_at>clock_timestamp() AS live
      FROM collect.batch_retention WHERE item_id=$1`, [itemId]))[0];
    if (!lifecycle) return null;
    if (lifecycle.retention_state !== 'LIVE' || lifecycle.live !== true) fail(410, 'BATCH_ITEM_EXPIRED');
    const requestStarted=performance.now();
    const row = rows(await this.db.manager.query(`SELECT i.*,${retentionColumns}
      FROM collect.batch_item i JOIN collect.batch_retention l ON l.item_id=i.id
      WHERE i.id=$1 AND l.retention_state='LIVE' AND l.expires_at>clock_timestamp()`, [itemId]))[0];
    if (!row) fail(410, 'BATCH_ITEM_EXPIRED');
    return batchResult(row,requestStarted);
  }
}
