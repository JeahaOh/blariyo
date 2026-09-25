import { Inject, Injectable } from '@nestjs/common';
import {
  CollectionOperationsRepository,
  type OperationalEvent,
  type TransitionState,
} from '../features/collection/collection-operations.repository.js';
import { DatabaseContext } from './database.js';
import {
  CollectCandidateEntity,
  CollectCandidateImageEntity,
  CollectCollectorOperationalEventEntity,
} from './entities.js';
import { requiredRow, rows } from './rows.js';

// Exact legacy transition DDL. Only the explicit apply command calls this; never application startup.
const constraints = [
  {
    name: 'spring_running_execution',
    table: 'collect.candidate',
    expression: "status <> 'RUNNING' OR collector_execution_id IS NOT NULL",
  },
  {
    name: 'spring_preview_source_digest',
    table: 'collect.candidate_image',
    expression: '(preview_storage_key IS NULL) = (preview_source_sha256 IS NULL)',
  },
];
@Injectable()
export class TypeOrmCollectionOperationsRepository extends CollectionOperationsRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async schemaReady() {
    return (
      requiredRow(
        await this.db.manager.query(
          "SELECT ops.is_schema_ready('V008') OR ops.is_schema_ready('V007') AS ready"
        )
      ).ready === true
    );
  }
  async hasLegacyMutationData() {
    const running = await this.db.manager
      .createQueryBuilder(CollectCandidateEntity, 'c')
      .where("c.status = 'RUNNING' AND c.collector_execution_id IS NULL")
      .getExists();
    return (
      running ||
      (await this.db.manager
        .createQueryBuilder(CollectCandidateImageEntity, 'i')
        .where('i.preview_storage_key IS NOT NULL AND i.preview_source_sha256 IS NULL')
        .getExists())
    );
  }
  async inspectTransition(): Promise<TransitionState> {
    // One catalog snapshot includes both tables; used inside the exclusive-lock transaction on apply.
    const row = requiredRow(
      await this.db.manager.query(`SELECT
      (SELECT count(*)::integer FROM collect.candidate WHERE status='RUNNING' AND collector_execution_id IS NULL) AS legacy_running,
      (SELECT count(*)::integer FROM collect.candidate_image WHERE (preview_storage_key IS NULL) <> (preview_source_sha256 IS NULL)) AS legacy_previews,
      (SELECT count(*)::integer FROM pg_constraint WHERE conname IN ('spring_running_execution','spring_preview_source_digest') AND convalidated AND connamespace='collect'::regnamespace) AS validated_constraints`)
    );
    if (
      typeof row.legacy_running !== 'number' ||
      typeof row.legacy_previews !== 'number' ||
      typeof row.validated_constraints !== 'number'
    )
      throw new Error('INVALID_TRANSITION_STATE');
    return {
      legacyRunning: row.legacy_running,
      legacyPreviews: row.legacy_previews,
      strict: row.validated_constraints === 2,
    };
  }
  async lockTransitionTables() {
    await this.db.manager.query(
      'LOCK TABLE collect.candidate,collect.candidate_image IN ACCESS EXCLUSIVE MODE'
    );
  }
  async enforceTransitionConstraints() {
    for (const { name, table, expression } of constraints) {
      const existing = rows(
        await this.db.manager.query(
          'SELECT 1 FROM pg_constraint WHERE conname=$1 AND conrelid=$2::regclass',
          [name, table]
        )
      );
      if (existing.length === 0)
        await this.db.manager.query(
          `ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression}) NOT VALID`
        );
      await this.db.manager.query(`ALTER TABLE ${table} VALIDATE CONSTRAINT ${name}`);
    }
  }
  async eventsAvailable() {
    return (
      requiredRow(
        await this.db.manager.query(
          "SELECT to_regclass('collect.collector_operational_event') IS NOT NULL AS ready"
        )
      ).ready === true
    );
  }
  async unacknowledgedEvents(): Promise<OperationalEvent[]> {
    const events = await this.db.manager
      .createQueryBuilder(CollectCollectorOperationalEventEntity, 'event')
      .where("event.delivery_status = 'UNACKNOWLEDGED'")
      .andWhere("event.created_at > now()-interval '30 days'")
      .orderBy('event.occurred_at', 'DESC')
      .addOrderBy('event.id', 'ASC')
      .take(100)
      .getMany();
    return events.map((event) => {
      if (
        (event.severity !== 'INFO' && event.severity !== 'WARN' && event.severity !== 'ERROR') ||
        (event.delivery_status !== 'UNACKNOWLEDGED' && event.delivery_status !== 'ACKNOWLEDGED')
      )
        throw new Error('INVALID_OPERATIONAL_EVENT');
      return {
        eventId: event.id,
        candidateId: event.candidate_id,
        eventCode: event.event_code,
        severity: event.severity,
        occurredAt: event.occurred_at,
        deliveryStatus: event.delivery_status,
      };
    });
  }
  async acknowledge(eventId: string) {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(CollectCollectorOperationalEventEntity)
      .set({
        delivery_status: 'ACKNOWLEDGED',
        acknowledged_at: () => 'COALESCE(acknowledged_at,now())',
      })
      .where('id = :eventId', { eventId })
      .returning(['id', 'acknowledged_at'])
      .execute();
    const row = rows(result.raw)[0];
    if (!row) return null;
    if (typeof row.id !== 'string' || !(row.acknowledged_at instanceof Date))
      throw new Error('INVALID_EVENT_ACKNOWLEDGMENT');
    return { eventId: row.id, acknowledgedAt: row.acknowledged_at };
  }
}
