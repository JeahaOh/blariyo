import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';
import { DatabaseContext } from '../../apps/api/dist/persistence/database.js';
import { UnitOfWork } from '../../apps/api/dist/shared/unit-of-work.js';
import { Storage } from '../../apps/api/dist/shared/storage.js';
import { PostsService } from '../../apps/api/dist/features/posts/posts.service.js';
import { PostsRepository } from '../../apps/api/dist/features/posts/posts.repository.js';
import { ImagesRepository } from '../../apps/api/dist/features/images/images.repository.js';
import {
  ACTOR,
  digest,
  originalDirectory,
  prepareOriginals,
  stageOriginalBlocks,
} from './original-import.mjs';

// Completion of the already imported fixed batch: three full X notes and two
// images whose current signed URLs were obtained from public source pages.
assert.deepEqual(process.argv.slice(2), ['--apply']);
const read = async (name) => JSON.parse(await readFile(new URL(name, originalDirectory), 'utf8'));
const mainBaseline = await read('replace-result-2026-09-20T07-15-10-271Z.json');
const previewBaseline = await read('preview-result-2026-09-20T07-15-47-431Z.json');
const { snapshot, prepared } = await prepareOriginals();
assert.ok(snapshot.posts.every((post) => post.status === 'FETCHED' && !post.issues.length));
const urls = ['4350535746', '4350319999', '4350416719'].map((id) => `https://theqoo.net/hot/${id}`);
const targets = snapshot.posts.filter((post) => urls.includes(post.sourceUrl));
assert.equal(targets.length, 3);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const report = { completedAt: null, databases: [], snapshot: 'snapshot.json' };
const reportFile = new URL(`completion-result-${stamp}.json`, originalDirectory);
const writeReport = () =>
  writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const normalized = (blocks) =>
  blocks.map((block) =>
    block.type === 'TEXT'
      ? { type: 'TEXT', text: (block.text ?? block.text_content).trim() }
      : {
          type: 'IMAGE',
          imageId: String(block.imageId ?? block.image_id),
          alt: block.alt ?? block.alt_text,
        }
  );
