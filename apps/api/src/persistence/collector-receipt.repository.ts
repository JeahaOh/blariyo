import { Inject, Injectable } from '@nestjs/common';
import {
  CollectorReceiptRepository,
  type CollectorReceiptKey,
} from '../features/collection/collector-receipt.repository.js';
import { DatabaseContext } from './database.js';
import { CollectCollectorReceiptEntity } from './entities.js';
@Injectable()
export class TypeOrmCollectorReceiptRepository extends CollectorReceiptRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async find(collectorId: string, operation: string, keyHash: Buffer) {
    const row = await this.db.manager
      .createQueryBuilder(CollectCollectorReceiptEntity, 'r')
      .where(
        'r.collector_id=:collectorId AND r.operation=:operation AND r.key_hash=:keyHash AND r.expires_at>now()',
        { collectorId, operation, keyHash }
      )
      .getOne();
    return row
      ? { requestHash: row.request_hash, status: row.response_status, data: row.response_body }
      : null;
  }
  async save(key: CollectorReceiptKey, status: number, data: unknown) {
    await this.db.manager
      .createQueryBuilder()
      .delete()
      .from(CollectCollectorReceiptEntity)
      .where(
        'collector_id=:collectorId AND operation=:operation AND key_hash=:keyHash AND expires_at<=now()',
        key
      )
      .execute();
    await this.db.manager
      .createQueryBuilder()
      .insert()
      .into(CollectCollectorReceiptEntity)
      .values({
        collector_id: key.collectorId,
        operation: key.operation,
        key_hash: key.keyHash,
        request_hash: key.requestHash,
        response_status: status,
        response_body: () => ':data::jsonb',
      })
      .setParameter('data', JSON.stringify(data))
      .execute();
  }
}
