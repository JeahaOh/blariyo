import { Inject, Injectable } from '@nestjs/common';
import { DatabaseContext } from './database.js';
import {
  ContentBoardEntity,
  ContentBoardPostEntity,
  LegalPolicyVersionEntity,
} from './entities.js';
import {
  SitemapRepository,
  SITEMAP_MAX_SHARDS,
  SITEMAP_SHARD_SIZE,
} from '../features/public/sitemap.repository.js';

@Injectable()
export class TypeOrmSitemapRepository extends SitemapRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  private visible() {
    return this.db.manager
      .createQueryBuilder(ContentBoardPostEntity, 'p')
      .innerJoin(ContentBoardEntity, 'b', 'b.id = p.board_id AND b.is_active = true')
      .where("p.status = 'PUBLISHED' AND p.published_at <= now()");
  }
  async shards() {
    const bucket = `(p.id - 1) / ${SITEMAP_SHARD_SIZE}`;
    const rows = await this.visible()
      .select(`(${bucket})::text`, 'shard')
      .groupBy(bucket)
      .orderBy(bucket, 'ASC')
      .limit(SITEMAP_MAX_SHARDS + 1)
      .getRawMany<{ shard: string }>();
    return rows.map((row) => row.shard);
  }
  async pages() {
    const boards = await this.db.manager.find(ContentBoardEntity, {
      select: { slug: true },
      where: { is_active: true },
      order: { display_order: 'ASC' },
      take: 10000,
    });
    const policies = await this.db.manager
      .createQueryBuilder(LegalPolicyVersionEntity, 'p')
      .select('p.policy_type', 'type')
      .where(
        "p.status = 'EFFECTIVE' AND p.effective_at <= now() AND p.policy_type IN ('TERMS', 'PRIVACY')"
      )
      .distinct(true)
      .getRawMany<{ type: string }>();
    return [
      ...boards.map((board) => `/${board.slug}`),
      ...policies.map((policy) => (policy.type === 'TERMS' ? '/terms' : '/privacy')),
    ];
  }
  posts(firstId: string, lastId: string) {
    return this.visible()
      .select('p.id::text', 'id')
      .addSelect('b.slug', 'slug')
      .addSelect('GREATEST(p.updated_at, p.published_at)', 'modifiedAt')
      .andWhere('p.id BETWEEN :firstId AND :lastId', { firstId, lastId })
      .orderBy('p.id', 'ASC')
      .limit(SITEMAP_SHARD_SIZE)
      .getRawMany<{ id: string; slug: string; modifiedAt: Date }>();
  }
}
