import { Inject, Injectable } from '@nestjs/common';
import {
  ImagesRepository,
  type Image,
  type NewImage,
  type ImageStatus,
} from '../features/images/images.repository.js';
import { DatabaseContext } from './database.js';
import { ContentBoardPostImageEntity } from './entities.js';
import { requiredRow, decimalId } from './rows.js';
function status(value: string): ImageStatus {
  switch (value) {
    case 'STAGED':
    case 'PUBLIC':
    case 'PUBLIC_DELETE_PENDING':
    case 'PRIVATE_REVIEW':
    case 'PRIVATE_DELETE_PENDING':
    case 'DELETED':
      return value;
    default:
      throw new Error('INVALID_IMAGE_STATUS');
  }
}
@Injectable()
export class TypeOrmImagesRepository extends ImagesRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async create(image: NewImage) {
    const result = await this.db.manager
      .createQueryBuilder()
      .insert()
      .into(ContentBoardPostImageEntity)
      .values({
        private_storage_key: image.key,
        status: 'STAGED',
        content_sha256: image.hash,
        mime_type: image.mime,
        byte_size: image.byteSize,
        width: image.width,
        height: image.height,
        created_by: image.actor,
        created_at: () => 'now()',
        updated_by: image.actor,
        updated_at: () => 'now()',
      })
      .returning('id')
      .execute();
    return decimalId(requiredRow(result.raw).id);
  }
  async find(id: string, lock = false): Promise<Image | null> {
    const query = this.db.manager
      .createQueryBuilder(ContentBoardPostImageEntity, 'i')
      .where('i.id = :id', { id });
    if (lock) query.setLock('pessimistic_write');
    const row = await query.getOne();
    return row
      ? {
          id: row.id,
          postId: row.post_id,
          privateKey: row.private_storage_key,
          publicKey: row.public_storage_key,
          status: status(row.status),
          hash: row.content_sha256,
          mime: row.mime_type,
          byteSize: row.byte_size,
          width: row.width,
          height: row.height,
        }
      : null;
  }
  async byPublicKey(key: string): Promise<Image | null> {
    const row = await this.db.manager.findOneBy(ContentBoardPostImageEntity, {
      public_storage_key: key,
    });
    return row ? this.find(row.id) : null;
  }
  async transitionStatus(
    id: string,
    expected: ImageStatus,
    next: ImageStatus,
    actor: string,
    clearPublic = false
  ): Promise<void> {
    await this.db.manager
      .createQueryBuilder()
      .update(ContentBoardPostImageEntity)
      .set({
        status: next,
        ...(clearPublic ? { public_storage_key: null } : {}),
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('id=:id AND status=:expected', { id, expected })
      .execute();
  }
  async attached(postId: string): Promise<Image[]> {
    const values = await this.db.manager.find(ContentBoardPostImageEntity, {
      where: { post_id: postId },
      order: { id: 'ASC' },
    });
    return values.map((row) => ({
      id: row.id,
      postId: row.post_id,
      privateKey: row.private_storage_key,
      publicKey: row.public_storage_key,
      status: status(row.status),
      hash: row.content_sha256,
      mime: row.mime_type,
      byteSize: row.byte_size,
      width: row.width,
      height: row.height,
    }));
  }
  async update(image: Image, actor: string): Promise<void> {
    await this.db.manager
      .createQueryBuilder()
      .update(ContentBoardPostImageEntity)
      .set({
        post_id: image.postId,
        status: image.status,
        public_storage_key: image.publicKey,
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('id=:id', { id: image.id })
      .execute();
  }
  async markPrivateDelete(id: string, actor: string): Promise<void> {
    await this.db.manager
      .createQueryBuilder()
      .update(ContentBoardPostImageEntity)
      .set({ status: 'PRIVATE_DELETE_PENDING', updated_by: actor, updated_at: () => 'now()' })
      .where('id=:id', { id })
      .execute();
  }
}
