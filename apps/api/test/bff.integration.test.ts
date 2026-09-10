import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { contractBody } from './contract-response.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { localStorage } from '../dist/adapters/storage.js';
const database = process.env.TEST_NEST_DATABASE_URL;
assert.ok(database);
await test(
  'Nest: original Nuxt BFF, Core, PostgreSQL and SSR HTTP integration',
  { timeout: 90000 },
  async (t) => {
    const migration = await migrationContext(database);
    try {
      await migration.get(MigrationsService).migrate();
    } finally {
      await migration.close();
    }
    const directory = await mkdtemp('/private/tmp/blariyo-bff-');
    t.after(() => rm(directory, { recursive: true, force: true }));
    const serviceToken = randomBytes(32).toString('hex'),
      adminToken = randomBytes(32).toString('hex');
    const app = await createNestApplication({
      databaseUrl: database,
      serviceToken,
      storage: localStorage(directory),
    });
    await app.listen(0, '127.0.0.1');
    t.after(() => app.close());
    const coreOrigin = await app.getUrl();
    const reservation = createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    assert.ok(address && typeof address !== 'string');
    const reservedPort = address.port;
    await new Promise<void>((resolve, reject) =>
      reservation.close((error) => (error ? reject(error) : resolve()))
    );
    const port = reservedPort,
      origin = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NITRO_PORT: String(port),
        NITRO_HOST: '127.0.0.1',
        NUXT_CORE_ORIGIN: coreOrigin,
        NUXT_ADMIN_AUTH_MODE: 'local',
        NUXT_LOCAL_ADMIN_TOKEN: adminToken,
        NUXT_SERVICE_TOKEN: serviceToken,
        NUXT_ACTOR_SECRET: randomBytes(32).toString('hex'),
        NUXT_PUBLIC_SITE_ORIGIN: origin,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let exited = false;
    child.once('exit', () => (exited = true));
    let logs = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => {
      logs += d;
    });
    child.stderr.on('data', (d: string) => {
      logs += d;
    });
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const terminal = once(child, 'exit');
        child.kill('SIGTERM');
        await terminal;
      }
    });
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(origin + '/health/live', { signal: AbortSignal.timeout(1500) })).ok) {
          ready = true;
          break;
        }
      } catch {}
      if (exited) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, 'Nuxt built server did not start: ' + logs.slice(-2000));
    const request = async (
      path: string,
      {
        method = 'GET',
        body,
        auth = false,
        originHeader = origin,
        key = randomUUID(),
      }: {
        method?: string;
        body?: unknown;
        auth?: boolean;
        originHeader?: string;
        key?: string;
      } = {}
    ) => {
      const headers: Record<string, string> = {
        Origin: originHeader,
        Accept: path.startsWith('/api/') ? 'application/json' : 'text/html',
        'Idempotency-Key': key,
        ...(auth ? { Cookie: `BLARIYO_ADMIN_SESSION=${adminToken}` } : {}),
      };
      if (body) headers['Content-Type'] = 'application/json';
      const response = await fetch(origin + path, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const text = await response.text();
      const parsed: unknown = response.headers.get('content-type')?.includes('json')
        ? JSON.parse(text)
        : null;
      return {
        status: response.status,
        headers: response.headers,
        text,
        body: parsed,
      };
    };
    assert.equal((await request('/api/v1/admin/posts')).status, 401);
    const unauthenticatedAdmin = await request('/admin');
    assert.equal(unauthenticatedAdmin.status, 401);
    assert.match(unauthenticatedAdmin.text, /관리자 인증이 필요합니다\./);
    const draft = {
      boardSlug: 'meme',
      title: 'BFF SSR 검증',
      source: null,
      pinnedPosition: null,
      blocks: [{ type: 'TEXT', text: '  첫 본문\n  요약 <script>alert(1)</script>' }],
    };
    assert.equal(
      (
        await request('/api/v1/admin/posts', {
          method: 'POST',
          body: draft,
          auth: true,
          originHeader: 'https://wrong.invalid',
        })
      ).status,
      403
    );
    const created = await request('/api/v1/admin/posts', {
      method: 'POST',
      body: draft,
      auth: true,
    });
    assert.equal(created.status, 201, created.text);
    const createdBody = contractBody(
      'createPost',
      '/api/v1/admin/posts',
      created.status,
      created.body,
      'POST'
    );
    assert.equal(createdBody.success, true);
    const post = createdBody.data;
    const editor = await request('/api/v1/admin/posts/' + post.postId, { auth: true });
    assert.equal(editor.status, 200, editor.text);
    const editorBody = contractBody(
      'getPostEditor',
      '/api/v1/admin/posts/' + String(post.postId),
      editor.status,
      editor.body
    );
    assert.equal(editorBody.success, true);
    assert.equal(editorBody.data.blocks[0]?.type, 'TEXT');
    const edits = await Promise.all(
      ['경쟁 수정 A', '경쟁 수정 B'].map((title) =>
        request('/api/v1/admin/posts/' + post.postId, {
          method: 'PATCH',
          body: { lockVersion: 1, title },
          auth: true,
        })
      )
    );
    assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
    const reset = await request('/api/v1/admin/posts/' + post.postId, {
      method: 'PATCH',
      body: { lockVersion: 2, title: draft.title },
      auth: true,
    });
    assert.equal(reset.status, 200);
    const published = await request(`/api/v1/admin/posts/${post.postId}/publish`, {
      method: 'POST',
      body: { lockVersion: 3, mode: 'IMMEDIATE' },
      auth: true,
    });
    assert.equal(published.status, 200, published.text);
    const list = await request('/api/v1/boards/meme/posts');
    assert.equal(list.status, 200, list.text);
    const listBody = contractBody('listPosts', '/api/v1/boards/meme/posts', list.status, list.body);
    assert.equal(listBody.success, true);
    assert.equal(listBody.data.items.length, 1);
    assert.equal(list.headers.get('cache-control'), 'no-store');
    const html = await request('/meme/posts/' + post.postId);
    assert.equal(html.status, 200, html.text.slice(0, 500));
    assert.ok(html.text.includes('BFF SSR 검증'));
    assert.ok(html.text.includes('rel="canonical"'));
    assert.ok(html.text.includes('&lt;script&gt;'));
    const article = html.text.match(/<article[\s\S]*?<\/article>/)?.[0];
    assert.ok(article);
    assert.ok(!article.includes('<script>alert(1)</script>'));
    assert.equal(
      (
        await request('/api/v1/boards/meme/posts/' + post.postId + '/views', {
          method: 'POST',
          body: {},
        })
      ).status,
      400
    );
    const etag = list.headers.get('etag');
    assert.ok(etag);
    const cached = await fetch(origin + '/api/v1/boards/meme/posts', {
      headers: { 'If-None-Match': etag },
    });
    assert.equal(cached.status, 304);
    let limited: Awaited<ReturnType<typeof request>> | undefined;
    for (let i = 0; i < 61; i++)
      limited = await request('/api/v1/boards/meme/posts/' + post.postId + '/views', {
        method: 'POST',
      });
    assert.ok(limited);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    await request(`/api/v1/admin/posts/${post.postId}/hide`, {
      method: 'POST',
      body: { lockVersion: 4, reasonCode: 'EDIT' },
      auth: true,
    });
    const hidden = await request('/meme/posts/' + post.postId);
    assert.equal(hidden.status, 404);
    assert.ok(!hidden.text.includes('BFF SSR 검증'));
    assert.ok(hidden.text.includes('noindex'));
  }
);
