import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile, realpath, stat } from 'node:fs/promises';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';
import { DatabaseContext } from '../../apps/api/dist/persistence/database.js';
import { UnitOfWork } from '../../apps/api/dist/shared/unit-of-work.js';
import { PostsRepository } from '../../apps/api/dist/features/posts/posts.repository.js';
import { ImagesRepository } from '../../apps/api/dist/features/images/images.repository.js';
import {
  ACTOR,
  digest,
  originalDirectory,
  prepareOriginals,
  stageOriginalBlocks,
} from './original-import.mjs';

assert.deepEqual(process.argv.slice(2), ['--apply']);
// Fixed, observed disposable fixture backing the URL supplied by the user.
const databaseUrl = 'postgresql://postgres@127.0.0.1:55449/m0_browser_f3351c5d9ee9';
const origin = 'http://127.0.0.1:59689';
const root = await realpath(
  '/private/var/folders/b1/5z_mft5s4z951slpv9q20nfc0000gq/T/blariyo-browser-jYgXTU'
);
assert.ok(root.endsWith('/T/blariyo-browser-jYgXTU') && (await stat(root)).isDirectory());
const { snapshot, bundle, prepared } = await prepareOriginals();
const storage = localStorage(root);
const app = await createNestApplication({
  databaseUrl,
  storage,
  localMedia: true,
  serviceToken: randomBytes(32).toString('hex'),
});
const db = app.get(DatabaseContext),
  work = app.get(UnitOfWork);
const posts = app.get(PostsRepository),
  images = app.get(ImagesRepository);
const privateKeys = [],
  publicKeys = [];
const rows = [];
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = new URL(`preview-backup-${stamp}.json`, originalDirectory);
let committed = false;
try {
  await work.transaction(async () => {
    await db.manager.query(
      "SELECT pg_advisory_xact_lock(hashtext('blariyo-preview-originals-20260920'))"
    );
    const targets = await db.manager.query(
      'SELECT * FROM content.board_post ORDER BY id FOR UPDATE'
    );
    assert.equal(targets.length, 25);
    assert.deepEqual(
      new Set(targets.map((post) => post.source_url)),
      new Set(bundle.items.map((post) => post.sourceUrl))
    );
    assert.ok(targets.every((post) => post.status === 'PUBLISHED'));
    const oldBlocks = await db.manager.query(
      'SELECT * FROM content.board_post_block ORDER BY post_id,position'
    );
    assert.equal(
      (await db.manager.query('SELECT count(*)::int AS n FROM content.board_post_image'))[0].n,
      0,
      'Preview already contains images; do not overwrite editor work'
    );
    await writeFile(
      backup,
      JSON.stringify(
        { database: 'loopback:55449/m0_browser_f3351c5d9ee9', posts: targets, blocks: oldBlocks },
        null,
        2
      ) + '\n',
      { mode: 0o600 }
    );
    for (const source of snapshot.posts) {
      const target = targets.find((post) => post.source_url === source.sourceUrl);
      const previous = oldBlocks.filter((block) => block.post_id === target.id);
      assert.equal(previous.length, 1);
      assert.equal(
        previous[0].text_content,
        bundle.items.find((post) => post.sourceUrl === source.sourceUrl).summary
      );
      const staged = await stageOriginalBlocks(
        app,
        source,
        prepared,
        `preview-${target.id}-${digest(JSON.stringify(source)).slice(0, 16)}`,
        privateKeys
      );
      await posts.deleteBlocks(target.id);
      const expectedImages = [];
      for (const [index, block] of staged.blocks.entries()) {
        if (block.type === 'IMAGE') {
          const image = await images.find(String(block.imageId), true);
          const ext = image.mime.split('/')[1].replace('jpeg', 'jpg');
          const key = `posts/${target.id}/${image.id}-${image.hash.toString('hex')}.${ext}`;
          await storage.promote(image.privateKey, key);
          publicKeys.push(key);
          await images.update(
            { ...image, postId: target.id, status: 'PUBLIC', publicKey: key },
            ACTOR
          );
          expectedImages.push({
            url: `${origin}/media/${key}`,
            sha256: image.hash.toString('hex'),
            mime: image.mime,
            width: image.width,
            height: image.height,
          });
        }
        await posts.addBlock(target.id, index + 1, block, ACTOR);
      }
      const post = await posts.find(target.id, true);
      const updated = await posts.update(post, ACTOR, false);
      await posts.history(updated, 'PUBLISHED', 'EDIT', ACTOR);
      rows.push({
        postId: target.id,
        sourceUrl: source.sourceUrl,
        blocks: staged.blocks,
        images: expectedImages,
      });
    }
  });
  committed = true;
} finally {
  if (!committed) {
    for (const key of publicKeys) await storage.delete('public', key);
    for (const key of privateKeys) await storage.delete('private', key);
  }
  await app.close();
}
for (const row of rows) {
  const response = await fetch(`${origin}/api/v1/boards/meme/posts/${row.postId}`, {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  const data = (await response.json()).data.post;
  assert.equal(data.source.url, row.sourceUrl);
  assert.equal(data.blocks.length, row.blocks.length);
  for (const [index, expected] of row.blocks.entries()) {
    assert.equal(data.blocks[index].type, expected.type);
    if (expected.type === 'TEXT') assert.equal(data.blocks[index].text, expected.text.trim());
  }
  for (const image of row.images) {
    const file = await fetch(image.url, { signal: AbortSignal.timeout(20000) });
    assert.equal(file.status, 200, 'Preview image failed');
    assert.ok(file.headers.get('content-type')?.startsWith(image.mime));
    assert.equal(
      digest(Buffer.from(await file.arrayBuffer())),
      image.sha256,
      'Preview image bytes differ from imported bytes'
    );
  }
  row.httpReadback = 'PASS';
}
const report = new URL(`preview-result-${stamp}.json`, originalDirectory);
await writeFile(
  report,
  JSON.stringify(
    { origin, backup: backup.pathname, rows, verifiedAt: new Date().toISOString() },
    null,
    2
  ) + '\n',
  { mode: 0o600 }
);
console.log(
  JSON.stringify({
    posts: rows.length,
    images: rows.reduce((n, row) => n + row.images.length, 0),
    httpReadback: 'PASS',
    example: `${origin}/meme/posts/9`,
    report: report.pathname,
  })
);
