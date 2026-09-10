import { Inject, Injectable } from '@nestjs/common';
import {
  IdempotencyRepository,
  type Replay,
  type IdempotencyReceipt,
} from '../shared/idempotency.repository.js';
import { OpsIdempotencyRequestEntity } from './entities.js';
import { DatabaseContext } from './database.js';
@Injectable()
export class TypeOrmIdempotencyRepository extends IdempotencyRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async find(
    actor: string,
    scope: string,
    key: string,
    activeOnly = false
  ): Promise<Replay | null> {
    const query = this.db.manager
      .createQueryBuilder(OpsIdempotencyRequestEntity, 'receipt')
      .where(
        'receipt.created_by = :actor AND receipt.operation_scope = :scope AND receipt.idempotency_key = :key',
        { actor, scope, key }
      );
    if (activeOnly) query.andWhere('receipt.expires_at > now()');
    const row = await query.getOne();
    return row
      ? { hash: row.request_hash, status: row.response_status, data: row.response_body }
      : null;
  }
  async save(value: IdempotencyReceipt, replaceExpired = false): Promise<void> {
    if (replaceExpired)
      await this.db.manager
        .createQueryBuilder()
        .delete()
        .from(OpsIdempotencyRequestEntity)
        .where(
          'created_by = :actor AND operation_scope = :scope AND idempotency_key = :key AND expires_at <= now()',
          value
        )
        .execute();
    await this.db.manager.createQueryBuilder().insert().into(OpsIdempotencyRequestEntity)
      .values({ operation_scope: value.scope, idempotency_key: value.key, request_hash: value.hash,
        response_status: value.status, response_body: () => ':response::jsonb', resource_type: value.resourceType, resource_id: value.resourceId,
        expires_at: () => "now()+interval '24 hours'", created_by: value.actor, created_at: () => 'now()', updated_by: value.actor, updated_at: () => 'now()' })
      .setParameter('response', JSON.stringify(value.data)).execute();
  }
}
