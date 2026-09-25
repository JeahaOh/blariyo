import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { ImagesService } from '../dist/features/images/images.service.js';
import { ImagesRepository } from '../dist/features/images/images.repository.js';
import { PostsService } from '../dist/features/posts/posts.service.js';
import type { CreatePost } from '../dist/features/posts/posts.model.js';
import { CleanupService } from '../dist/operations/cleanup.service.js';
import { OutboxService } from '../dist/operations/outbox.service.js';
import { OutboxRepository } from '../dist/operations/outbox.repository.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { ApiError } from '../dist/shared/errors.js';
import type { Storage } from '../dist/shared/storage.js';
import { localStorage } from '../dist/adapters/storage.js';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';

function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
function latch() {
  let resolve: () => void = () => {
    throw new Error('latch not initialized');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

await test('original storage compensation, rollback and outbox exhaustion against Nest and TypeORM', async (t) => {
  const database = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(database);
  const migration = await migrationContext(database);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const source = await createDataSource(database).initialize();
  t.after(() => source.destroy());
  const root = await mkdtemp('/private/tmp/blariyo-nest-failures-');
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = localStorage(root);
  let putFailure = true,
    deleteFailure = true,
    oldInventory = false,
    puts = 0;
  let promoteWait:
    { started: ReturnType<typeof latch>; release: ReturnType<typeof latch> } | undefined;
  const adapter: Storage = {
    async put(...args) {
      if (putFailure && ++puts === 2) throw new Error('fixture write failure');
      await storage.put(...args);
    },
    get: storage.get.bind(storage),
    async delete(...args) {
      if (deleteFailure) throw new Error('fixture deletion failure');
      await storage.delete(...args);
    },
    async promote(...args) {
      if (promoteWait) {
        promoteWait.started.resolve();
        await promoteWait.release.promise;
      }
      await storage.promote(...args);
    },
    async inventory(bucket) {
      return (await storage.inventory(bucket)).map((item) =>
        oldInventory ? { ...item, createdAt: new Date(Date.now() - 25 * 3600000) } : item
      );
    },
  };
  const app = await createNestApplication({ databaseUrl: database, storage: adapter });
  t.after(() => app.close());
  const images = app.get(ImagesService),
    posts = app.get(PostsService),
    outbox = app.get(OutboxService);
  const actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } })
    .png()
    .toBuffer();
  const file = { bytes, mime: 'image/png' };
  const countImages = async () =>
    requiredRow(await source.query('SELECT count(*)::int AS count FROM content.board_post_image'))
      .count;
  await assert.rejects(
    images.upload([file, file], actor),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'DEPENDENCY_UNAVAILABLE' && !error.fields
  );
  assert.equal(await countImages(), 0);
  const tasks = rows(await source.query('SELECT * FROM ops.outbox_task'));
  assert.equal(tasks.length, 2);
  assert.ok(
    tasks.every((task) => task.aggregate_id === null && task.aggregate_type === 'STORAGE_OBJECT')
  );
  putFailure = false;
  deleteFailure = false;
  await outbox.run();
  assert.equal((await storage.inventory('private')).length, 0);
  await assert.rejects(
    images.upload(
      [
        { bytes: Buffer.alloc(10 * 1024 * 1024 + 1), mime: 'image/png' },
        { bytes: Buffer.from('<svg/>'), mime: 'image/svg+xml' },
      ],
      actor
    ),
    (error: unknown) =>
      error instanceof ApiError && error.status === 413 && error.fields?.length === 2
  );
  await assert.rejects(
    images.upload(
      Array.from({ length: 11 }, () => file),
      actor
    ),
    (error: unknown) => error instanceof ApiError && error.status === 413 && !error.fields
  );
  const oversizedPixels = await sharp({
    create: { width: 6325, height: 6325, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    images.upload([{ bytes: oversizedPixels, mime: 'image/png' }], actor),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 413 &&
      error.fields?.[0]?.reason === 'decodeLimit'
  );
  const gif = await sharp(
    Buffer.from(Array.from({ length: 201 * 3 }, (_, i) => (Math.floor(i / 3) % 2 ? 255 : 0))),
    { raw: { width: 1, height: 201, channels: 3, pageHeight: 1 } }
  )
    .gif({ delay: Array.from({ length: 201 }, () => 10) })
    .toBuffer();
  assert.equal((await sharp(gif, { animated: true }).metadata()).pages, 201);
  await assert.rejects(
    images.upload([{ bytes: gif, mime: 'image/gif' }], actor),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 413 &&
      error.fields?.[0]?.reason === 'decodeLimit'
  );

  const before = await countImages();
  let inserts = 0;
  const restorers = app.get(ImagesRepository, { each: true }).map((repository) => {
    const original = repository.create.bind(repository);
    repository.create = async (image) => {
      if (++inserts === 2) throw new Error('fixture DB failure');
      return original(image);
    };
    return () => {
      repository.create = original;
    };
  });
  try {
    await assert.rejects(
      images.upload([file, file], actor),
      (error: unknown) => error instanceof ApiError && error.status === 503 && !error.fields
    );
  } finally {
    for (const restore of restorers) restore();
  }
  assert.equal(inserts, 2);
  assert.equal(await countImages(), before);
  assert.equal((await storage.inventory('private')).length, 0);

  const uploaded = await images.upload([file], actor);
  const first = uploaded.items[0];
  assert.ok(first);
  const bad: CreatePost = {
    boardSlug: 'meme',
    title: 'rollback',
    source: null,
    pinnedPosition: null,
    blocks: [
      { type: 'IMAGE', imageId: first.imageId, alt: 'valid' },
      { type: 'IMAGE', imageId: 99999, alt: 'missing' },
    ],
  };
  await assert.rejects(
    posts.command({ action: 'create', params: {}, body: bad }, actor, 'rollback', 'POST /posts'),
    { code: 'IMAGE_STATE_CONFLICT' }
  );
  assert.equal(
    requiredRow(await source.query('SELECT post_id FROM content.board_post_image')).post_id,
    null
  );
  assert.equal(
    requiredRow(await source.query('SELECT count(*)::int AS count FROM content.board_post')).count,
    0
  );
  const duplicates = await images.upload([file, file], actor);
  const duplicatePost = object(
    (
      await posts.command(
        {
          action: 'create',
          params: {},
          body: {
            boardSlug: 'meme',
            title: '같은 이미지 두 자산',
            source: null,
            pinnedPosition: null,
            blocks: duplicates.items.map((image) => ({
              type: 'IMAGE',
              imageId: image.imageId,
              alt: '중복 이미지',
            })),
          },
        },
        actor,
        'duplicate-images',
        'POST /posts'
      )
    ).data
  );
  assert.equal(typeof duplicatePost.postId, 'number');
  await posts.command(
    {
      action: 'publish',
      params: { postId: String(duplicatePost.postId) },
      body: { lockVersion: 1, mode: 'IMMEDIATE' },
    },
    actor,
    'publish-duplicate-images',
    'POST /posts/:postId/publish'
  );
  const keys = rows(
    await source.query('SELECT public_storage_key FROM content.board_post_image WHERE post_id=$1', [
      duplicatePost.postId,
    ])
  ).map((row) => row.public_storage_key);
  assert.equal(new Set(keys).size, 2);
  const staged = (await images.upload([file], actor)).items[0];
  assert.ok(staged);
  const concurrent = object(
    (
      await posts.command(
        {
          action: 'create',
          params: {},
          body: {
            boardSlug: 'meme',
            title: '동시 발행',
            source: null,
            pinnedPosition: null,
            blocks: [{ type: 'IMAGE', imageId: staged.imageId, alt: '동시성' }],
          },
        },
        actor,
        'concurrent-create',
        'POST /posts'
      )
    ).data
  );
  const params = { postId: String(concurrent.postId) };
  const body = { lockVersion: 1, mode: 'IMMEDIATE' as const };
  promoteWait = { started: latch(), release: latch() };
  const publishing = posts.command(
    { action: 'publish', params, body },
    actor,
    'same-key',
    'POST /posts/:postId/publish'
  );
  await promoteWait.started.promise;
  try {
    await assert.rejects(
      posts.command(
        { action: 'publish', params, body },
        actor,
        'same-key',
        'POST /posts/:postId/publish'
      ),
      { code: 'IDEMPOTENCY_IN_PROGRESS' }
    );
  } finally {
    promoteWait.release.resolve();
  }
  assert.equal(object((await publishing).data).status, 'PUBLISHED');
  promoteWait = undefined;
  await storage.put('private', 'staging/orphan', bytes);
  oldInventory = true;
  await app.get(CleanupService).run();
  assert.ok(!(await storage.inventory('private')).some((item) => item.key === 'staging/orphan'));
  assert.equal((await storage.inventory('public')).length, 3);
  await app.get(UnitOfWork).transaction(() =>
    app.get(OutboxRepository).enqueue({
      type: 'CACHE_PURGE',
      aggregateType: 'POST',
      aggregateId: '1',
      payload: { urls: ['http://localhost/meme'] },
      actor,
    })
  );
  await source.query(
    "UPDATE ops.outbox_task SET status='RUNNING',attempt_count=7,updated_at=now()-interval '6 minutes',created_at=now()-interval '7 minutes' WHERE type='CACHE_PURGE'"
  );
  await outbox.run();
  assert.equal(
    requiredRow(
      await source.query("SELECT status FROM ops.outbox_task WHERE type='CACHE_PURGE' LIMIT 1")
    ).status,
    'DEAD'
  );
});
