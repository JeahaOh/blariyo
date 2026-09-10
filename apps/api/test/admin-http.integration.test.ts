import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import sharp from 'sharp';
import type { components } from '@blariyo/contracts/api';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { localStorage, localCache } from '../dist/adapters/storage.js';
import { OutboxService } from '../dist/operations/outbox.service.js';
import { OutboxRepository } from '../dist/operations/outbox.repository.js';
import { ImagesRepository } from '../dist/features/images/images.repository.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { PostsService } from '../dist/features/posts/posts.service.js';
import type { EdgeCache } from '../dist/shared/storage.js';
import { contractSuccess, contractError } from './contract-response.js';

const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
assert.ok(databaseUrl);
await test('original administrator transactions, storage and scheduler with strict contract types', async (t) => {
  const migration = await migrationContext(databaseUrl);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const pool = await createDataSource(databaseUrl).initialize();
  t.after(() => pool.destroy());
  const directory = await mkdtemp('/private/tmp/blariyo-admin-images-');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = localStorage(directory);
  const token = randomBytes(32).toString('hex'),
    actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  const app = await createNestApplication({ databaseUrl, storage, serviceToken: token });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const runOutbox = (cache: EdgeCache) =>
    new OutboxService(
      app.get(OutboxRepository),
      app.get(ImagesRepository),
      storage,
      cache,
      app.get(UnitOfWork)
    ).run();
  const request = (
    path: string,
    {
      method = 'GET',
      body,
      key = randomUUID(),
      auth = true,
    }: { method?: string; body?: unknown; key?: string; auth?: boolean } = {}
  ) => {
    const headers: Record<string, string> = auth
      ? { 'X-Blariyo-Service-Token': token, 'X-Blariyo-Admin-Actor': actor, 'Idempotency-Key': key }
      : {};
    if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
    return fetch(origin + '/api/v1' + path, {
      method,
      headers,
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  };
  let imageId: number | undefined;
  let post: components['schemas']['PostCommandResult'] | undefined;
  await t.test('authentication precedes validation', async () => {
    const response = await request('/admin/posts', { auth: false });
    assert.equal(response.status, 401);
    await response.body?.cancel();
  });
  await t.test('mixed upload fails entirely and valid upload decodes', async () => {
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#00a19b' },
    })
      .png()
      .toBuffer();
    let form = new FormData();
    form.append('files', new Blob([Uint8Array.from(bytes)], { type: 'image/png' }), 'test.png');
    form.append('files', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'bad.svg');
    const bad = await request('/admin/images', { method: 'POST', body: form });
    assert.equal(bad.status, 415);
    const rejected = await contractError('uploadImages', bad, 'POST');
    assert.equal(rejected.error.fields?.[0]?.field, 'files[1]');
    assert.equal((await storage.inventory('private')).length, 0);
    form = new FormData();
    form.append('files', new Blob([Uint8Array.from(bytes)], { type: 'image/png' }), 'test.png');
    const good = await request('/admin/images', { method: 'POST', body: form });
    assert.equal(good.status, 200);
    const uploaded = await contractSuccess('uploadImages', good, 'POST');
    const image = uploaded.data.items[0];
    assert.ok(image);
    imageId = image.imageId;
    const preview = await request(`/admin/images/${imageId}/preview`);
    assert.equal(preview.status, 200);
    await preview.body?.cancel();
  });
  await t.test('create idempotency, conflict, image ownership and version', async () => {
    assert.ok(imageId);
    const body = {
      boardSlug: 'meme',
      title: '새 초안',
      source: null,
      pinnedPosition: null,
      blocks: [
        { type: 'TEXT', text: '본문' },
        { type: 'IMAGE', imageId, alt: '테스트 이미지' },
      ],
    };
    const key = randomUUID();
    const created = await request('/admin/posts', { method: 'POST', body, key });
    assert.equal(created.status, 201);
    post = (await contractSuccess('createPost', created, 'POST')).data;
    assert.deepEqual(
      (
        await contractSuccess(
          'createPost',
          await request('/admin/posts', { method: 'POST', body, key }),
          'POST'
        )
      ).data,
      post
    );
    assert.equal(
      (
        await contractError(
          'createPost',
          await request('/admin/posts', {
            method: 'POST',
            body: { ...body, title: '다른 제목' },
            key,
          }),
          'POST'
        )
      ).error.code,
      'IDEMPOTENCY_CONFLICT'
    );
    assert.equal(
      (
        await contractError(
          'createPost',
          await request('/admin/posts', { method: 'POST', body }),
          'POST'
        )
      ).error.code,
      'IMAGE_ALREADY_ATTACHED'
    );
    assert.equal(
      (
        await contractError(
          'updatePost',
          await request(`/admin/posts/${post.postId}`, {
            method: 'PATCH',
            body: { lockVersion: 999, title: '경쟁' },
          }),
          'PATCH'
        )
      ).error.code,
      'POST_VERSION_CONFLICT'
    );
    assert.equal(
      (await contractSuccess('searchAdminPosts', await request('/admin/posts?page=999'))).data.items
        .length,
      0
    );
  });
  await t.test('publish, hide, delete retry, republish and final removal', async () => {
    const call = async (action: string, body: Record<string, unknown>, method = 'POST') => {
      assert.ok(post);
      return request(`/admin/posts/${post.postId}${action ? '/' + action : ''}`, {
        method,
        body: { lockVersion: post.lockVersion, ...body },
      });
    };
    const published = await call('publish', { mode: 'IMMEDIATE' });
    assert.equal(published.status, 200);
    const publishedData = (await contractSuccess('publishPost', published, 'POST')).data;
    post = publishedData;
    const firstPublished = publishedData.publishedAt;
    const visible = await request(`/boards/meme/posts/${post.postId}`);
    assert.equal(visible.status, 200);
    await visible.body?.cancel();
    const hidden = await call('hide', { reasonCode: 'RIGHTS_EMAIL' });
    assert.equal(hidden.status, 200);
    post = (await contractSuccess('hidePost', hidden, 'POST')).data;
    const invisible = await request(`/boards/meme/posts/${post.postId}`);
    assert.equal(invisible.status, 404);
    await invisible.body?.cancel();
    assert.equal(
      (
        await contractError(
          'republishPost',
          await call('republish', { pinnedPosition: null }),
          'POST'
        )
      ).error.code,
      'IMAGE_STATE_CONFLICT'
    );
    await runOutbox({
      purge: async () => {
        throw new Error('fixture cache outage');
      },
    });
    const stillPending = await call('republish', { pinnedPosition: null });
    assert.equal(stillPending.status, 409);
    await stillPending.body?.cancel();
    await pool.query("UPDATE ops.outbox_task SET next_attempt_at=now() WHERE status='FAILED'");
    await runOutbox(localCache());
    const restored = await call('republish', { pinnedPosition: null });
    assert.equal(restored.status, 200);
    post = (await contractSuccess('republishPost', restored, 'POST')).data;
    assert.equal(
      (await contractSuccess('getPostEditor', await request(`/admin/posts/${post.postId}`))).data
        .publishedAt,
      firstPublished
    );
    post = (await contractSuccess('hidePost', await call('hide', { reasonCode: 'EDIT' }), 'POST'))
      .data;
    await runOutbox(localCache());
    const removed = await call('', { reasonCode: 'REMOVE' }, 'DELETE');
    assert.equal(removed.status, 200);
    post = (await contractSuccess('removePost', removed, 'DELETE')).data;
    assert.equal(post.status, 'REMOVED');
    const rejected = await call('republish', { pinnedPosition: null });
    assert.equal(rejected.status, 409);
    await rejected.body?.cancel();
    const task = requiredRow(
      await pool.query(
        "SELECT * FROM ops.outbox_task WHERE type='OBJECT_DELETE_PRIVATE' ORDER BY id DESC LIMIT 1"
      )
    );
    assert.ok(task.next_attempt_at instanceof Date);
    assert.ok(task.next_attempt_at.getTime() - Date.now() > 29 * 86400000);
  });
  await t.test('schedule, cancellation, outage recovery, concurrent due workers', async () => {
    const draft = await request('/admin/posts', {
      method: 'POST',
      body: {
        boardSlug: 'meme',
        title: '예약',
        source: null,
        pinnedPosition: 1,
        blocks: [{ type: 'TEXT', text: '예약 본문' }],
      },
    });
    const p = (await contractSuccess('createPost', draft, 'POST')).data;
    const scheduled = await request(`/admin/posts/${p.postId}/publish`, {
      method: 'POST',
      body: {
        lockVersion: 1,
        mode: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
    assert.equal(scheduled.status, 200);
    assert.equal(
      (await contractSuccess('publishPost', scheduled, 'POST')).data.status,
      'SCHEDULED'
    );
    assert.equal(
      (
        await contractSuccess(
          'unschedulePost',
          await request(`/admin/posts/${p.postId}/unschedule`, {
            method: 'POST',
            body: { lockVersion: 2 },
          }),
          'POST'
        )
      ).data.status,
      'DRAFT'
    );
    const rescheduled = await request(`/admin/posts/${p.postId}/publish`, {
      method: 'POST',
      body: {
        lockVersion: 3,
        mode: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
    await contractSuccess('publishPost', rescheduled, 'POST');
    await pool.query(
      "UPDATE content.board_post SET scheduled_at=now()-interval '1 hour' WHERE id=$1",
      [p.postId]
    );
    const service = app.get(PostsService);
    const results = await Promise.all([service.publishDue(), service.publishDue()]);
    assert.equal(
      results.reduce((a, b) => a + b),
      1
    );
    const visible = await request(`/boards/meme/posts/${p.postId}`);
    assert.equal(visible.status, 200);
    await visible.body?.cancel();
    assert.equal(
      Number(
        requiredRow(
          await pool.query(
            "SELECT count(*) FROM content.board_post_status_history WHERE post_id=$1 AND reason_code='SYSTEM_DUE'",
            [p.postId]
          )
        ).count
      ),
      1
    );
  });
});
