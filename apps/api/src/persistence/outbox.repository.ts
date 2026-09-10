import { Inject, Injectable } from '@nestjs/common';
import {
  OutboxRepository,
  type OutboxMessage,
  type OutboxTask,
} from '../operations/outbox.repository.js';
import { OpsOutboxTaskEntity } from './entities.js';
import { rows, decimalId } from './rows.js';
import { DatabaseContext } from './database.js';
@Injectable()
export class TypeOrmOutboxRepository extends OutboxRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async recoverExpired(actor: string): Promise<void> {
    await this.db.manager.createQueryBuilder().update(OpsOutboxTaskEntity)
      .set({ status: () => "CASE WHEN attempt_count+1>=8 THEN 'DEAD' ELSE 'FAILED' END", attempt_count: () => 'attempt_count+1',
        next_attempt_at: () => "now()+power(2,attempt_count+1)*interval '1 minute'", last_error_code: 'LEASE_EXPIRED', updated_by: actor, updated_at: () => 'now()' })
      .where("status='RUNNING' AND updated_at<now()-interval '5 minutes'").execute();
  }
  async claim(actor: string): Promise<OutboxTask | null> {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(OpsOutboxTaskEntity)
      .set({ status: 'RUNNING', updated_by: actor, updated_at: () => 'clock_timestamp()' })
      .where(
        "id=(SELECT id FROM ops.outbox_task WHERE status IN ('PENDING','FAILED') AND next_attempt_at<=now() ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1)"
      )
      .returning('id')
      .execute();
    const raw: unknown = result.raw,
      first = rows(raw)[0];
    if (!first) return null;
    const row = await this.db.manager.findOneByOrFail(OpsOutboxTaskEntity, {
      id: decimalId(first.id),
    });
    const type = row.type,
      aggregateType = row.aggregate_type;
    if (
      type !== 'CACHE_PURGE' &&
      type !== 'OBJECT_DELETE_PUBLIC' &&
      type !== 'OBJECT_DELETE_PRIVATE'
    )
      throw new Error('INVALID_OUTBOX_TYPE');
    if (
      aggregateType !== 'POST' &&
      aggregateType !== 'IMAGE' &&
      aggregateType !== 'POLICY' &&
      aggregateType !== 'STORAGE_OBJECT'
    )
      throw new Error('INVALID_OUTBOX_AGGREGATE');
    if (typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload))
      throw new Error('INVALID_OUTBOX_PAYLOAD');
    return {
      id: row.id,
      type,
      aggregateType,
      aggregateId: row.aggregate_id,
      payload: Object.fromEntries(Object.entries(row.payload)),
      claimedAt: row.updated_at,
    };
  }
  async owns(task: OutboxTask, lock = false): Promise<boolean> {
    const query = this.db.manager
      .createQueryBuilder(OpsOutboxTaskEntity, 'task')
      .where("task.id=:id AND task.status='RUNNING' AND task.updated_at=:claimedAt", {
        id: task.id,
        claimedAt: task.claimedAt,
      });
    if (lock) query.setLock('pessimistic_write');
    return (await query.getOne()) !== null;
  }
  async succeed(id: string): Promise<void> {
    await this.db.manager.createQueryBuilder().update(OpsOutboxTaskEntity)
      .set({ status: 'SUCCEEDED', updated_at: () => 'now()', last_error_code: null }).where('id=:id', { id }).execute();
  }
  async fail(task: OutboxTask): Promise<void> {
    await this.db.manager.createQueryBuilder().update(OpsOutboxTaskEntity)
      .set({ attempt_count: () => 'attempt_count+1', status: () => "CASE WHEN attempt_count+1>=8 THEN 'DEAD' ELSE 'FAILED' END",
        next_attempt_at: () => "now()+power(2,attempt_count+1)*interval '1 minute'", last_error_code: 'EXTERNAL_OPERATION_FAILED', updated_at: () => 'now()' })
      .where("id=:id AND status='RUNNING' AND updated_at=:claimedAt", { id: task.id, claimedAt: task.claimedAt }).execute();
  }
  async enqueue(message: OutboxMessage): Promise<void> {
    await this.db.manager.createQueryBuilder().insert().into(OpsOutboxTaskEntity)
      .values({ type: message.type, status: 'PENDING', aggregate_type: message.aggregateType, aggregate_id: message.aggregateId,
        payload: () => ':payload::jsonb', next_attempt_at: () => "now()+:delay*interval '1 second'", created_by: message.actor, created_at: () => 'now()', updated_by: message.actor, updated_at: () => 'now()' })
      .setParameters({ payload: JSON.stringify(message.payload), delay: message.delay ?? 0 }).execute();
  }
}
