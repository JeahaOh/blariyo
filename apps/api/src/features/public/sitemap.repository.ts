export const SITEMAP_SHARD_SIZE = 10000;
export const SITEMAP_MAX_SHARDS = 49999;
export interface SitemapPost {
  id: string;
  slug: string;
  modifiedAt: Date;
}
export abstract class SitemapRepository {
  abstract shards(): Promise<string[]>;
  abstract pages(): Promise<string[]>;
  abstract posts(firstId: string, lastId: string): Promise<SitemapPost[]>;
}
