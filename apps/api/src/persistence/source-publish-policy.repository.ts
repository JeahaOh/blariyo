import { Inject, Injectable } from '@nestjs/common';
import { SourcePublishPolicyRepository, type SourcePublishPolicy } from '../features/collection/source-publish-policy.repository.js';
import { DatabaseContext } from './database.js';
import { rows } from './rows.js';
import { fail } from '../shared/errors.js';
import { failureLogs } from '../features/collection/failure-diagnostics.js';

function runState(value: unknown): SourcePublishPolicy['lastRunState'] {
  switch (value) {
    case 'QUEUED': case 'RUNNING': case 'COMPLETED': case 'PARTIAL': case 'FAILED': case 'BLOCKED': return value;
    default: return null;
  }
}
function policy(row: Record<string, unknown>): SourcePublishPolicy {
  return { sourceKey: String(row.source_key), displayName: String(row.display_name),
    sourceUrl: typeof row.source_url === 'string' ? row.source_url : null,
    collectionEnabled: typeof row.collection_enabled === 'boolean' ? row.collection_enabled : null,
    collectionAvailable: row.collection_available === true,
    collectionBlockedReason: typeof row.blocked_reason === 'string' ? row.blocked_reason : null,
    collectionLockVersion: Number(row.collection_lock_version ?? 0),
    autoPublishEnabled: row.auto_publish_enabled === true, lockVersion: Number(row.lock_version ?? 0),
    enabledSince: row.enabled_since instanceof Date ? row.enabled_since.toISOString() : null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : null,
    lastCollectedAt: row.last_collected_at instanceof Date ? row.last_collected_at.toISOString() : null,
    lastRunAt: row.last_run_at instanceof Date ? row.last_run_at.toISOString() : null,
    lastRunState: runState(row.last_run_state),
    lastFailureCodes: Array.isArray(row.last_failure_codes) ? row.last_failure_codes.map(String) : [],
    lastFailures: failureLogs(row.last_failures) };
}
export async function assertAutoPublishPolicy(db: DatabaseContext, itemId: string, body: Record<string, unknown>): Promise<void> {
  if (typeof body.sourceKey !== 'string' || !Number.isSafeInteger(body.policyVersion) || Number(body.policyVersion) < 1
    || body.boardSlug !== 'meme') fail(409,'AUTO_PUBLISH_POLICY_CHANGED');
  const found = rows(await db.manager.query(`SELECT p.source_key FROM collect.batch_source_publish_policy p
    JOIN collect.batch_item i ON i.source_key=p.source_key JOIN collect.batch_run r ON r.id=i.run_id
    JOIN collect.batch_retention l ON l.item_id=i.id
    WHERE i.id=$1 AND p.source_key=$2 AND p.lock_version=$3 AND p.auto_publish_enabled
      AND r.started_at>=p.enabled_since AND i.state='FETCHED'
      AND l.retention_state='LIVE' AND l.expires_at>clock_timestamp() FOR SHARE OF p`,
  [itemId,body.sourceKey,body.policyVersion]))[0];
  if (!found) fail(409,'AUTO_PUBLISH_POLICY_CHANGED');
  const head = rows(await db.manager.query('SELECT rule_version FROM collect.auto_publish_keyword_head WHERE singleton FOR SHARE'))[0];
  if (!head || body.classificationVersion !== head.rule_version || typeof body.classificationDigest !== 'string'
    || !/^[a-f0-9]{64}$/.test(body.classificationDigest)) fail(409,'AUTO_PUBLISH_CLASSIFICATION_CHANGED');
  const classified = rows(await db.manager.query(`SELECT a.item_id,a.title_key FROM collect.batch_auto_publish_classification a
    JOIN collect.batch_item i ON i.id=a.item_id
    WHERE a.item_id=$1 AND a.rule_version=$2 AND a.policy_version=$3 AND a.item_version=i.version
      AND a.decision='ELIGIBLE' AND a.content_digest=decode($4,'hex') FOR SHARE OF a`,
  [itemId,head.rule_version,body.policyVersion,body.classificationDigest]))[0];
  if (!classified) fail(409,'AUTO_PUBLISH_CLASSIFICATION_CHANGED');
  await db.manager.query("SELECT pg_advisory_xact_lock(hashtextextended('auto-publish-title:'||encode($1::bytea,'hex'),0))",[classified.title_key]);
  if (rows(await db.manager.query(`SELECT 1 FROM content.board_post p
    LEFT JOIN collect.batch_review r ON r.item_id=$1
    WHERE p.status<>'REMOVED' AND p.id IS DISTINCT FROM r.post_id AND collect.auto_publish_title_key(p.title)=$2 LIMIT 1`,
  [itemId,classified.title_key])).length) fail(409,'AUTO_PUBLISH_DUPLICATE_TITLE');
}
@Injectable()
export class TypeOrmSourcePublishPolicyRepository extends SourcePublishPolicyRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) { super(); }
  async list() {
    const ledger = rows(await this.db.manager.query(`SELECT to_regclass('collect.batch_source_collection_setting') IS NOT NULL AS ready,
      to_regclass('collect.batch_run') IS NOT NULL AND to_regclass('collect.batch_item') IS NOT NULL
      AND to_regclass('collect.batch_failure') IS NOT NULL AS history_ready`))[0];
    const ready = ledger?.ready === true, historyReady = ledger?.history_ready === true;
    const fields = ready ? 's.source_url,s.collection_enabled,s.collection_available,s.blocked_reason,s.lock_version AS collection_lock_version'
      : 'NULL AS source_url,NULL AS collection_enabled,false AS collection_available,NULL AS blocked_reason,0 AS collection_lock_version';
    const history = historyReady ? `WITH latest AS (
      SELECT DISTINCT ON (source_key) id,source_key,started_at,state,checkpoint
      FROM collect.batch_run WHERE mode='WRITE_DB' ORDER BY source_key,started_at DESC,id DESC
    ), errors AS (
      SELECT run_id,array_agg(DISTINCT code ORDER BY code) AS codes FROM (
        SELECT f.run_id,f.code FROM collect.batch_failure f JOIN latest r ON r.id=f.run_id
        WHERE f.code ~ '^[A-Z][A-Z0-9_]{0,79}$'
        UNION SELECT id,checkpoint->>'reason' FROM latest WHERE checkpoint->>'reason' ~ '^[A-Z][A-Z0-9_]{0,79}$'
      ) failure GROUP BY run_id
    ), collected AS (
      SELECT i.source_key,max(i.fetched_at) AS fetched_at FROM collect.batch_item i JOIN collect.batch_run r ON r.id=i.run_id
      WHERE i.state='FETCHED' AND r.mode='WRITE_DB' GROUP BY i.source_key
    )` : '';
    const historyFields = historyReady ? `r.started_at AS last_run_at,r.state AS last_run_state,i.fetched_at AS last_collected_at,COALESCE(e.codes,ARRAY[]::text[]) AS last_failure_codes,
      COALESCE((SELECT jsonb_agg(log ORDER BY occurred_at DESC,id DESC) FROM (
        SELECT f.id,f.occurred_at,jsonb_build_object('occurredAt',f.occurred_at,'phase',f.phase,'code',f.code,
          'detail',jsonb_build_object('diagnosticReason',f.detail->'diagnosticReason','requestHost',f.detail->'requestHost','httpStatus',f.detail->'httpStatus')) AS log
        FROM collect.batch_failure f WHERE f.run_id=r.id AND f.code ~ '^[A-Z][A-Z0-9_]{0,79}$'
        ORDER BY f.occurred_at DESC,f.id DESC LIMIT 10
      ) logs),'[]'::jsonb) AS last_failures`
      : "NULL AS last_run_at,NULL AS last_run_state,NULL AS last_collected_at,ARRAY[]::text[] AS last_failure_codes,'[]'::jsonb AS last_failures";
    return rows(await this.db.manager.query(`${history} SELECT ${fields},${historyFields},c.reference_key AS source_key,c.display_name,p.auto_publish_enabled,
      p.enabled_since,p.lock_version,p.updated_at FROM content.common_code c
      LEFT JOIN collect.batch_source_publish_policy p ON p.source_key=c.reference_key
      ${ready ? 'LEFT JOIN collect.batch_source_collection_setting s ON s.source_key=c.reference_key' : ''}
      ${historyReady ? 'LEFT JOIN latest r ON r.source_key=c.reference_key LEFT JOIN errors e ON e.run_id=r.id LEFT JOIN collected i ON i.source_key=c.reference_key' : ''}
      WHERE c.group_key='source' ORDER BY c.display_name,c.reference_key`)).map(policy);
  }
  async update(source: string, enabled: boolean, version: number, actor: string, collection?: { enabled: boolean; version: number }) {
    await this.db.manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['source-publish-policy:'+source]);
    const code = rows(await this.db.manager.query("SELECT display_name FROM content.common_code WHERE group_key='source' AND reference_key=$1",[source]))[0];
    if (!code) fail(404,'SOURCE_PUBLISH_POLICY_NOT_FOUND');
    const current = rows(await this.db.manager.query('SELECT * FROM collect.batch_source_publish_policy WHERE source_key=$1 FOR UPDATE',[source]))[0];
    if (Number(current?.lock_version ?? 0) !== version) fail(409,'SOURCE_PUBLISH_POLICY_VERSION_CONFLICT');
    if (collection) {
      try { await this.db.manager.query('SELECT collect.set_source_collection_setting($1,$2,$3,$4)',[source,collection.enabled,collection.version,actor]); }
      catch (error) {
        for (const code of ['SOURCE_COLLECTION_SETTING_UNAVAILABLE','SOURCE_COLLECTION_SETTING_VERSION_CONFLICT','SOURCE_COLLECTION_NOT_AVAILABLE'])
          if (error instanceof Error && error.message.includes(code)) fail(409,code);
        throw error;
      }
      if ((current?.auto_publish_enabled === true) === enabled) {
        const existing = (await this.list()).find(item=>item.sourceKey===source);
        if (!existing) throw new Error('POLICY_READ_FAILED');
        return existing;
      }
    }
    const changed = rows(await this.db.manager.query(`INSERT INTO collect.batch_source_publish_policy
      (source_key,auto_publish_enabled,enabled_since,updated_by) VALUES($1,$2,CASE WHEN $2 THEN clock_timestamp() END,$3)
      ON CONFLICT(source_key) DO UPDATE SET auto_publish_enabled=$2,
        enabled_since=CASE WHEN $2 AND NOT batch_source_publish_policy.auto_publish_enabled THEN clock_timestamp()
          ELSE batch_source_publish_policy.enabled_since END,
        lock_version=batch_source_publish_policy.lock_version+1,updated_by=$3,updated_at=clock_timestamp() RETURNING *`,[source,enabled,actor]))[0];
    if (!changed) throw new Error('POLICY_WRITE_FAILED');
    const result = (await this.list()).find(item=>item.sourceKey===source);
    if (!result) throw new Error('POLICY_READ_FAILED');
    return result;
  }
  async candidates(limit: number) {
    return rows(await this.db.manager.query(`SELECT i.id,i.source_key,p.lock_version FROM collect.batch_item i
      JOIN collect.batch_run b ON b.id=i.run_id JOIN collect.batch_retention l ON l.item_id=i.id
      JOIN collect.batch_source_publish_policy p ON p.source_key=i.source_key
      WHERE p.auto_publish_enabled AND b.started_at>=p.enabled_since AND i.state='FETCHED'
        AND l.retention_state='LIVE' AND l.expires_at>clock_timestamp()
        AND NOT EXISTS(SELECT 1 FROM collect.batch_review r WHERE r.item_id=i.id)
        AND NOT EXISTS(SELECT 1 FROM collect.batch_review_command c WHERE c.item_id=i.id)
        AND NOT EXISTS(SELECT 1 FROM collect.discord_review_delivery d WHERE d.item_id=i.id)
        AND NOT EXISTS(SELECT 1 FROM collect.batch_auto_publish_classification a WHERE a.item_id=i.id
          AND a.decision='REVIEW')
      ORDER BY i.fetched_at NULLS LAST,i.id LIMIT $1`,[limit])).map(r=>({itemId:String(r.id),sourceKey:String(r.source_key),policyVersion:Number(r.lock_version)}));
  }
  async pending(limit: number) {
    return rows(await this.db.manager.query(`SELECT c.id FROM collect.batch_review_command c JOIN collect.batch_review_control r
      ON r.active_command_id=c.id AND r.decision_epoch=c.decision_epoch
      WHERE c.origin='AUTO' AND c.finished_at IS NULL AND c.next_attempt_at<=clock_timestamp()
      AND (c.lease_until IS NULL OR c.lease_until<clock_timestamp()) ORDER BY c.created_at,c.id LIMIT $1`,[limit])).map(r=>String(r.id));
  }
  assertEligible(itemId: string, body: Record<string, unknown>) { return assertAutoPublishPolicy(this.db,itemId,body); }
}
