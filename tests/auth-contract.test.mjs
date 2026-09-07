import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyAccessIdentity } from '../apps/web/server/utils/access.mjs';
import {
  matchOperation,
  projectResponse,
  validateResponse,
} from '../packages/contracts/src/index.mjs';
import { authenticateCore } from '../apps/api/src/auth.mjs';
test('identity fixture verifies signature, expiry, issuer, audience and allowlist', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('fixture-subject')
    .setIssuer('https://identity.example.invalid')
    .setAudience('fixture')
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privateKey);
  const config = {
    issuer: 'https://identity.example.invalid',
    audience: 'fixture',
    key: publicKey,
    operators: { 'fixture-subject': 'stable-local-operator' },
  };
  assert.equal(await verifyAccessIdentity(token, config), 'stable-local-operator');
  await assert.rejects(verifyAccessIdentity(token, { ...config, issuer: 'https://wrong.invalid' }));
  await assert.rejects(verifyAccessIdentity(token, { ...config, audience: 'wrong' }));
  await assert.rejects(
    verifyAccessIdentity(token, { ...config, operators: {} }),
    (e) => e.statusCode === 403
  );
  const expired = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('fixture-subject')
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt(1)
    .setExpirationTime(2)
    .sign(privateKey);
  await assert.rejects(verifyAccessIdentity(expired, config));
  assert.throws(
    () => authenticateCore({ get: () => '' }, 'x'.repeat(32)),
    (e) => e.status === 401
  );
  assert.throws(
    () =>
      authenticateCore(
        {
          get: (header) => (header === 'X-Blariyo-Service-Token' ? 'x'.repeat(32) : 'raw-subject'),
        },
        'x'.repeat(32)
      ),
    (e) => e.status === 403
  );
});
test('BFF response projection removes unexpected private fields at every level', () => {
  const operation = matchOperation('GET', '/api/v1/boards');
  const data = {
    success: true,
    data: {
      items: [
        {
          slug: 'meme',
          displayName: '짤',
          postingPolicy: 'ADMIN',
          path: '/meme',
          privateStorageKey: 'secret',
        },
      ],
      secret: 'secret',
    },
    meta: { requestId: 'fixture' },
    secret: 'secret',
  };
  assert.equal(validateResponse(operation, 200, data), true);
  const projected = projectResponse(operation, 200, data);
  assert.ok(!JSON.stringify(projected).includes('secret'));
  assert.equal(projected.data.items[0].slug, 'meme');
});

test('maintenance keeps public reads and rejects mutations with retry metadata', async (t) => {
  const { createApp } = await import('../apps/api/src/app.mjs');
  const server = createApp({ query: async () => ({ rows: [] }) }, { maintenance: true }).listen(
    0,
    '127.0.0.1'
  );
  await new Promise((r) => server.once('listening', r));
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      })
  );
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin + '/api/v1/boards')).status, 200);
  const mutation = await fetch(origin + '/api/v1/boards/meme/posts/1/views', { method: 'POST' });
  assert.equal(mutation.status, 503);
  assert.equal(mutation.headers.get('retry-after'), '60');
  assert.equal(mutation.headers.get('cache-control'), 'no-store');
  assert.equal((await mutation.json()).error.code, 'MAINTENANCE_READ_ONLY');
  const invalid = await fetch(origin + '/api/v1/boards/meme/posts/1/views', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'unexpected',
  });
  assert.equal(invalid.status, 400);
});
