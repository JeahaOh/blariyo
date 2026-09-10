import { Inject, Injectable } from '@nestjs/common';
import { PostsRepository } from '../features/posts/posts.repository.js';
import type {
  PostRecord,
  CreatePost,
  EditBlock,
  PostSearch,
  EditorBlock,
  DuePost,
  PostStatus,
} from '../features/posts/posts.model.js';
import { DatabaseContext } from './database.js';
import {
  ContentBoardPostEntity,
  ContentBoardEntity,
  ContentBoardPostBlockEntity,
  ContentBoardPostImageEntity,
  ContentBoardPostStatusHistoryEntity,
} from './entities.js';
import { requiredRow, decimalId } from './rows.js';
function status(value: string): PostStatus {
  switch (value) {
    case 'DRAFT':
    case 'SCHEDULED':
    case 'PUBLISHED':
    case 'HIDDEN_REVIEW':
    case 'REMOVED':
      return value;
    default:
      throw new Error('INVALID_POST_STATUS');
  }
}
function mapPost(row: ContentBoardPostEntity, slug: string): PostRecord {
  return {
    id: row.id,
    boardId: row.board_id,
    slug,
    title: row.title,
    status: status(row.status),
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    pinnedPosition: row.pinned_position,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    lockVersion: row.lock_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
@Injectable()
export class TypeOrmPostsRepository extends PostsRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async find(id: string, lock = false): Promise<PostRecord | null> {
    const query = this.db.manager
      .createQueryBuilder(ContentBoardPostEntity, 'p')
      .where('p.id = :id', { id });
    if (lock) query.setLock('pessimistic_write');
    const row = await query.getOne();
    if (!row) return null;
    const board = await this.db.manager.findOneByOrFail(ContentBoardEntity, { id: row.board_id });
    return mapPost(row, board.slug);
  }
  async postingBoard(slug: string) {
    const board = await this.db.manager.findOneBy(ContentBoardEntity, {
      slug,
      is_active: true,
      posting_policy: 'ADMIN',
    });
    return board ? { id: board.id, slug: board.slug } : null;
  }
  async create(
    boardId: string,
    slug: string,
    body: CreatePost,
    actor: string
  ): Promise<PostRecord> {
    const result = await this.db.manager.createQueryBuilder().insert().into(ContentBoardPostEntity)
      .values({ board_id: boardId, title: body.title.trim(), source_name: body.source?.name.trim() || null, source_url: body.source?.url || null,
        status: 'DRAFT', pinned_position: body.pinnedPosition, created_by: actor, created_at: () => 'now()', updated_by: actor, updated_at: () => 'now()' })
      .returning('id').execute();
    const row = await this.db.manager.findOneByOrFail(ContentBoardPostEntity, {
      id: decimalId(requiredRow(result.raw).id),
    });
    return mapPost(row, slug);
  }
  async update(post: PostRecord, actor: string, publishNow: boolean) {
    const changed = await this.db.manager.createQueryBuilder().update(ContentBoardPostEntity)
      .set({ title: post.title, source_name: post.sourceName, source_url: post.sourceUrl, status: post.status,
        pinned_position: post.pinnedPosition, scheduled_at: post.scheduledAt, published_at: publishNow ? () => 'statement_timestamp()' : post.publishedAt,
        lock_version: () => 'lock_version+1', updated_by: actor, updated_at: () => 'now()' })
      .where('id=:id', { id: post.id }).execute();
    if (changed.affected !== 1) throw new Error('MISSING_UPDATED_POST');
    return mapPost(
      await this.db.manager.findOneByOrFail(ContentBoardPostEntity, { id: post.id }),
      post.slug
    );
  }
  async deleteBlocks(postId: string) {
    await this.db.manager.delete(ContentBoardPostBlockEntity, { post_id: postId });
  }
  async addBlock(postId: string, position: number, block: EditBlock, actor: string) {
    await this.db.manager.createQueryBuilder().insert().into(ContentBoardPostBlockEntity)
      .values({ post_id: postId, position, type: block.type, text_content: block.type === 'TEXT' ? block.text.trim() : null,
        image_id: block.type === 'IMAGE' ? String(block.imageId) : null, alt_text: block.type === 'IMAGE' ? block.alt.trim() : null,
        created_by: actor, created_at: () => 'now()', updated_by: actor, updated_at: () => 'now()' }).execute();
  }
  async history(post: PostRecord, from: PostStatus | null, reason: string, actor: string) {
    await this.db.manager.createQueryBuilder().insert().into(ContentBoardPostStatusHistoryEntity)
      .values({ post_id: post.id, from_status: from, to_status: post.status, reason_code: reason,
        actor_type: actor.startsWith('admin:') ? 'ADMIN' : 'SYSTEM', created_by: actor, created_at: () => 'now()', updated_by: actor, updated_at: () => 'now()' }).execute();
  }
  async search(query: PostSearch) {
    const builder = this.db.manager
      .createQueryBuilder(ContentBoardPostEntity, 'p')
      .innerJoin(ContentBoardEntity, 'b', 'b.id = p.board_id');
    if (query.status) builder.andWhere('p.status = :status', { status: query.status });
    if (query.board) builder.andWhere('b.slug = :board', { board: query.board });
    if (query.titlePrefix)
      builder.andWhere("p.title LIKE :prefix ESCAPE '\\'", {
        prefix: query.titlePrefix.trim().replace(/[\\%_]/g, '\\$&') + '%',
      });
    if (query.from) builder.andWhere('p.updated_at >= :from', { from: query.from });
    if (query.to) builder.andWhere('p.updated_at <= :to', { to: query.to });
    const total = await builder.getCount();
    const result = await builder
      .orderBy('p.updated_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(50)
      .offset((Number(query.page || 1) - 1) * 50)
      .getMany();
    const boards = await this.db.manager.find(ContentBoardEntity);
    const byId = new Map(boards.map((board) => [board.id, board.slug]));
    return {
      items: result.map((row) => {
        const slug = byId.get(row.board_id);
        if (!slug) throw new Error('MISSING_BOARD');
        return mapPost(row, slug);
      }),
      total,
    };
  }
  async editorBlocks(postId: string): Promise<EditorBlock[]> {
    const blocks = await this.db.manager.find(ContentBoardPostBlockEntity, {
      where: { post_id: postId },
      order: { position: 'ASC' },
    });
    const images = await this.db.manager.find(ContentBoardPostImageEntity, {
      where: { post_id: postId },
    });
    const byId = new Map(images.map((image) => [image.id, image]));
    return blocks.map((block) => {
      if (block.type !== 'TEXT' && block.type !== 'IMAGE') throw new Error('INVALID_BLOCK');
      const image = block.image_id ? byId.get(block.image_id) : undefined;
      return {
        type: block.type,
        text: block.text_content,
        imageId: block.image_id,
        alt: block.alt_text,
        imageStatus: image?.status ?? null,
        width: image?.width ?? null,
        height: image?.height ?? null,
      };
    });
  }
  async due(): Promise<DuePost[]> {
    const result = await this.db.manager
      .createQueryBuilder(ContentBoardPostEntity, 'p')
      .where("p.status='SCHEDULED' AND p.scheduled_at<=now()")
      .orderBy('p.scheduled_at', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .getMany();
    return result.map((row) => {
      if (!row.scheduled_at) throw new Error('INVALID_SCHEDULED_POST');
      return { id: row.id, lockVersion: row.lock_version, scheduledAt: row.scheduled_at };
    });
  }
  async cancelConflictedSchedule(id: string, lockVersion: number) {
    const result = await this.db.manager.createQueryBuilder().update(ContentBoardPostEntity)
      .set({ status: 'DRAFT', scheduled_at: null, lock_version: () => 'lock_version+1', updated_by: 'system:scheduler', updated_at: () => 'now()' })
      .where("id=:id AND status='SCHEDULED' AND lock_version=:lockVersion", { id, lockVersion }).execute();
    if (result.affected !== 1) return null;
    return this.find(id);
  }
  async recordScheduleFailure(post: DuePost, code: string, attemptedAt: Date) {
    await this.db.manager.query(
      `INSERT INTO ops.schedule_failure_alert(post_id,scheduled_at,error_code,attempt_count,first_attempt_at,last_attempt_at)
      VALUES($1,$2,$3,1,$4,$4) ON CONFLICT(post_id,scheduled_at,error_code) DO UPDATE SET
      attempt_count=schedule_failure_alert.attempt_count+1,last_attempt_at=GREATEST(schedule_failure_alert.last_attempt_at,$4),updated_at=now()`,
      [post.id, post.scheduledAt, code, attemptedAt]
    );
  }
}
