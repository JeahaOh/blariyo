import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import sharp from 'sharp';
import { createPool, transaction } from '../apps/api/src/db.mjs';
import { migrate } from '../apps/api/src/migrate.mjs';
import { localStorage, localCache } from '../apps/api/src/storage.mjs';
import { imageService } from '../apps/api/src/images.mjs';
import { postService } from '../apps/api/src/posts.mjs';
import { cleanup } from '../apps/api/src/cleanup.mjs';
import { runOutbox, enqueue } from '../apps/api/src/outbox.mjs';
const database = process.env.TEST_FAILURE_DATABASE_URL;
test('storage compensation, rollback and outbox exhaustion', { skip: !database }, async (t) => {
  const pool = createPool(database);
  t.after(() => pool.end());
  await migrate(pool);
  const storage = localStorage(await mkdtemp('/private/tmp/blariyo-failure-')),
    actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } })
      .png()
      .toBuffer(),
    file = { bytes, mime: 'image/png' };
  let puts = 0;
  const broken = {
    ...storage,
    put: async (...args) => {
      if (++puts === 2) throw new Error('fixture write failure');
      return storage.put(...args);
    },
    delete: async () => {
      throw new Error('fixture deletion failure');
    },
  };
  await assert.rejects(
    imageService(pool, broken).upload([file, file], actor),
    (e) => e.code === 'DEPENDENCY_UNAVAILABLE' && !e.fields
  );
  assert.equal(
    Number((await pool.query('SELECT count(*) FROM content.board_post_image')).rows[0].count),
    0
  );
  const tasks = (await pool.query('SELECT * FROM ops.outbox_task')).rows;
  assert.equal(tasks.length, 2);
  assert.ok(
    tasks.every((task) => task.aggregate_id === null && task.aggregate_type === 'STORAGE_OBJECT')
  );
  await runOutbox(pool, storage, localCache());
  assert.equal((await storage.inventory('private')).length, 0);
  const mixed = [
    { bytes: Buffer.alloc(10 * 1024 * 1024 + 1), mime: 'image/png' },
    { bytes: Buffer.from('<svg/>'), mime: 'image/svg+xml' },
  ];
  await assert.rejects(
    imageService(pool, storage).upload(mixed, actor),
    (e) => e.status === 413 && e.fields.length === 2
  );
  await assert.rejects(
    imageService(pool, storage).upload(Array(11).fill(file), actor),
    (e) => e.status === 413 && !e.fields
  );
  const oversizedPixels = await sharp({
    create: { width: 6325, height: 6325, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    imageService(pool, storage).upload([{ bytes: oversizedPixels, mime: 'image/png' }], actor),
    (e) => e.status === 413 && e.fields[0].reason === 'decodeLimit'
  );
  const gif = await sharp(
    Buffer.from(Array.from({ length: 201 * 3 }, (_, i) => (Math.floor(i / 3) % 2 ? 255 : 0))),
    { raw: { width: 1, height: 201, channels: 3, pageHeight: 1 } }
  )
    .gif({ delay: Array(201).fill(10) })
    .toBuffer();
  assert.equal((await sharp(gif, { animated: true }).metadata()).pages, 201);
  await assert.rejects(
    imageService(pool, storage).upload([{ bytes: gif, mime: 'image/gif' }], actor),
    (e) => e.status === 413 && e.fields[0].reason === 'decodeLimit'
  );
  const rowsBefore = Number(
    (await pool.query('SELECT count(*) FROM content.board_post_image')).rows[0].count
  );
  let inserts = 0;
  const brokenDb = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: (sql, params) => {
          if (sql.includes('INSERT INTO content.board_post_image') && ++inserts === 2)
            throw new Error('fixture DB failure');
          return client.query(sql, params);
        },
      };
    },
  };
  await assert.rejects(
    imageService(brokenDb, storage).upload([file, file], actor),
    (e) => e.status === 503 && !e.fields
  );
  assert.equal(
    Number((await pool.query('SELECT count(*) FROM content.board_post_image')).rows[0].count),
    rowsBefore
  );
  assert.equal((await storage.inventory('private')).length, 0);
  const images = await imageService(pool, storage).upload([file], actor),
    service = postService(pool, storage);
  const badBody = {
    boardSlug: 'meme',
    title: 'rollback',
    source: null,
    pinnedPosition: null,
    blocks: [
      { type: 'IMAGE', imageId: images.items[0].imageId, alt: 'valid' },
      { type: 'IMAGE', imageId: 99999, alt: 'missing' },
    ],
  };
  await assert.rejects(
    service.command('create', {}, badBody, actor, 'rollback', 'POST /posts'),
    (e) => e.code === 'IMAGE_STATE_CONFLICT'
  );
  assert.equal(
    (await pool.query('SELECT post_id FROM content.board_post_image')).rows[0].post_id,
    null
  );
  assert.equal(
    Number((await pool.query('SELECT count(*) FROM content.board_post')).rows[0].count),
    0
  );
  const duplicates = await imageService(pool, storage).upload([file, file], actor);
  const duplicatePost = await service.command(
    'create',
    {},
    {
      boardSlug: 'meme',
      title: '같은 이미지 두 자산',
      source: null,
      pinnedPosition: null,
      blocks: duplicates.items.map((i) => ({
        type: 'IMAGE',
        imageId: i.imageId,
        alt: '중복 이미지',
      })),
    },
    actor,
    'duplicate-images',
    'POST /posts'
  );
  await service.command(
    'publish',
    { postId: String(duplicatePost.data.postId) },
    { lockVersion: 1, mode: 'IMMEDIATE' },
    actor,
    'publish-duplicate-images',
    'POST /posts/:postId/publish'
  );
  const keys = (
    await pool.query('SELECT public_storage_key FROM content.board_post_image WHERE post_id=$1', [
      duplicatePost.data.postId,
    ])
  ).rows.map((r) => r.public_storage_key);
  assert.equal(new Set(keys).size, 2);
  const staged = await imageService(pool, storage).upload([file], actor);
  const concurrent = await service.command(
    'create',
    {},
    {
      boardSlug: 'meme',
      title: '동시 발행',
      source: null,
      pinnedPosition: null,
      blocks: [{ type: 'IMAGE', imageId: staged.items[0].imageId, alt: '동시성' }],
    },
    actor,
    'concurrent-create',
    'POST /posts'
  );
  let start, release;
  const started = new Promise((r) => (start = r)),
    waiting = new Promise((r) => (release = r));
  const slow = postService(pool, {
    ...storage,
    promote: async (...args) => {
      start();
      await waiting;
      return storage.promote(...args);
    },
  });
  const params = { postId: String(concurrent.data.postId) },
    body = { lockVersion: 1, mode: 'IMMEDIATE' };
  const publishing = slow.command(
    'publish',
    params,
    body,
    actor,
    'same-key',
    'POST /posts/:postId/publish'
  );
  await started;
  try {
    await assert.rejects(
      service.command('publish', params, body, actor, 'same-key', 'POST /posts/:postId/publish'),
      (e) => e.code === 'IDEMPOTENCY_IN_PROGRESS'
    );
  } finally {
    release();
  }
  assert.equal((await publishing).data.status, 'PUBLISHED');
  await storage.put('private', 'staging/orphan', bytes);
  await cleanup(pool, {
    ...storage,
    inventory: async (kind) =>
      (await storage.inventory(kind)).map((object) => ({
        ...object,
        createdAt: new Date(Date.now() - 25 * 3600000),
      })),
  });
  assert.ok(
    !(await storage.inventory('private')).some((object) => object.key === 'staging/orphan')
  );
  assert.equal((await storage.inventory('public')).length, 3);
  await transaction(pool, (db) =>
    enqueue(db, 'CACHE_PURGE', 'POST', 1, { urls: ['http://localhost/meme'] }, actor)
  );
  await pool.query(
    "UPDATE ops.outbox_task SET status='RUNNING',attempt_count=7,updated_at=now()-interval '6 minutes',created_at=now()-interval '7 minutes' WHERE type='CACHE_PURGE'"
  );
  await runOutbox(pool, storage, localCache());
  assert.equal(
    (await pool.query("SELECT status FROM ops.outbox_task WHERE type='CACHE_PURGE'")).rows[0]
      .status,
    'DEAD'
  );
});
