import { Inject, Injectable } from '@nestjs/common';
import {
  BatchResultRepository,
  type BatchResultRow,
} from '../features/collection/batch-result.repository.js';
import { DatabaseContext } from './database.js';
import { rows } from './rows.js';
@Injectable()
export class TypeOrmBatchResultRepository extends BatchResultRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async find(itemId: string): Promise<BatchResultRow | null> {
    if (!/^[0-9a-f-]{36}$/.test(itemId)) return null;
    try {
      const result = rows(
        await this.db.manager.query(
          `SELECT id,source_key,source_post_key,canonical_url,state,title,body_blocks,attachment_metadata,sns_links,raw_object_key,version,failure_code,to_jsonb(i)->>'skip_reason' AS skip_reason FROM collect.batch_item i WHERE id=$1`,
          [itemId]
        )
      );
      const row = result[0];
      if (!row) return null;
      return {
        id: String(row.id),
        source_key: String(row.source_key),
        source_post_key: row.source_post_key === null ? null : this.text(row.source_post_key),
        canonical_url: String(row.canonical_url),
        state: String(row.state),
        title: row.title === null ? null : this.text(row.title),
        body_blocks: row.body_blocks,
        attachment_metadata: row.attachment_metadata,
        sns_links: row.sns_links,
        raw_object_key: row.raw_object_key === null ? null : this.text(row.raw_object_key),
        version: String(row.version),
        failure_code: row.failure_code == null ? null : this.text(row.failure_code),
        skip_reason: row.skip_reason == null ? null : this.text(row.skip_reason),
      };
    } catch (error) {
      if (error instanceof Error && /relation .*batch_item does not exist/i.test(error.message))
        return null;
      throw error;
    }
  }
  private text(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
