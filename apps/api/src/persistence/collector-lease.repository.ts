import { Inject, Injectable } from '@nestjs/common';
import {
  CollectorLeaseRepository,
  type ClaimCandidate,
  type LeaseGrant,
} from '../features/collection/collector-lease.repository.js';
import { CollectCandidateEntity } from './entities.js';
import { DatabaseContext } from './database.js';
import { requiredRow, rows, decimalId } from './rows.js';
function grant(value: unknown): LeaseGrant {
  const row = requiredRow(value);
  if (
    typeof row.attempt_count !== 'number' ||
    typeof row.lock_version !== 'number' ||
    !(row.lease_until instanceof Date)
  )
    throw new Error('INVALID_LEASE_GRANT');
  return {
    attemptCount: row.attempt_count,
    lockVersion: row.lock_version,
    leaseUntil: row.lease_until,
  };
}
@Injectable()
export class TypeOrmCollectorLeaseRepository extends CollectorLeaseRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async expireUnclaimable(candidateId: string | null) {
    // PostgreSQL locked CTE makes expiration and selection atomic across independent workers.
    const result: unknown = await this.db.manager.query(
      `WITH expired AS (
      SELECT id FROM collect.candidate WHERE status='RUNNING' AND lease_until<now()
        AND (attempt_count>=3 OR requested_at<=now()-interval '24 hours') AND ($1::bigint IS NULL OR id=$1)
      ORDER BY requested_at,id FOR UPDATE SKIP LOCKED)
      UPDATE collect.candidate c SET status='FETCH_FAILED',fetch_error_code='LEASE_EXPIRED',fetched_at=now(),lease_until=NULL,
        lock_version=lock_version+1,updated_by='system:collector',updated_at=now() FROM expired WHERE c.id=expired.id RETURNING c.id`,
      [candidateId]
    );
    // QueryRunner returns [rows, affectedCount] for PostgreSQL UPDATE, including CTE UPDATE.
    if (!Array.isArray(result) || !Array.isArray(result[0]))
      throw new Error('INVALID_EXPIRED_CANDIDATES');
    return rows(result[0]).map((row) => decimalId(row.id));
  }
  async claimable(candidateId: string | null, maxItems: number): Promise<ClaimCandidate[]> {
    const result = await this.db.manager
      .createQueryBuilder(CollectCandidateEntity, 'c')
      .where(
        "(c.status='PENDING' OR (c.status='RUNNING' AND c.lease_until<now() AND c.attempt_count<3 AND c.requested_at>now()-interval '24 hours'))"
      )
      .andWhere('(:candidateId::bigint IS NULL OR c.id=:candidateId)', { candidateId })
      .orderBy('c.requested_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(maxItems)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
    return result.map((row) => {
      if (row.discovery_mode !== 'MANUAL_URL' && row.discovery_mode !== 'LIST_CRAWL')
        throw new Error('INVALID_DISCOVERY_MODE');
      return {
        id: row.id,
        sourceId: row.source_id,
        originUrl: row.origin_url,
        discoveryMode: row.discovery_mode,
      };
    });
  }
  async claim(candidateId: string, collectorId: string, seconds: number, executionId?: string) {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        status: 'RUNNING',
        collector_id: collectorId,
        claimed_at: () => 'now()',
        lease_until: () => "now()+:seconds*interval '1 second'",
        attempt_count: () => 'attempt_count+1',
        lock_version: () => 'lock_version+1',
        updated_by: 'system:collector',
        updated_at: () => 'now()',
        ...(executionId === undefined
          ? {}
          : {
              collector_execution_id: executionId,
              last_heartbeat_at: () => 'now()',
              result_payload_sha256: null,
            }),
      })
      .where('id=:candidateId', { candidateId })
      .setParameter('seconds', seconds)
      .returning(['attempt_count', 'lock_version', 'lease_until'])
      .execute();
    return grant(result.raw);
  }
  async heartbeat(candidateId: string, seconds: number, spring: boolean) {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        lease_until: () => "now()+:seconds*interval '1 second'",
        lock_version: () => 'lock_version+1',
        updated_by: 'system:collector',
        updated_at: () => 'now()',
        ...(spring ? { last_heartbeat_at: () => 'now()' } : {}),
      })
      .where('id=:candidateId', { candidateId })
      .setParameter('seconds', seconds)
      .returning(['attempt_count', 'lock_version', 'lease_until'])
      .execute();
    return grant(result.raw);
  }
}
