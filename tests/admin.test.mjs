import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import sharp from 'sharp';
import { createPool } from '../apps/api/src/db.mjs';
import { migrate } from '../apps/api/src/migrate.mjs';
import { createApp } from '../apps/api/src/app.mjs';
import { localStorage, localCache } from '../apps/api/src/storage.mjs';
import { runOutbox } from '../apps/api/src/outbox.mjs';
import { postService } from '../apps/api/src/posts.mjs';
const database = process.env.TEST_ADMIN_DATABASE_URL;
test('administrator transactions, storage and scheduler', { skip: !database }, async (t) => {
  const pool = createPool(database);
  await migrate(pool);
  const storage = localStorage(await mkdtemp('/private/tmp/blariyo-images-'));
  const token = randomBytes(32).toString('hex'),
    actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  const server = createApp(pool, { storage, serviceToken: token }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await pool.end();
  });
  const request = async (path, { method = 'GET', body, key = randomUUID(), auth = true } = {}) => {
    const headers = auth
      ? { 'X-Blariyo-Service-Token': token, 'X-Blariyo-Admin-Actor': actor, 'Idempotency-Key': key }
      : {};
    if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      body:
        r.status === 204
          ? null
          : r.headers.get('content-type')?.includes('json')
            ? await r.json()
            : await r.arrayBuffer(),
    };
  };
  let image, post;
  await t.test('authentication precedes validation', async () => {
    assert.equal((await request('/admin/posts', { auth: false })).status, 401);
  });
  await t.test('mixed upload fails entirely and valid upload decodes', async () => {
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#00a19b' },
    })
      .png()
      .toBuffer();
    let form = new FormData();
    form.append('files', new Blob([bytes], { type: 'image/png' }), 'test.png');
    form.append('files', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'bad.svg');
    const bad = await request('/admin/images', { method: 'POST', body: form });
    assert.equal(bad.status, 415);
    assert.equal(bad.body.error.fields[0].field, 'files[1]');
    assert.equal((await storage.inventory('private')).length, 0);
    form = new FormData();
    form.append('files', new Blob([bytes], { type: 'image/png' }), 'test.png');
    const good = await request('/admin/images', { method: 'POST', body: form });
    assert.equal(good.status, 200, JSON.stringify(good));
    image = good.body.data.items[0];
    assert.equal((await request(`/admin/images/${image.imageId}/preview`)).status, 200);
  });
  await t.test('create idempotency, conflict, image ownership and version', async () => {
    const body = {
      boardSlug: 'meme',
      title: '새 초안',
      source: null,
      pinnedPosition: null,
      blocks: [
        { type: 'TEXT', text: '본문' },
        { type: 'IMAGE', imageId: image.imageId, alt: '테스트 이미지' },
      ],
    };
    const key = randomUUID();
    const created = await request('/admin/posts', { method: 'POST', body, key });
    assert.equal(created.status, 201, JSON.stringify(created));
    post = created.body.data;
    assert.deepEqual(
      (await request('/admin/posts', { method: 'POST', body, key })).body.data,
      post
    );
    assert.equal(
      (
        await request('/admin/posts', {
          method: 'POST',
          body: { ...body, title: '다른 제목' },
          key,
        })
      ).body.error.code,
      'IDEMPOTENCY_CONFLICT'
    );
    assert.equal(
      (await request('/admin/posts', { method: 'POST', body })).body.error.code,
      'IMAGE_ALREADY_ATTACHED'
    );
    assert.equal(
      (
        await request(`/admin/posts/${post.postId}`, {
          method: 'PATCH',
          body: { lockVersion: 999, title: '경쟁' },
        })
      ).body.error.code,
      'POST_VERSION_CONFLICT'
    );
    assert.equal((await request('/admin/posts?page=999')).body.data.items.length, 0);
  });
  await t.test('publish, hide, delete retry, republish and final removal', async () => {
    const call = async (action, body, method = 'POST') =>
      request(`/admin/posts/${post.postId}${action ? '/' + action : ''}`, {
        method,
        body: { lockVersion: post.lockVersion, ...body },
      });
    const published = await call('publish', { mode: 'IMMEDIATE' });
    assert.equal(published.status, 200, JSON.stringify(published));
    post = published.body.data;
    const firstPublished = post.publishedAt;
    assert.equal((await request(`/boards/meme/posts/${post.postId}`)).status, 200);
    const hidden = await call('hide', { reasonCode: 'RIGHTS_EMAIL' });
    assert.equal(hidden.status, 200);
    post = hidden.body.data;
    assert.equal((await request(`/boards/meme/posts/${post.postId}`)).status, 404);
    assert.equal(
      (await call('republish', { pinnedPosition: null })).body.error.code,
      'IMAGE_STATE_CONFLICT'
    );
    await runOutbox(pool, storage, {
      purge: async () => {
        throw new Error('fixture cache outage');
      },
    });
    assert.equal((await call('republish', { pinnedPosition: null })).status, 409);
    await pool.query("UPDATE ops.outbox_task SET next_attempt_at=now() WHERE status='FAILED'");
    await runOutbox(pool, storage, localCache());
    const restored = await call('republish', { pinnedPosition: null });
    assert.equal(restored.status, 200, JSON.stringify(restored));
    post = restored.body.data;
    assert.equal(
      (await request(`/admin/posts/${post.postId}`)).body.data.publishedAt,
      firstPublished
    );
    post = (await call('hide', { reasonCode: 'EDIT' })).body.data;
    await runOutbox(pool, storage, localCache());
    const removed = await call('', { reasonCode: 'REMOVE' }, 'DELETE');
    assert.equal(removed.status, 200, JSON.stringify(removed));
    post = removed.body.data;
    assert.equal(post.status, 'REMOVED');
    assert.equal((await call('republish', { pinnedPosition: null })).status, 409);
    const task = (
      await pool.query(
        "SELECT * FROM ops.outbox_task WHERE type='OBJECT_DELETE_PRIVATE' ORDER BY id DESC LIMIT 1"
      )
    ).rows[0];
    assert.ok(task.next_attempt_at - Date.now() > 29 * 86400000);
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
    const p = draft.body.data;
    let result = await request(`/admin/posts/${p.postId}/publish`, {
      method: 'POST',
      body: {
        lockVersion: 1,
        mode: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.status, 'SCHEDULED');
    result = await request(`/admin/posts/${p.postId}/unschedule`, {
      method: 'POST',
      body: { lockVersion: 2 },
    });
    assert.equal(result.body.data.status, 'DRAFT');
    await request(`/admin/posts/${p.postId}/publish`, {
      method: 'POST',
      body: {
        lockVersion: 3,
        mode: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
    await pool.query(
      "UPDATE content.board_post SET scheduled_at=now()-interval '1 hour' WHERE id=$1",
      [p.postId]
    );
    const service = postService(pool, storage);
    const results = await Promise.all([service.publishDue(), service.publishDue()]);
    assert.equal(
      results.reduce((a, b) => a + b),
      1
    );
    assert.equal((await request(`/boards/meme/posts/${p.postId}`)).status, 200);
    assert.equal(
      Number(
        (
          await pool.query(
            "SELECT count(*) FROM content.board_post_status_history WHERE post_id=$1 AND reason_code='SYSTEM_DUE'",
            [p.postId]
          )
        ).rows[0].count
      ),
      1
    );
  });
});
