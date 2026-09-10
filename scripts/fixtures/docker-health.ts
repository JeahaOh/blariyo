import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const maintenance = process.argv[2] === 'maintenance';
const base = maintenance ? 'http://maintenance:3100' : 'http://api:3100';
let listening = false;
for (let i = 0; i < 100; i++) {
  try {
    listening = (await fetch(base + '/internal/health/live')).ok;
  } catch {
    /* startup */
  }
  if (listening) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
assert.ok(listening);
assert.deepEqual(await (await fetch(base + '/internal/health/live')).json(), { status: 'UP' });
assert.equal((await fetch(base + '/internal/health/ready')).status, 200);
assert.equal((await fetch(base + '/api/v1/boards')).status, 200);
const response = await fetch(base + '/api/v1/admin/posts', {
  method: 'POST',
  headers: {
    'X-Blariyo-Service-Token': process.env.SERVICE_TOKEN || '',
    'X-Blariyo-Admin-Actor': 'admin:v1:' + 'a'.repeat(43),
    'Content-Type': 'application/json',
    'Idempotency-Key': randomUUID(),
  },
  body: maintenance
    ? JSON.stringify({
        boardSlug: 'meme',
        title: 'Maintenance rejected fixture',
        source: null,
        pinnedPosition: null,
        blocks: [{ type: 'TEXT', text: 'Synthetic input' }],
      })
    : '{}',
});
if (maintenance) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body: unknown = await response.json();
  assert.ok(
    body &&
      typeof body === 'object' &&
      'error' in body &&
      body.error &&
      typeof body.error === 'object' &&
      'code' in body.error
  );
  assert.equal(body.error.code, 'MAINTENANCE_READ_ONLY');
} else {
  assert.equal(response.status, 400);
}
