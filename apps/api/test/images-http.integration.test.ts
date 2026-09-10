import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { localStorage } from '../dist/adapters/storage.js';
function object(value: unknown): Record<string, unknown> {
  return requiredRow([value]);
}
const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_NEST_DATABASE_URL required');
await test('Nest image authentication, multipart validation, storage and discard outbox remain atomic', async (t) => {
  const pg = await createDataSource(databaseUrl).initialize();
  t.after(() => pg.destroy());
  const migration = await migrationContext(databaseUrl);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const directory = await mkdtemp(join(tmpdir(), 'nest-images-'));
  const token = 't'.repeat(40),
    actor = 'admin:v1:' + 'a'.repeat(43);
  const app = await createNestApplication({
    databaseUrl,
    storage: localStorage(directory),
    serviceToken: token,
  });
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const headers = { 'X-Blariyo-Service-Token': token, 'X-Blariyo-Admin-Actor': actor };
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  const form = (invalid = false) => {
    const f = new FormData();
    f.append('files', new Blob([Uint8Array.from(png)], { type: 'image/png' }), 'valid.png');
    if (invalid) f.append('files', new Blob(['bad'], { type: 'image/png' }), 'invalid.png');
    return f;
  };
  const unauthorized = await fetch(origin + '/api/v1/admin/images', {
    method: 'POST',
    body: form(true),
  });
  assert.equal(unauthorized.status, 401);
  const invalid = await fetch(origin + '/api/v1/admin/images', {
    method: 'POST',
    headers,
    body: form(true),
  });
  assert.equal(invalid.status, 415);
  assert.deepEqual(object(object(await invalid.json()).error).fields, [
    { field: 'files[1]', reason: 'decode' },
  ]);
  assert.equal(
    requiredRow(await pg.query('SELECT count(*) FROM content.board_post_image')).count,
    '0'
  );
  const response = await fetch(origin + '/api/v1/admin/images', {
    method: 'POST',
    headers,
    body: form(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = object(await response.json());
  const image = requiredRow(rows(object(body.data).items));
  assert.equal(typeof image.previewPath, 'string');
  assert.equal(typeof image.imageId, 'number');
  assert.equal(image.width, 10);
  assert.equal(image.status, 'STAGED');
  const preview = await fetch(origin + String(image.previewPath), { headers });
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('content-type'), 'image/png');
  assert.equal(preview.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await sharp(Buffer.from(await preview.arrayBuffer())).metadata()).width, 10);
  const discard = await fetch(origin + `/api/v1/admin/images/${String(image.imageId)}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(discard.status, 202);
  assert.equal(object(object(await discard.json()).data).status, 'PRIVATE_DELETE_PENDING');
  const task = requiredRow(
    await pg.query(
      "SELECT * FROM ops.outbox_task WHERE aggregate_type='IMAGE' AND aggregate_id=$1",
      [image.imageId]
    )
  );
  assert.equal(task.type, 'OBJECT_DELETE_PRIVATE');
  assert.equal(task.created_by, actor);
  assert.equal((await fetch(origin + String(image.previewPath), { headers })).status, 404);
  assert.equal(
    (
      await fetch(origin + `/api/v1/admin/images/${String(image.imageId)}`, {
        method: 'DELETE',
        headers,
      })
    ).status,
    409
  );
});
