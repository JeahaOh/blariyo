import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';

function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}

await test('HTTP method, parser, authentication and maintenance boundaries preserve the original contract', async (t) => {
  const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(databaseUrl);
  const migration = await migrationContext(databaseUrl);
  try {
    await migration.get(MigrationsService).migrate('up');
  } finally {
    await migration.close();
  }
  const fixture = await createDataSource(databaseUrl).initialize();
  t.after(() => fixture.destroy());
  const serviceToken = randomBytes(32).toString('hex');
  const auth = {
    'X-Blariyo-Service-Token': serviceToken,
    'X-Blariyo-Admin-Actor': 'admin:v1:' + randomBytes(32).toString('base64url'),
  };
  const app = await createNestApplication({
    databaseUrl,
    serviceToken,
    collectManualUrlEnabled: true,
    maintenance: true,
  });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function error(
    path: string,
    method: string,
    status: number,
    code: string,
    headers: Record<string, string> = {},
    body?: string
  ) {
    const response = await fetch(base + path, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
    });
    assert.equal(response.status, status, method + ' ' + path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('etag'), null);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    if (method === 'HEAD') assert.equal(await response.text(), '');
    else {
      const result = object(await response.json());
      assert.equal(result.success, false);
      assert.equal(object(result.error).code, code);
      assert.equal(object(result.meta).requestId, response.headers.get('x-request-id'));
    }
    return response;
  }
  await t.test(
    'unsupported methods and missing paths are rejected before authentication',
    async () => {
      for (const [path, code] of [
        ['/api/v1/admin/posts', 'POST_NOT_FOUND'],
        ['/api/v1/admin/images/1/preview', 'POST_NOT_FOUND'],
        ['/api/v1/boards', 'POST_NOT_FOUND'],
        ['/api/v1/admin/collect/sources', 'CANDIDATE_NOT_FOUND'],
        ['/internal/collect/status', 'CANDIDATE_NOT_FOUND'],
      ] as const)
        for (const method of ['HEAD', 'OPTIONS', 'PUT']) await error(path, method, 404, code);
      for (const prefix of ['/api/v1/admin/collect', '/internal/collect']) {
        await error(prefix + '/unregistered', 'GET', 404, 'CANDIDATE_NOT_FOUND');
        await error(prefix, 'OPTIONS', 404, 'CANDIDATE_NOT_FOUND');
      }
      await error('/api/v1/admin/collection/unregistered', 'GET', 404, 'POST_NOT_FOUND');
      await error('/api/v1/admin/posts', 'GET', 401, 'ADMIN_AUTH_REQUIRED');
      await error('/api/v1/admin/posts', 'GET', 403, 'ADMIN_FORBIDDEN', {
        ...auth,
        'X-Blariyo-Admin-Actor': 'raw-subject',
      });
      await error('/api/v1/admin/collect/sources', 'GET', 401, 'ADMIN_AUTH_REQUIRED');
      await error('/internal/collect/status', 'GET', 401, 'COLLECTOR_AUTH_REQUIRED');
    }
  );
  await t.test(
    'JSON parsing precedes guards; collection maintenance precedes validation while normal API validates first',
    async () => {
      const json = { 'Content-Type': 'application/json' };
      for (const path of ['/api/v1/admin/posts', '/api/v1/admin/collect/candidates']) {
        await error(path, 'POST', 400, 'VALIDATION_FAILED', json, '{');
        await error(
          path,
          'POST',
          413,
          'REQUEST_TOO_LARGE',
          json,
          JSON.stringify({ value: 'x'.repeat(262144) })
        );
      }
      await error(
        '/api/v1/admin/posts',
        'POST',
        400,
        'VALIDATION_FAILED',
        { ...auth, ...json },
        '{}'
      );
      const maintenance = await error(
        '/api/v1/admin/collect/candidates',
        'POST',
        503,
        'MAINTENANCE_READ_ONLY',
        { ...auth, ...json },
        '{}'
      );
      assert.equal(maintenance.headers.get('retry-after'), '60');
      const publicRead = await fetch(base + '/api/v1/boards');
      assert.equal(publicRead.status, 200);
      await publicRead.body?.cancel();
      const publicMutation = await error(
        '/api/v1/boards/meme/posts/1/views',
        'POST',
        503,
        'MAINTENANCE_READ_ONLY'
      );
      assert.equal(publicMutation.headers.get('retry-after'), '60');
      await error(
        '/api/v1/boards/meme/posts/1/views',
        'POST',
        400,
        'VALIDATION_FAILED',
        { 'Content-Type': 'text/plain' },
        'unexpected'
      );
      const live = await fetch(base + '/internal/health/live', { method: 'HEAD' });
      assert.equal(live.status, 200);
      assert.equal(await live.text(), '');
    }
  );
  await t.test(
    'view increment requires an empty body and emits a bodyless 204 without cookie or content type',
    async () => {
      const row = requiredRow(
        await fixture.query(
          "INSERT INTO content.board_post(board_id,title,status,published_at,created_by,created_at,updated_by,updated_at) SELECT id,'HTTP fixture','PUBLISHED',now(),'system:migration',now(),'system:migration',now() FROM content.board WHERE slug='meme' RETURNING id"
        )
      );
      assert.equal(typeof row.id, 'string');
      const enabled = await createNestApplication({ databaseUrl });
      try {
        await enabled.listen(0, '127.0.0.1');
        const url =
          (await enabled.getUrl()) + '/api/v1/boards/meme/posts/' + String(row.id) + '/views';
        for (const contentType of ['text/plain', 'application/json']) {
          const rejected = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': contentType },
            body: '{}',
          });
          assert.equal(rejected.status, 400);
          await rejected.body?.cancel();
        }
        const response = await fetch(url, { method: 'POST' });
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
        assert.equal(response.headers.get('content-type'), null);
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(
          requiredRow(
            await fixture.query('SELECT view_count FROM content.board_post WHERE id=$1', [row.id])
          ).view_count,
          '1'
        );
      } finally {
        await enabled.close();
      }
    }
  );
});