const configs = [
  {
    name: 'local',
    url: 'postgresql://blariyo_local@127.0.0.1:55439/blariyo_local',
    baseline: mainBaseline,
    status: 'DRAFT',
  },
  {
    name: 'preview',
    url: 'postgresql://postgres@127.0.0.1:55449/m0_browser_f3351c5d9ee9',
    baseline: previewBaseline,
    status: 'PUBLISHED',
    root: '/private/var/folders/b1/5z_mft5s4z951slpv9q20nfc0000gq/T/blariyo-browser-jYgXTU',
  },
];
for (const config of configs) {
  const app = await createNestApplication({
    databaseUrl: config.url,
    localMedia: true,
    serviceToken: randomBytes(32).toString('hex'),
    ...(config.root ? { storage: localStorage(config.root) } : {}),
  });
  const db = app.get(DatabaseContext),
    work = app.get(UnitOfWork),
    storage = app.get(Storage);
  const posts = app.get(PostsRepository),
    images = app.get(ImagesRepository);
  const privateKeys = [],
    publicKeys = [];
  const result = { database: config.name, committed: false, rows: [] };
  report.databases.push(result);
  try {
    await work.transaction(async () => {
      await db.manager.query(
        "SELECT pg_advisory_xact_lock(hashtext('blariyo-originals-completion-20260920'))"
      );
      const current = await db.manager.query(
        'SELECT * FROM content.board_post WHERE source_url=ANY($1::text[]) ORDER BY id FOR UPDATE',
        [urls]
      );
      assert.equal(current.length, 3);
      const ids = current.map((post) => post.id);
      const oldBlocks = await db.manager.query(
        'SELECT * FROM content.board_post_block WHERE post_id=ANY($1::bigint[]) ORDER BY post_id,position',
        [ids]
      );
      const oldImages = await db.manager.query(
        'SELECT * FROM content.board_post_image WHERE post_id=ANY($1::bigint[]) ORDER BY id',
        [ids]
      );
      const backup = new URL(`completion-backup-${config.name}-${stamp}.json`, originalDirectory);
      await writeFile(
        backup,
        JSON.stringify(
          { database: config.name, posts: current, blocks: oldBlocks, images: oldImages },
          null,
          2
        ) + '\n',
        { mode: 0o600 }
      );
      result.backup = backup.pathname;
      for (const source of targets) {
        const target = current.find((post) => post.source_url === source.sourceUrl);
        const baseline = config.baseline.rows.find((row) => row.sourceUrl === source.sourceUrl);
        const main = mainBaseline.rows.find((row) => row.sourceUrl === source.sourceUrl);
        assert.equal(target.status, config.status);
        assert.equal(target.id, baseline.postId);
        assert.deepEqual(
          normalized(oldBlocks.filter((block) => block.post_id === target.id)),
          normalized(baseline.blocks),
          'Preserve edits made since our import'
        );
        const existing = main.images.map((image) => ({
          ...image,
          imageId: String(baseline.blocks[image.blockPosition - 1].imageId),
        }));
        const captureHash = digest(JSON.stringify(source));
        const staged = await stageOriginalBlocks(
          app,
          source,
          prepared,
          `complete-${config.name}-${target.id}-${captureHash.slice(0, 16)}`,
          privateKeys,
          existing
        );
        assert.equal(staged.blocks.length, baseline.blocks.length);
        if (config.name === 'local') {
          const previous = (
            await db.manager.query(
              'SELECT capture FROM scrape_archive.source_capture WHERE post_id=$1 AND capture_sha256=$2',
              [target.id, main.captureHash]
            )
          )[0];
          assert.ok(previous);
          assert.deepEqual(
            source.sourceBlocks,
            previous.capture.sourceBlocks,
            'Source article changed; review the capture before replacement'
          );
          await app
            .get(PostsService)
            .command(
              {
                action: 'update',
                params: { postId: target.id },
                body: { lockVersion: target.lock_version, blocks: staged.blocks },
              },
              ACTOR
            );
          const capture = {
            ...source,
            rights: snapshot.rights,
            imageMappings: staged.imageMappings,
            appliedBlocks: staged.blocks,
          };
          await db.manager.query(
            `INSERT INTO scrape_archive.source_capture (post_id,source_url,capture_sha256,parser_version,captured_at,capture,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
            [
              target.id,
              source.sourceUrl,
              captureHash,
              source.parserVersion,
              source.capturedAt,
              JSON.stringify(capture),
              ACTOR,
            ]
          );
        } else {
          await posts.deleteBlocks(target.id);
          for (const [index, block] of staged.blocks.entries()) {
            if (block.type === 'IMAGE') {
              const image = await images.find(String(block.imageId), true);
              if (image.status === 'STAGED') {
                assert.equal(image.postId, null);
                const key = `posts/${target.id}/${image.id}-${image.hash.toString('hex')}.${image.mime.split('/')[1].replace('jpeg', 'jpg')}`;
                await storage.promote(image.privateKey, key);
                publicKeys.push(key);
                await images.update(
                  { ...image, postId: target.id, status: 'PUBLIC', publicKey: key },
                  ACTOR
                );
              } else {
                assert.equal(image.status, 'PUBLIC');
                assert.equal(image.postId, target.id);
              }
            }
            await posts.addBlock(target.id, index + 1, block, ACTOR);
          }
          const updated = await posts.update(await posts.find(target.id, true), ACTOR, false);
          await posts.history(updated, 'PUBLISHED', 'EDIT', ACTOR);
        }
        result.rows.push({
          postId: target.id,
          sourceUrl: source.sourceUrl,
          captureHash,
          blocks: staged.blocks,
          images: staged.imageMappings,
        });
      }
    });
    result.committed = true;
  } finally {
    if (!result.committed) {
      for (const key of publicKeys) await storage.delete('public', key);
      for (const key of privateKeys) await storage.delete('private', key);
    }
    await app.close();
    await writeReport();
  }
  const verify = new pg.Client({ connectionString: config.url });
  await verify.connect();
  try {
    await verify.query('BEGIN READ ONLY');
    for (const expected of result.rows) {
      const actual = (
        await verify.query(
          'SELECT * FROM content.board_post_block WHERE post_id=$1 ORDER BY position',
          [expected.postId]
        )
      ).rows;
      assert.deepEqual(normalized(actual), normalized(expected.blocks));
      const storedImages = (
        await verify.query(
          "SELECT id,encode(content_sha256,'hex') hash,status FROM content.board_post_image WHERE post_id=$1",
          [expected.postId]
        )
      ).rows;
      assert.equal(storedImages.length, expected.images.length);
      for (const image of expected.images) {
        const stored = storedImages.find((row) => row.id === String(image.imageId));
        assert.equal(stored?.hash, image.storedSha256);
        assert.equal(stored.status, config.name === 'local' ? 'STAGED' : 'PUBLIC');
      }
      if (config.name === 'local') {
        const capture = (
          await verify.query(
            'SELECT capture FROM scrape_archive.source_capture WHERE post_id=$1 AND capture_sha256=$2',
            [expected.postId, expected.captureHash]
          )
        ).rows[0].capture;
        assert.equal(capture.status, 'FETCHED');
        assert.equal(capture.issues.length, 0);
        assert.deepEqual(
          capture.social,
          snapshot.posts.find((post) => post.sourceUrl === expected.sourceUrl).social
        );
      }
    }
    await verify.query('ROLLBACK');
    result.readback = 'PASS';
  } finally {
    await verify.end();
  }
  await writeReport();
  console.log(
    JSON.stringify({
      database: config.name,
      postsCompleted: result.rows.length,
      newImages: privateKeys.length,
      readback: result.readback,
    })
  );
}
report.completedAt = new Date().toISOString();
await writeReport();
console.log(JSON.stringify({ report: reportFile.pathname }));
