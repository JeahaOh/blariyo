import { Inject, Injectable } from '@nestjs/common';
import {
  BatchReviewRepository,
  type Review,
  type BatchMedia,
} from '../features/collection/batch-review.repository.js';
import {
  BatchResultRepository,
  type BatchResultRow,
} from '../features/collection/batch-result.repository.js';
import { DatabaseContext } from './database.js';
import { rows, requiredRow } from './rows.js';
import { fail } from '../shared/errors.js';

function review(row: Record<string, unknown>): Review {
  const status = row.status;
  if (status !== 'REVIEWING' && status !== 'APPROVED' && status !== 'REJECTED')
    throw Error('INVALID_REVIEW_STATE');
  if (!Buffer.isBuffer(row.content_digest)) throw Error('INVALID_REVIEW_DIGEST');
  return {
    contentDigest: row.content_digest,
    itemId: String(row.item_id),
    itemVersion: Number(row.item_version),
    status,
    lockVersion: Number(row.lock_version),
    postId: row.post_id === null ? null : Number(row.post_id),
  };
}
function optionalText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
@Injectable()
export class TypeOrmBatchReviewRepository extends BatchReviewRepository {
  constructor(
    @Inject(DatabaseContext) private readonly db: DatabaseContext,
    @Inject(BatchResultRepository) private readonly results: BatchResultRepository
  ) {
    super();
  }
  item(id: string) {
    return this.results.find(id);
  }
  async list(page: number, source?: string, state?: string, reviewStatus?: string) {
    const filters = [source ?? null, state ?? null, reviewStatus ?? null];
    const selection = `FROM collect.batch_item i LEFT JOIN collect.batch_review r ON r.item_id=i.id
      WHERE ($1::text IS NULL OR i.source_key=$1) AND ($2::text IS NULL OR i.state=$2)
      AND ($3::text IS NULL OR COALESCE(r.status,'UNREVIEWED')=$3)`;
    const total = Number(
      requiredRow(await this.db.manager.query('SELECT count(*) ' + selection, filters)).count
    );
    const ids = rows(
      await this.db.manager.query(
        'SELECT i.id ' +
          selection +
          ' ORDER BY i.fetched_at DESC NULLS LAST,i.id LIMIT 20 OFFSET $4',
        [...filters, (page - 1) * 20]
      )
    );
    const items: BatchResultRow[] = [];
    for (const row of ids) {
      const item = await this.item(String(row.id));
      if (item) items.push(item);
    }
    return { items, total };
  }
  async media(id: string): Promise<BatchMedia[]> {
    return rows(
      await this.db.manager.query(
        'SELECT * FROM collect.batch_media WHERE item_id=$1 ORDER BY position',
        [id]
      )
    ).map((row) => {
      const kind = row.kind;
      if (kind !== 'IMAGE' && kind !== 'FILE') throw Error('INVALID_MEDIA_KIND');
      return {
        id: String(row.id),
        position: Number(row.position),
        kind,
        remoteUrl: optionalText(row.remote_url),
        mime: optionalText(row.mime_type),
        size: row.byte_size === null ? null : Number(row.byte_size),
        hash: Buffer.isBuffer(row.sha256) ? row.sha256 : null,
        key: optionalText(row.object_key),
      };
    });
  }
  async review(id: string) {
    const row = rows(
      await this.db.manager.query('SELECT * FROM collect.batch_review WHERE item_id=$1', [id])
    )[0];
    return row ? review(row) : null;
  }
  async setReview(
    item: BatchResultRow,
    decision: Review['status'],
    version: number,
    actor: string,
    canonicalHash: Buffer,
    contentDigest: Buffer
  ) {
    let result: unknown;
    if (version === 0) {
      if (decision !== 'REVIEWING') fail(409, 'BATCH_REVIEW_STATE_CONFLICT');
      result = await this.db.manager.query(
        `INSERT INTO collect.batch_review(item_id,item_version,source_key,source_post_key,canonical_url_hash,status,updated_by,content_digest)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(item_id) DO NOTHING RETURNING *`,
        [
          item.id,
          item.version,
          item.source_key,
          item.source_post_key,
          canonicalHash,
          decision,
          actor,
          contentDigest,
        ]
      );
    } else
      result = await this.db.manager.query(
        `WITH changed AS (UPDATE collect.batch_review SET content_digest=$6,status=$1,item_version=$2,lock_version=lock_version+1,updated_by=$3,updated_at=now()
      WHERE item_id=$4 AND lock_version=$5 AND post_id IS NULL RETURNING *) SELECT * FROM changed`,
        [decision, item.version, actor, item.id, version, contentDigest]
      );
    const row = rows(result)[0];
    if (!row) fail(409, 'BATCH_REVIEW_VERSION_CONFLICT');
    return review(row);
  }
  async promote(id: string, version: number, postId: number, actor: string) {
    const row = rows(
      await this.db.manager.query(
        `WITH changed AS (UPDATE collect.batch_review SET post_id=$1,lock_version=lock_version+1,updated_by=$2,updated_at=now()
      WHERE item_id=$3 AND lock_version=$4 AND status='APPROVED' AND post_id IS NULL RETURNING *) SELECT * FROM changed`,
        [postId, actor, id, version]
      )
    )[0];
    if (!row) fail(409, 'BATCH_REVIEW_VERSION_CONFLICT');
    return review(row);
  }
  async existingPost(url: string) {
    const urls = [url];
    try {
      urls.push(decodeURI(url));
    } catch {
      /* Keep a valid encoded URL when its literal percent cannot be decoded. */
    }
    const row = rows(
      await this.db.manager.query(
        'SELECT id FROM content.board_post WHERE source_url=ANY($1::text[]) ORDER BY id LIMIT 1',
        [urls]
      )
    )[0];
    return row ? String(row.id) : null;
  }
  async receipt(actor: string, scope: string, key: string) {
    const row = rows(
      await this.db.manager.query(
        'SELECT * FROM collect.batch_review_request WHERE actor=$1 AND scope=$2 AND request_key=$3',
        [actor, scope, key]
      )
    )[0];
    if (!row) return null;
    if (!Buffer.isBuffer(row.digest)) throw Error('INVALID_RECEIPT_HASH');
    return { hash: row.digest, status: Number(row.response_status), data: row.response_data };
  }
  async saveReceipt(
    actor: string,
    scope: string,
    key: string,
    hash: Buffer,
    status: number,
    data: unknown
  ) {
    await this.db.manager.query(
      'INSERT INTO collect.batch_review_request(actor,scope,request_key,digest,response_status,response_data) VALUES($1,$2,$3,$4,$5,$6)',
      [actor, scope, key, hash, status, JSON.stringify(data)]
    );
  }
}
