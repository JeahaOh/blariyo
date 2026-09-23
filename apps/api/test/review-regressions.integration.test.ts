import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { ImagesService } from '../dist/features/images/images.service.js';
import { PostsService } from '../dist/features/posts/posts.service.js';
import { PostsRepository } from '../dist/features/posts/posts.repository.js';
import { OutboxService } from '../dist/operations/outbox.service.js';
import { OutboxRepository } from '../dist/operations/outbox.repository.js';
import { ScheduleAlertsService } from '../dist/operations/schedule-alerts.service.js';
import { ScheduleAlertsRepository } from '../dist/operations/schedule-alerts.repository.js';
import { scheduleWebhook } from '../dist/adapters/schedule-webhook.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import type { Storage } from '../dist/shared/storage.js';
import { localStorage } from '../dist/adapters/storage.js';
import { createDataSource, DatabaseContext } from '../dist/persistence/database.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';

function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
function saved(value: { data: unknown }): Record<string, unknown> & { postId: number; lockVersion: number } {
  const row = object(value.data);
  const { postId, lockVersion } = row;
  assert.equal(typeof postId, 'number'); assert.equal(typeof lockVersion, 'number');
  assert.ok(typeof postId === 'number' && typeof lockVersion === 'number');
  return { ...row, postId, lockVersion };
}
function deferred() {
  let resolve: () => void = () => { throw new Error('latch not initialized'); };
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

await test('original publication ownership, stale deletion, scheduled immediate publication and alert regressions', async (t) => {
  const database = process.env.TEST_NEST_DATABASE_URL; assert.ok(database);
  const migration = await migrationContext(database);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const source = await createDataSource(database).initialize(); t.after(() => source.destroy());
  const root = await mkdtemp('/private/tmp/blariyo-nest-review-'); t.after(() => rm(root, { recursive: true, force: true }));
  const storage = localStorage(root);
  let copyFailure: 'before' | 'after' | undefined;
  let paused: { entered: ReturnType<typeof deferred>; resume: ReturnType<typeof deferred> } | undefined;
  const adapter: Storage = {
    put: storage.put.bind(storage), get: storage.get.bind(storage), delete: storage.delete.bind(storage), inventory: storage.inventory.bind(storage),
    async promote(...args) {
      if (copyFailure === 'before') throw new Error('secret source and identity must not leak');
      if (paused) { paused.entered.resolve(); await paused.resume.promise; }
      await storage.promote(...args);
      if (copyFailure === 'after') throw new Error('copy acknowledgement lost');
    },
  };
  const app = await createNestApplication({ databaseUrl: database, storage: adapter }); t.after(() => app.close());
  const service = app.get(PostsService), outbox = app.get(OutboxService), work = app.get(UnitOfWork);
  const actor = 'system:scheduler';
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  async function draft() {
    const uploaded = (await app.get(ImagesService).upload([{ bytes, mime: 'image/png' }], actor)).items[0]; assert.ok(uploaded);
    return saved(await service.command({ action: 'create', params: {}, body: { boardSlug: 'meme', title: '회귀 검증', source: null, pinnedPosition: null, blocks: [{ type: 'IMAGE', imageId: uploaded.imageId, alt: '테스트' }] } }, actor));
  }
  await t.test('different request keys cannot overtake a paused copy, hide stays private', async () => {
    const post = await draft(), params = { postId: String(post.postId) };
    paused = { entered: deferred(), resume: deferred() };
    const first = service.command({ action: 'publish', params, body: { lockVersion: 1, mode: 'IMMEDIATE' } }, actor, 'A', 'publish');
    await paused.entered.promise;
    const second = service.command({ action: 'publish', params, body: { lockVersion: 1, mode: 'IMMEDIATE' } }, actor, 'B', 'publish');
    const rejected = assert.rejects(second, { code: 'POST_VERSION_CONFLICT' });
    let waiting = false;
    try {
      for (let i = 0; i < 100; i++) {
        waiting = rows(await source.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted")).length > 0;
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      assert.equal(waiting, true); assert.equal((await storage.inventory('public')).length, 0);
    } finally { paused.resume.resolve(); }
    const published = saved(await first); await rejected; paused = undefined;
    await service.command({ action: 'hide', params, body: { lockVersion: published.lockVersion, reasonCode: 'RIGHTS_EMAIL' } }, actor);
    await outbox.run();
    assert.equal((await service.detail(params.postId)).post.status, 'HIDDEN_REVIEW');
    assert.equal((await storage.inventory('public')).length, 0);
    assert.equal(rows(await source.query("SELECT 1 FROM ops.outbox_task WHERE type='OBJECT_DELETE_PUBLIC' AND status IN ('PENDING','FAILED','RUNNING')")).length, 0);
    await service.command({ action: 'republish', params, body: { lockVersion: 3, pinnedPosition: null } }, actor);
    const entry = (await storage.inventory('public'))[0]; assert.ok(entry);
    const block = (await service.detail(params.postId)).blocks[0]; assert.ok(block?.imageId);
    await work.transaction(() => app.get(OutboxRepository).enqueue({ type: 'OBJECT_DELETE_PUBLIC', aggregateType: 'IMAGE', aggregateId: block.imageId, payload: { compensation: true, publicStorageKey: entry.key, publicUrl: 'http://localhost/' + entry.key }, actor }));
    await source.query("UPDATE ops.outbox_task SET status='FAILED',next_attempt_at=now() WHERE type='OBJECT_DELETE_PUBLIC' AND aggregate_type='IMAGE'");
    await outbox.run();
    assert.equal((await storage.inventory('public')).length, 1);
    assert.equal((await service.detail(params.postId)).blocks[0]?.imageStatus, 'PUBLIC');
  });
  await t.test('copy succeeds but returns failure: durable compensation respects current ownership', async () => {
    const post = await draft(), params = { postId: String(post.postId) };
    copyFailure = 'after';
    try { await assert.rejects(service.command({ action: 'publish', params, body: { lockVersion: 1, mode: 'IMMEDIATE' } }, actor), { code: 'DEPENDENCY_UNAVAILABLE' }); }
    finally { copyFailure = undefined; }
    assert.equal((await service.detail(params.postId)).post.status, 'DRAFT');
    await outbox.run();
    assert.equal((await storage.inventory('public')).filter(entry => entry.key.startsWith(`content/published/posts/${post.postId}/`)).length, 0);
    await service.command({ action: 'publish', params, body: { lockVersion: 1, mode: 'IMMEDIATE' } }, actor);
    await outbox.run();
    assert.equal((await storage.inventory('public')).filter(entry => entry.key.startsWith(`content/published/posts/${post.postId}/`)).length, 1);
  });
  await t.test('DB rollback after copy is compensated; lost commit acknowledgement preserves publication', async () => {
    for (const committed of [false, true]) {
      const post = await draft(); let injected = false;
      const repository = app.get(PostsRepository);
      const update = repository.update.bind(repository);
      const databaseContext = app.get(DatabaseContext);
      const makeRunner = databaseContext.source.createQueryRunner.bind(databaseContext.source);
      if (!committed) repository.update = async (...args) => { if (!injected) { injected = true; throw new Error('injected DB acknowledgement failure'); } return update(...args); };
      else databaseContext.source.createQueryRunner = (...args) => {
        const runner = makeRunner(...args), commit = runner.commitTransaction.bind(runner);
        runner.commitTransaction = async () => { await commit(); if (!injected) { injected = true; throw new Error('injected DB acknowledgement failure'); } };
        return runner;
      };
      try { await assert.rejects(service.command({ action: 'publish', params: { postId: String(post.postId) }, body: { lockVersion: 1, mode: 'IMMEDIATE' } }, actor)); }
      finally { repository.update = update; databaseContext.source.createQueryRunner = makeRunner; }
      assert.equal(injected, true);
      assert.equal((await service.detail(String(post.postId))).post.status, committed ? 'PUBLISHED' : 'DRAFT');
      await outbox.run();
      assert.equal((await storage.inventory('public')).filter(entry => entry.key.startsWith(`content/published/posts/${post.postId}/`)).length, committed ? 1 : 0);
    }
  });
  await t.test('scheduled immediate publish clears schedule and scheduler cannot publish twice', async () => {
    const post = await draft(), params = { postId: String(post.postId) };
    await service.command({ action: 'publish', params, body: { lockVersion: 1, mode: 'SCHEDULED', scheduledAt: new Date(Date.now() + 120000).toISOString() } }, actor);
    await assert.rejects(service.command({ action: 'publish', params, body: { lockVersion: 2, mode: 'SCHEDULED', scheduledAt: new Date(Date.now() + 180000).toISOString() } }, actor), { code: 'POST_STATE_CONFLICT' });
    const result = await service.command({ action: 'publish', params, body: { lockVersion: 2, mode: 'IMMEDIATE' } }, actor, 'scheduled-now', 'publish');
    const data = saved(result);
    assert.equal(data.status, 'PUBLISHED'); assert.equal(data.scheduledAt, null); assert.ok(data.publishedAt); assert.equal(data.lockVersion, 3);
    assert.deepEqual(await service.command({ action: 'publish', params, body: { lockVersion: 2, mode: 'IMMEDIATE' } }, actor, 'scheduled-now', 'publish'), result);
    assert.equal(await service.publishDue(), 0);
    assert.equal(rows(await source.query("SELECT 1 FROM content.board_post_status_history WHERE post_id=$1 AND to_status='PUBLISHED'", [post.postId])).length, 1);
  });
  await t.test('scheduler records context and webhook retries survive workers and group repeats', async () => {
    const post = await draft(); const id = String(post.postId);
    await service.command({ action: 'publish', params: { postId: id }, body: { lockVersion: 1, mode: 'SCHEDULED', scheduledAt: new Date(Date.now() + 120000).toISOString() } }, actor);
    await source.query("UPDATE content.board_post SET scheduled_at=now()-interval '1 minute' WHERE id=$1", [id]);
    copyFailure = 'before';
    const logs: Record<string, unknown>[] = [], original = console.error;
    console.error = (value: unknown) => { assert.ok(typeof value === 'string'); logs.push(object(JSON.parse(value))); };
    try { assert.equal(await service.publishDue(), 0); } finally { console.error = original; copyFailure = undefined; }
    assert.equal(logs.length, 1); assert.equal(logs[0]?.postId, post.postId); assert.equal(logs[0]?.errorCode, 'DEPENDENCY_UNAVAILABLE');
    assert.ok(logs[0]?.scheduledAt); assert.ok(logs[0]?.attemptedAt); assert.ok(!JSON.stringify(logs).includes('secret'));
    assert.equal((await service.detail(id)).post.status, 'SCHEDULED');
    const received: Record<string, unknown>[] = []; let unavailable = true;
    const receiver = createServer((request, response) => { void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) { const bytes: unknown = chunk; assert.ok(Buffer.isBuffer(bytes)); chunks.push(bytes); }
      received.push(object(JSON.parse(Buffer.concat(chunks).toString('utf8')))); response.writeHead(unavailable ? 503 : 204); response.end();
    })().catch(() => response.destroy()); });
    await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve));
    try {
      const address = receiver.address(); assert.ok(address && typeof address !== 'string');
      const send = scheduleWebhook(`http://127.0.0.1:${address.port}/fixture`);
      const alerts = new ScheduleAlertsService(app.get(ScheduleAlertsRepository), work, send);
      await assert.rejects(alerts.deliver(), /DELIVERY_FAILED/);
      assert.equal(requiredRow(await source.query('SELECT notified_count FROM ops.schedule_failure_alert WHERE post_id=$1', [id])).notified_count, 0);
      unavailable = false;
      const restarted = await createNestApplication({ databaseUrl: database, storage });
      try { assert.equal(await new ScheduleAlertsService(restarted.get(ScheduleAlertsRepository), restarted.get(UnitOfWork), send).deliver(), 1); }
      finally { await restarted.close(); }
      assert.equal(received.at(-1)?.attemptCount, 1);
      const current = (await service.detail(id)).post; assert.ok(current.scheduledAt);
      await app.get(PostsRepository).recordScheduleFailure({ id, scheduledAt: current.scheduledAt, lockVersion: current.lockVersion }, 'DEPENDENCY_UNAVAILABLE', new Date());
      assert.equal(await alerts.deliver(), 0); assert.equal(await alerts.deliver(new Date(Date.now() + 16 * 60000)), 1);
      assert.equal(received.at(-1)?.attemptCount, 2); assert.equal(received.at(-1)?.newAttempts, 1); assert.equal(received[0]?.groupKey, received.at(-1)?.groupKey);
      assert.equal(await service.publishDue(), 1); assert.equal(await alerts.deliver(new Date(Date.now() + 32 * 60000)), 0);
    } finally { await new Promise<void>((resolve, reject) => receiver.close(error => error ? reject(error) : resolve())); }
  });
});
