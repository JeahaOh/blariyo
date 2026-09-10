import { Inject, Injectable } from '@nestjs/common';
import {
  CollectorQuotaRepository,
  type Reservation,
} from '../features/collection/collector-quota.repository.js';
import {
  CollectSourceEntity,
  CollectSourceRequestBudgetEntity,
  CollectSourceRequestReservationEntity,
} from './entities.js';
import { DatabaseContext } from './database.js';
import { requiredRow } from './rows.js';
@Injectable()
export class TypeOrmCollectorQuotaRepository extends CollectorQuotaRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async clock() {
    // One PostgreSQL wall-clock instant determines the KST budget day and permit boundary.
    const row = requiredRow(
      await this.db.manager.query(`WITH tick AS MATERIALIZED (SELECT clock_timestamp() AS instant)
      SELECT instant AS now,(instant AT TIME ZONE 'Asia/Seoul')::date::text AS day,
      (((instant AT TIME ZONE 'Asia/Seoul')::date+1)::timestamp AT TIME ZONE 'Asia/Seoul') AS midnight FROM tick`)
    );
    if (
      !(row.now instanceof Date) ||
      !(row.midnight instanceof Date) ||
      typeof row.day !== 'string'
    )
      throw new Error('INVALID_QUOTA_CLOCK');
    return { now: row.now, day: row.day, midnight: row.midnight };
  }
  async reservation(sourceId: string, requestKeyHash: Buffer): Promise<Reservation | null> {
    const row = await this.db.manager.findOneBy(CollectSourceRequestReservationEntity, {
      source_id: sourceId,
      request_key_hash: requestKeyHash,
    });
    return row
      ? {
          id: row.id,
          sourceId: row.source_id,
          candidateId: row.candidate_id,
          collectorId: row.collector_id,
          executionId: row.collector_execution_id,
          jobRequestId: row.job_request_id,
          requestKeyHash: row.request_key_hash,
          requestHash: row.request_hash,
          requestKind: row.request_kind,
          day: row.budget_date,
          reservedAt: row.reserved_at,
          validUntil: row.valid_until,
          nextAllowedAt: row.next_allowed_at,
          reservedCount: row.reserved_count,
          remainingCount: row.remaining_count,
        }
      : null;
  }
  async lockedBudget(sourceId: string, day: string) {
    await this.db.manager
      .createQueryBuilder()
      .insert()
      .into(CollectSourceRequestBudgetEntity)
      .values({ source_id: sourceId, budget_date: day })
      .orIgnore()
      .execute();
    const row = await this.db.manager
      .createQueryBuilder(CollectSourceRequestBudgetEntity, 'b')
      .where('b.source_id=:sourceId AND b.budget_date=:day', { sourceId, day })
      .setLock('pessimistic_write')
      .getOneOrFail();
    return row.reserved_count;
  }
  async saveReservation(value: Reservation) {
    await this.db.manager.insert(CollectSourceRequestReservationEntity, {
      id: value.id,
      source_id: value.sourceId,
      candidate_id: value.candidateId,
      collector_id: value.collectorId,
      collector_execution_id: value.executionId,
      job_request_id: value.jobRequestId,
      request_key_hash: value.requestKeyHash,
      request_hash: value.requestHash,
      request_kind: value.requestKind,
      budget_date: value.day,
      reserved_at: value.reservedAt,
      valid_until: value.validUntil,
      next_allowed_at: value.nextAllowedAt,
      reserved_count: value.reservedCount,
      remaining_count: value.remainingCount,
    });
  }
  async consume(sourceId: string, day: string, count: number, next: Date) {
    const budget = await this.db.manager
      .createQueryBuilder()
      .update(CollectSourceRequestBudgetEntity)
      .set({ reserved_count: count, lock_version: () => 'lock_version+1' })
      .where('source_id=:sourceId AND budget_date=:day', { sourceId, day })
      .execute();
    const source = await this.db.manager
      .createQueryBuilder()
      .update(CollectSourceEntity)
      .set({ next_request_at: next, updated_by: 'system:collector', updated_at: () => 'now()' })
      .where('id=:sourceId', { sourceId })
      .execute();
    if (budget.affected !== 1 || source.affected !== 1) throw new Error('MISSING_QUOTA_OWNER');
  }
}
