import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CollectorStateRepository,
  type CollectorEventInput,
} from '../features/collection/collector-state.repository.js';
import {
  CollectCandidateEntity,
  CollectCandidateImageEntity,
  CollectCollectorOperationalEventEntity,
  CollectSourceEntity,
} from './entities.js';
import { DatabaseContext } from './database.js';
import { requiredRow, rows } from './rows.js';
@Injectable()
export class TypeOrmCollectorStateRepository extends CollectorStateRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async candidateCounts() {
    return rows(
      await this.db.manager
        .createQueryBuilder(CollectCandidateEntity, 'c')
        .select('c.status', 'status')
        .addSelect('count(*)::integer', 'count')
        .groupBy('c.status')
        .getRawMany()
    ).map((row) => {
      if (typeof row.status !== 'string' || typeof row.count !== 'number')
        throw new Error('INVALID_CANDIDATE_COUNTS');
      return { status: row.status, count: row.count };
    });
  }
  async recentErrors(hours: number) {
    return rows(
      await this.db.manager
        .createQueryBuilder(CollectCollectorOperationalEventEntity, 'e')
        .select('e.event_code', 'code')
        .addSelect('count(*)::integer', 'count')
        .where("e.occurred_at>=now()-:hours*interval '1 hour'", { hours })
        .groupBy('e.event_code')
        .orderBy('e.event_code', 'ASC')
        .getRawMany()
    ).map((row) => {
      if (typeof row.code !== 'string' || typeof row.count !== 'number')
        throw new Error('INVALID_ERROR_COUNTS');
      return { code: row.code, count: row.count };
    });
  }
  disabledSources() {
    return this.db.manager.countBy(CollectSourceEntity, { is_active: false });
  }
  async delivery(collectorId: string, deliveryId: string) {
    const row = await this.db.manager.findOneBy(CollectCollectorOperationalEventEntity, {
      collector_id: collectorId,
      delivery_id: deliveryId,
    });
    return row ? { id: row.id, createdAt: row.created_at, requestHash: row.request_hash } : null;
  }
  async createEvent(collectorId: string, body: CollectorEventInput, hash: Buffer) {
    const result = await this.db.manager
      .createQueryBuilder()
      .insert()
      .into(CollectCollectorOperationalEventEntity)
      .values({
        id: randomUUID(),
        collector_id: collectorId,
        delivery_id: body.deliveryId,
        candidate_id: body.candidateId == null ? null : String(body.candidateId),
        job_request_id: body.jobRequestId ?? null,
        event_code: body.eventCode,
        severity: body.severity,
        attempt_count: body.attemptCount,
        occurred_at: new Date(body.occurredAt),
        request_hash: hash,
      })
      .returning(['id', 'created_at'])
      .execute();
    const row = requiredRow(result.raw);
    if (typeof row.id !== 'string' || !(row.created_at instanceof Date))
      throw new Error('INVALID_CREATED_EVENT');
    return { id: row.id, createdAt: row.created_at, requestHash: hash };
  }
  async refreshOwnership(candidateId: string, collectorId: string, executionId: string) {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        collector_id: collectorId,
        collector_execution_id: executionId,
        lock_version: () => 'lock_version+1',
        updated_by: 'system:collector',
        updated_at: () => 'now()',
      })
      .where('id=:candidateId', { candidateId })
      .execute();
    if (result.affected !== 1) throw new Error('MISSING_REFRESH_CANDIDATE');
  }
  async missingPreviews(candidateId: string) {
    return (
      await this.db.manager
        .createQueryBuilder(CollectCandidateImageEntity, 'i')
        .where(
          'i.candidate_id=:candidateId AND (i.preview_storage_key IS NULL OR i.preview_expires_at<=now())',
          { candidateId }
        )
        .orderBy('i.position', 'ASC')
        .getMany()
    ).map((row) => ({ id: row.id, position: row.position, remoteUrl: row.remote_url }));
  }
}
