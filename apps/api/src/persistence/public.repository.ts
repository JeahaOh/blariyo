import { Inject, Injectable } from '@nestjs/common';
import { IsNull, Not, Raw } from 'typeorm';
import { DatabaseContext } from './database.js';
import {
  ContentBoardEntity,
  ContentBoardPostEntity,
  ContentBoardPostBlockEntity,
  ContentBoardPostImageEntity,
  LegalPolicyVersionEntity,
  type ContentBoardRow,
  type ContentBoardPostRow,
} from './entities.js';
import {
  PublicRepository,
  type Board,
  type PublishedPost,
  type PublishedBlock,
  type PublishedPolicy,
} from '../features/public/public.repository.js';

function board(row: ContentBoardRow): Board {
  if (row.posting_policy !== 'ADMIN' && row.posting_policy !== 'USER')
    throw new Error('INVALID_BOARD_POLICY');
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    postingPolicy: row.posting_policy,
  };
}
function post(row: ContentBoardPostRow): PublishedPost {
  if (!row.published_at) throw new Error('INVALID_PUBLISHED_POST');
  return {
    id: row.id,
    title: row.title,
    viewCount: row.view_count,
    publishedAt: row.published_at,
    pinnedPosition: row.pinned_position,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
  };
}
const visible = () => ({ status: 'PUBLISHED', published_at: Raw((alias) => `${alias} <= now()`) });

@Injectable()
export class TypeOrmPublicRepository extends PublicRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async activeBoards() {
    return (
      await this.db.manager.find(ContentBoardEntity, {
        where: { is_active: true },
        order: { display_order: 'ASC' },
      })
    ).map(board);
  }
  async activeBoard(slug: string) {
    const row = await this.db.manager.findOneBy(ContentBoardEntity, { slug, is_active: true });
    return row ? board(row) : null;
  }
  countPosts(boardId: string) {
    return this.db.manager.count(ContentBoardPostEntity, {
      where: { board_id: boardId, ...visible(), pinned_position: IsNull() },
    });
  }
  async pinnedPosts(boardId: string) {
    return (
      await this.db.manager.find(ContentBoardPostEntity, {
        where: { board_id: boardId, ...visible(), pinned_position: Not(IsNull()) },
        order: { pinned_position: 'ASC' },
      })
    ).map(post);
  }
  async pagePosts(boardId: string, offset: number) {
    return (
      await this.db.manager.find(ContentBoardPostEntity, {
        where: { board_id: boardId, ...visible(), pinned_position: IsNull() },
        order: { published_at: 'DESC', id: 'DESC' },
        take: 20,
        skip: offset,
      })
    ).map(post);
  }
  async post(boardId: string, postId: string) {
    const row = await this.db.manager.findOneBy(ContentBoardPostEntity, {
      id: postId,
      board_id: boardId,
      ...visible(),
    });
    return row ? post(row) : null;
  }
  async rank(boardId: string, value: PublishedPost) {
    return this.db.manager
      .createQueryBuilder(ContentBoardPostEntity, 'p')
      .where('p.board_id = :boardId', { boardId })
      .andWhere("p.status = 'PUBLISHED' AND p.published_at <= now() AND p.pinned_position IS NULL")
      .andWhere('(p.published_at, p.id) > (:publishedAt, :id)', {
        publishedAt: value.publishedAt,
        id: value.id,
      })
      .getCount();
  }
  async blocks(postId: string): Promise<PublishedBlock[]> {
    const blocks = await this.db.manager.find(ContentBoardPostBlockEntity, {
      where: { post_id: postId },
      order: { position: 'ASC' },
    });
    // A single image query for all blocks prevents per-block database requests.
    const images = await this.db.manager.find(ContentBoardPostImageEntity, {
      where: { post_id: postId },
    });
    const byId = new Map(images.map((image) => [image.id, image]));
    return blocks.map((block) => {
      if (block.type === 'TEXT' && block.text_content !== null)
        return { type: 'TEXT', text: block.text_content };
      const image = block.image_id === null ? undefined : byId.get(block.image_id);
      if (block.type !== 'IMAGE' || !image?.public_storage_key || block.alt_text === null)
        throw new Error('INVALID_PUBLISHED_BLOCK');
      return {
        type: 'IMAGE',
        key: image.public_storage_key,
        alt: block.alt_text,
        width: image.width,
        height: image.height,
      };
    });
  }
  async incrementView(slug: string, postId: string) {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(ContentBoardPostEntity)
      .set({ view_count: () => 'view_count + 1' })
      .where("id = :postId AND status = 'PUBLISHED' AND published_at <= now()", { postId })
      .andWhere('board_id IN (SELECT id FROM content.board WHERE slug = :slug AND is_active)', {
        slug,
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }
  async policies(type: 'TERMS' | 'PRIVACY'): Promise<PublishedPolicy[]> {
    const rows = await this.db.manager
      .createQueryBuilder(LegalPolicyVersionEntity, 'p')
      .where('p.policy_type = :type', { type })
      .andWhere("p.status IN ('EFFECTIVE','RETIRED') AND p.effective_at <= now()")
      .orderBy('p.effective_at', 'DESC')
      .getMany();
    return rows.map((row) => {
      if (!row.effective_at || (row.status !== 'EFFECTIVE' && row.status !== 'RETIRED'))
        throw new Error('INVALID_PUBLIC_POLICY');
      return {
        version: row.version_label,
        effectiveAt: row.effective_at,
        endedAt: row.ended_at,
        status: row.status,
        title: row.title,
        bodyHtml: row.body_html,
      };
    });
  }
}
