import test from 'node:test';
import assert from 'node:assert/strict';
import { SitemapCache } from '../dist/features/public/sitemap-cache.js';
import { SitemapService } from '../dist/features/public/sitemap.service.js';
import type { SitemapRepository } from '../dist/features/public/sitemap.repository.js';

const repository = (overrides: Partial<SitemapRepository> = {}): SitemapRepository => ({
  shards: async () => ['0', '2'],
  pages: async () => ['/meme', '/terms'],
  posts: async () => [{ id: '1', slug: 'meme', modifiedAt: new Date('2026-01-02T03:04:05Z') }],
  ...overrides,
});
const service = (repo = repository()) =>
  new SitemapService(repo, {
    siteOrigin: 'https://blariyo.com/',
    imageOrigin: 'https://media.blariyo.com',
  });

await test('sitemaps use canonical URLs, stable ID ranges, real modification times and no fake index dates', async () => {
  const calls: string[][] = [];
  const sitemap = service(
    repository({
      posts: async (first, last) => {
        calls.push([first, last]);
        return [{ id: first, slug: 'meme', modifiedAt: new Date('2026-01-02T03:04:05Z') }];
      },
    })
  );
  const index = (await sitemap.document('index.xml')).toString();
  assert.match(index, /<sitemapindex xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  assert.match(index, /https:\/\/blariyo.com\/sitemap-posts-2.xml/);
  assert.doesNotMatch(index, /lastmod|sitemap-posts-1.xml/);
  const posts = (await sitemap.document('posts-2.xml')).toString();
  assert.deepEqual(calls, [['20001', '30000']]);
  assert.match(posts, /<loc>https:\/\/blariyo.com\/meme\/posts\/20001<\/loc>/);
  assert.match(posts, /<lastmod>2026-01-02T03:04:05.000Z<\/lastmod>/);
  const pages = (await sitemap.document('pages.xml')).toString();
  assert.doesNotMatch(pages, /lastmod|cookie-settings|\/admin/);
  for (const name of [
    'posts-00.xml',
    'posts--1.xml',
    'posts-1.2.xml',
    '../index.xml',
    'posts-999999999999999.xml',
  ])
    await assert.rejects(async () => sitemap.document(name), { status: 404 });
});

await test('XML escapes URLs, bounds output and rejects empty chunks and invalid canonical origins', async () => {
  const xml = await service(repository({ pages: async () => ['/meme?q=a&b="<>\''] })).document(
    'pages.xml'
  );
  assert.match(xml.toString(), /a&amp;b=&quot;&lt;&gt;&apos;/);
  const large = await service(
    repository({
      posts: async () =>
        Array.from({ length: 10000 }, (_, i) => ({
          id: String(i + 1),
          slug: 'meme',
          modifiedAt: new Date('2026-01-01'),
        })),
    })
  ).document('posts-0.xml');
  assert.equal([...large.toString().matchAll(/<url>/g)].length, 10000);
  assert.ok(large.length < 50 * 1024 * 1024);
  await assert.rejects(service(repository({ posts: async () => [] })).document('posts-1.xml'), {
    status: 404,
  });
  await assert.rejects(
    service(
      repository({ shards: async () => Array.from({ length: 50000 }, (_, i) => String(i)) })
    ).document('index.xml'),
    { status: 503 }
  );
  for (const siteOrigin of [
    'https://blariyo.com/path',
    'https://user@blariyo.com',
    'file:///tmp',
    'https://blariyo.com/?a=1',
  ])
    assert.throws(
      () => new SitemapService(repository(), { siteOrigin, imageOrigin: '' }),
      /INVALID_SITEMAP_ORIGIN/
    );
});

await test('cache coalesces simultaneous requests, expires at five minutes and retries failures', async () => {
  let now = 0,
    calls = 0;
  const cache = new SitemapCache(() => now);
  const create = async () => {
    calls++;
    return Buffer.from(String(calls));
  };
  const responses = await Promise.all(Array.from({ length: 30 }, () => cache.get('a', create)));
  assert.equal(calls, 1);
  assert.ok(responses.every((body) => body.toString() === '1'));
  now = 299999;
  assert.equal((await cache.get('a', create)).toString(), '1');
  now = 300000;
  assert.equal((await cache.get('a', create)).toString(), '2');
  await assert.rejects(
    cache.get('fail', async () => {
      throw new Error('DB unavailable');
    })
  );
  assert.equal((await cache.get('fail', create)).toString(), '3');
});

await test('cache bounds concurrent generation, entries and retained bytes', async () => {
  const cache = new SitemapCache();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests = Array.from({ length: 4 }, (_, i) =>
    cache.get(String(i), async () => {
      await gate;
      return Buffer.from('ok');
    })
  );
  await assert.rejects(
    cache.get('fifth', async () => Buffer.from('bad')),
    { status: 503 }
  );
  release?.();
  await Promise.all(requests);
  let calls = 0;
  const small = async () => {
    calls++;
    return Buffer.from('ok');
  };
  for (let i = 0; i < 33; i++) await cache.get(`entry-${i}`, small);
  await cache.get('entry-0', small);
  assert.equal(calls, 34);
  for (let i = 0; i < 3; i++)
    await cache.get(`large-${i}`, async () => Buffer.alloc(6 * 1024 * 1024));
  await cache.get('large-0', small);
  assert.equal(calls, 35);
});
