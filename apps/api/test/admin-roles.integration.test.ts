import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource } from '../dist/persistence/database.js';
import { contractJson } from './contract-response.js';

await test('D04-T1/T2/T3: real Core HTTP enforces role after token and actor validation', async (t) => {
  const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(databaseUrl);
  const migration = await migrationContext(databaseUrl);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const db = await createDataSource(databaseUrl).initialize();
  t.after(() => db.destroy());
  const token = randomBytes(32).toString('hex');
  const actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  const app = await createNestApplication({ databaseUrl, serviceToken: token, collectManualUrlEnabled: true });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const headers = { 'X-Blariyo-Service-Token': token, 'X-Blariyo-Admin-Actor': actor };
  for (const role of ['OWNER', 'EDITOR']) {
    const response = await fetch(origin + '/api/v1/admin/posts', { headers: { ...headers, 'X-Blariyo-Admin-Role': role } });
    assert.equal(response.status, 200);
    await contractJson('searchAdminPosts', response);
  }
  for (const role of ['', 'ADMIN', 'owner', 'OWNER,EDITOR']) {
    const response = await fetch(origin + '/api/v1/admin/posts', { headers: { ...headers, 'X-Blariyo-Admin-Role': role } });
    assert.equal(response.status, 403);
    await contractJson('searchAdminPosts', response);
  }
  const direct = await fetch(origin + '/api/v1/admin/posts', { headers: { 'X-Blariyo-Admin-Actor': actor, 'X-Blariyo-Admin-Role': 'OWNER' } });
  assert.equal(direct.status, 401);
  const before: unknown = await db.query('SELECT * FROM collect.source ORDER BY id');
  for (const [role, status] of [['EDITOR', 403], ['OWNER', 400]] as const) {
    const response = await fetch(origin + '/api/v1/admin/collect/sources/1', {
      method: 'PATCH', headers: { ...headers, 'X-Blariyo-Admin-Role': role, 'Content-Type': 'application/json' }, body: '{}',
    });
    // OWNER reaches body validation; EDITOR is rejected before any source mutation.
    assert.equal(response.status, status);
    await contractJson('updateCollectionSource', response, 'PATCH');
  }
  assert.deepEqual(await db.query('SELECT * FROM collect.source ORDER BY id'), before);
});
