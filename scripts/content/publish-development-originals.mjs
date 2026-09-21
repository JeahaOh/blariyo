import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';
import { PostsService } from '../../apps/api/dist/features/posts/posts.service.js';

assert.deepEqual(process.argv.slice(2), ['--apply']);
const databaseUrl = 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local';
const origin = 'http://127.0.0.1:3000';
const directory = new URL('../../.local-data/content-review/originals-20260920/', import.meta.url);
const bundle = JSON.parse(
  await readFile(new URL('./community-hot-20260920.json', import.meta.url), 'utf8')
);
const urls = bundle.items.map((item) => item.sourceUrl);
assert.equal(new Set(urls).size, 25);
assert.equal((await fetch(origin + '/meme')).status, 200);
const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const report = { origin, database: 'loopback:5439/blariyo_local', rows: [] };
const result = new URL(`development-publish-result-${stamp}.json`, directory);
const save = () => writeFile(result, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
let app;
try {
  await db.query('BEGIN READ ONLY');
  const posts = (
    await db.query(
      'SELECT * FROM content.board_post WHERE source_url=ANY($1::text[]) ORDER BY id',
      [urls]
    )
  ).rows;
  assert.equal(posts.length, 25);
  assert.ok(posts.every((post) => ['DRAFT', 'PUBLISHED'].includes(post.status)));
  const ids = posts.map((post) => post.id);
  const blocks = (
    await db.query(
      'SELECT * FROM content.board_post_block WHERE post_id=ANY($1::bigint[]) ORDER BY post_id,position',
      [ids]
    )
  ).rows;
  const images = (
    await db.query(
      'SELECT * FROM content.board_post_image WHERE post_id=ANY($1::bigint[]) ORDER BY id',
      [ids]
    )
  ).rows;
  assert.equal(blocks.length, 186);
  assert.equal(images.length, 105);
  const captures = (
    await db.query(
      'SELECT DISTINCT ON(post_id) post_id,capture FROM scrape_archive.source_capture WHERE post_id=ANY($1::bigint[]) ORDER BY post_id,id DESC',
      [ids]
    )
  ).rows;
  assert.equal(captures.length, 25);
  assert.ok(
    captures.every((row) => row.capture.status === 'FETCHED' && !row.capture.issues.length)
  );
  await db.query('ROLLBACK');
  const backup = new URL(`development-before-publish-${stamp}.json`, directory);
  await writeFile(backup, JSON.stringify({ posts, blocks, images }, null, 2) + '\n', {
    mode: 0o600,
  });
  report.backup = backup.pathname;
  app = await createNestApplication({
    databaseUrl,
    serviceToken: randomBytes(32).toString('hex'),
    storage: localStorage(resolve('.local-data/media')),
    localMedia: true,
    siteOrigin: origin,
    imageOrigin: origin + '/media',
  });
  const service = app.get(PostsService);
  for (const post of posts) {
    if (post.status === 'DRAFT') {
      const published = await service.command(
        {
          action: 'publish',
          params: { postId: post.id },
          body: { lockVersion: post.lock_version, mode: 'IMMEDIATE' },
        },
        'system:collector'
      );
      assert.equal(published.data.status, 'PUBLISHED');
    }
    report.rows.push({
      postId: post.id,
      sourceUrl: post.source_url,
      action: post.status === 'DRAFT' ? 'PUBLISHED' : 'UNCHANGED',
    });
    await save();
  }
  const currentBlocks = (
    await db.query(
      'SELECT * FROM content.board_post_block WHERE post_id=ANY($1::bigint[]) ORDER BY post_id,position',
      [ids]
    )
  ).rows;
  assert.deepEqual(currentBlocks, blocks, 'Publication must preserve original content');
  const currentPosts = (
    await db.query('SELECT status FROM content.board_post WHERE id=ANY($1::bigint[])', [ids])
  ).rows;
  assert.ok(currentPosts.every((post) => post.status === 'PUBLISHED'));
  const publicImages = (
    await db.query(
      "SELECT public_storage_key,encode(content_sha256,'hex') hash FROM content.board_post_image WHERE post_id=ANY($1::bigint[]) AND status='PUBLIC'",
      [ids]
    )
  ).rows;
  assert.equal(publicImages.length, 105);
  for (const image of publicImages) {
    const response = await fetch(origin + '/media/' + image.public_storage_key, {
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200);
    assert.equal(
      createHash('sha256')
        .update(Buffer.from(await response.arrayBuffer()))
        .digest('hex'),
      image.hash
    );
  }
  const visibleIds = [];
  for (const page of [1, 2]) {
    const response = await fetch(origin + '/api/v1/boards/meme/posts?page=' + page);
    assert.equal(response.status, 200);
    const listing = await response.json();
    assert.equal(listing.meta.totalItems, 25);
    visibleIds.push(...listing.data.items.map((post) => String(post.id ?? post.postId)));
  }
  assert.deepEqual(new Set(visibleIds), new Set(ids));
  const sample = posts.find((post) => post.source_url === 'https://theqoo.net/hot/4350517965');
  report.summary = {
    published: 25,
    blocksPreserved: 186,
    publicImages: 105,
    mediaHashes: 'PASS',
    listPages: 2,
    sampleUrl: `${origin}/meme/posts/${sample.id}`,
    verifiedAt: new Date().toISOString(),
  };
  await save();
  console.log(JSON.stringify({ ...report.summary, report: result.pathname }));
} finally {
  await app?.close();
  await db.end();
}
