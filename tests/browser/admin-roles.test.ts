import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';

await test('D04-T1/T3/T4: signed Access BFF identities, forged role ignored and live registry revocation', { timeout: 90000 }, async (t) => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'local-fixture', alg: 'RS256', use: 'sig' };
  const identityPaths: string[] = [];
  const identity = createServer((req, res) => {
    identityPaths.push(req.url ?? '');
    if (req.url !== '/cdn-cgi/access/certs') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }));
  });
  identity.listen(0, '127.0.0.1'); await once(identity, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => identity.close((error) => error ? reject(error) : resolve())));
  const address = identity.address(); assert.ok(address && typeof address === 'object');
  const issuer = `http://127.0.0.1:${address.port}`, audience = 'm0-local-fixture';
  const owner = { identity: 'synthetic-owner', operatorId: 'fixture-owner', role: 'OWNER', active: true };
  const editor = { identity: 'synthetic-editor', operatorId: 'fixture-editor', role: 'EDITOR', active: true };
  const fixture = await browserFixture(t, { accessAuth: { issuer, audience, operators: [owner, editor] } });
  const browser = await launchBrowser(); t.after(() => browser.close());
  const tokenFor = (subject: string) => new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).setSubject(subject).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('2m').sign(privateKey);
  const token = await tokenFor(editor.identity);
  const context = await browser.newContext({ extraHTTPHeaders: { 'cf-access-jwt-assertion': token, 'x-admin-role': 'OWNER' } });
  const external: string[] = [];
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === fixture.origin) return route.continue();
    if (route.request().url() === 'https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3') return route.fulfill({ contentType: 'application/javascript', body: '' });
    external.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  await page.goto(fixture.origin + '/admin');
  await expect(page.getByRole('button', { name: '새 초안', exact: true })).toBeVisible();
  assert.equal((await context.request.get(fixture.origin + '/api/v1/admin/posts?page=1')).status(), 200);
  assert.equal((await context.request.get(fixture.origin + '/api/admin/features')).status(), 200);
  await page.goto(fixture.origin + '/admin/common-codes');
  await expect(page.getByRole('heading', { name: '출처 코드 21개' })).toBeVisible();
  await expect(page.getByRole('button', { name: '코드 등록', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '더쿠 수정', exact: true })).toHaveCount(0);
  assert.equal((await context.request.post(fixture.origin + '/api/v1/admin/common-code-groups/source/codes', {
    headers: { Origin: fixture.origin, 'X-Blariyo-Admin-Role': 'OWNER' },
    data: { code: 'test', referenceKey: 'forged-editor', displayName: '위조 권한' },
  })).status(), 403);
  // No browser reload, new token or server restart: the next BFF call must read the changed registry.
  await fixture.setOperators([owner, { ...editor, active: false }]);
  assert.equal((await context.request.get(fixture.origin + '/api/v1/admin/posts?page=1')).status(), 403);
  assert.equal((await context.request.get(fixture.origin + '/api/admin/features')).status(), 403);
  await fixture.setOperators([owner, editor]);
  assert.equal((await context.request.get(fixture.origin + '/api/v1/admin/posts?page=1')).status(), 200);
  await fixture.setOperators([owner, { ...editor, role: 'ADMIN' }]);
  assert.equal((await context.request.get(fixture.origin + '/api/v1/admin/posts?page=1')).status(), 403);
  await fixture.setOperators([owner, editor]);
  assert.equal((await context.request.get(fixture.origin + '/api/v1/admin/posts?page=1', { headers: { 'cf-access-jwt-assertion': await tokenFor(owner.identity) } })).status(), 200);
  assert.equal((await context.request.get(fixture.origin + '/api/v1/admin/posts?page=1', { headers: { 'cf-access-jwt-assertion': token + 'broken' } })).status(), 401);
  assert.equal(identityPaths.length, 1, 'JWKS caching must not cache registry membership');
  assert.deepEqual(identityPaths, ['/cdn-cgi/access/certs']); assert.deepEqual(external, []);
});
