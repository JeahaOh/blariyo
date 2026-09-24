import { Inject, Injectable } from '@nestjs/common';
import { PUBLIC_ORIGINS, type PublicOrigins } from './public.dto.js';
import { SitemapRepository, SITEMAP_MAX_SHARDS, SITEMAP_SHARD_SIZE } from './sitemap.repository.js';
import { SitemapCache } from './sitemap-cache.js';
import { ApiError, fail } from '../../shared/errors.js';

const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c
  );
const MAX_ID = 9223372036854775807n;

@Injectable()
export class SitemapService {
  private readonly cache = new SitemapCache();
  private readonly origin: string;
  constructor(
    @Inject(SitemapRepository) private readonly repository: SitemapRepository,
    @Inject(PUBLIC_ORIGINS) origins: PublicOrigins
  ) {
    const url = new URL(origins.siteOrigin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('INVALID_SITEMAP_ORIGIN');
    this.origin = url.origin;
  }
  document(name: string): Promise<Buffer> {
    if (
      name !== 'index.xml' &&
      name !== 'pages.xml' &&
      !/^posts-(0|[1-9][0-9]{0,14})\.xml$/.test(name)
    )
      fail(404, 'POST_NOT_FOUND');
    return this.cache.get(name, () => this.generate(name));
  }
  private xml(root: 'urlset' | 'sitemapindex', entries: string[]) {
    if (entries.length > 50000) throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE');
    const body = Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</${root}>\n`
    );
    if (body.length > 50 * 1024 * 1024) throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE');
    return body;
  }
  private loc(path: string) {
    return `<loc>${escapeXml(this.origin + path)}</loc>`;
  }
  private async generate(name: string): Promise<Buffer> {
    if (name === 'index.xml') {
      const shards = await this.repository.shards();
      if (shards.length > SITEMAP_MAX_SHARDS) throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE');
      return this.xml('sitemapindex', [
        `<sitemap>${this.loc('/sitemap-pages.xml')}</sitemap>`,
        ...shards.map((shard) => `<sitemap>${this.loc(`/sitemap-posts-${shard}.xml`)}</sitemap>`),
      ]);
    }
    if (name === 'pages.xml') {
      const paths = await this.repository.pages();
      if (paths.length >= 10000) throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE');
      return this.xml(
        'urlset',
        paths.map((path) => `<url>${this.loc(path)}</url>`)
      );
    }
    const shard = BigInt(name.slice(6, -4));
    const first = shard * BigInt(SITEMAP_SHARD_SIZE) + 1n;
    if (first > MAX_ID) fail(404, 'POST_NOT_FOUND');
    const end = first + BigInt(SITEMAP_SHARD_SIZE) - 1n;
    const posts = await this.repository.posts(String(first), String(end > MAX_ID ? MAX_ID : end));
    if (!posts.length) fail(404, 'POST_NOT_FOUND');
    return this.xml(
      'urlset',
      posts.map(
        (post) =>
          `<url>${this.loc(`/${post.slug}/posts/${post.id}`)}<lastmod>${post.modifiedAt.toISOString()}</lastmod></url>`
      )
    );
  }
}
