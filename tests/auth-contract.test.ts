import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyAccessIdentity } from '../apps/web/server/utils/access.mjs';
import {
  matchOperation,
  projectResponse,
  validateResponse,
} from '../packages/contracts/src/index.mjs';
import { contractData } from '../apps/api/test/contract-response.ts';
await test('identity fixture verifies signature, expiry, issuer, audience and allowlist', async () => {
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
    operators: [{ identity: 'fixture-subject', operatorId: 'stable-local-operator', active: true }],
  };
  assert.equal(await verifyAccessIdentity(token, config), 'stable-local-operator');
  await assert.rejects(verifyAccessIdentity(token, { ...config, issuer: 'https://wrong.invalid' }));
  await assert.rejects(verifyAccessIdentity(token, { ...config, audience: 'wrong' }));
  await assert.rejects(
    verifyAccessIdentity(token, { ...config, operators: [] }),
    (e: unknown) => typeof e === 'object' && e !== null && 'statusCode' in e && e.statusCode === 403
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
});
await test('operator registry grants only active exact identities and rejects ambiguous configuration', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const issuer = 'https://identity.example.invalid';
  const audience = 'fixture';
  const entry = { identity: 'fixture-subject', operatorId: 'stable-local-operator', active: true };
  const tokenFor = (subject: string) =>
    new SignJWT({ email: 'owner@example.invalid' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(subject)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('2m')
      .sign(privateKey);
  const token = await tokenFor(entry.identity);
  const check = (assertion: string, operators: unknown) =>
    verifyAccessIdentity(assertion, { issuer, audience, key: publicKey, operators });
  const denied = (e: unknown) =>
    typeof e === 'object' && e !== null && 'statusCode' in e && e.statusCode === 403;
  const malformed: unknown[] = [
    null,
    {},
    { 'fixture-subject': entry.operatorId },
    [null],
    [[entry]],
    [{ ...entry, active: 'true' }],
    [{ identity: entry.identity, operatorId: entry.operatorId }],
    [{ ...entry, operatorId: '' }],
    [{ ...entry, operatorId: ' trailing ' }],
    [{ ...entry, identity: ' fixture-subject' }],
    [{ ...entry, identity: 7 }],
    [entry, { ...entry, operatorId: 'someone-else' }],
    [entry, { ...entry, active: false }],
    [entry, { identity: 'another' }],
  ];
  for (const operators of malformed) await assert.rejects(check(token, operators), denied);
  await assert.rejects(check(token, [{ ...entry, active: false }]), denied);
  await assert.rejects(check(await tokenFor('unregistered-subject'), [entry]), denied);
  await assert.rejects(check(await tokenFor(''), [entry]), denied);
  await assert.rejects(check(await tokenFor('constructor'), [entry]), denied);
  await assert.rejects(check(token, [{ ...entry, identity: 'owner@example.invalid' }]), denied);
  assert.equal(
    await check(token, [entry, { ...entry, identity: 'former-subject', active: false }]),
    entry.operatorId
  );
  await assert.rejects(
    check(await tokenFor('former-subject'), [
      entry,
      { ...entry, identity: 'former-subject', active: false },
    ]),
    denied
  );
  const wrongKey = await generateKeyPair('RS256');
  await assert.rejects(
    verifyAccessIdentity(token, { issuer, audience, key: wrongKey.publicKey, operators: [entry] })
  );
});
await test('BFF response projection removes unexpected private fields at every level', () => {
  const operation = matchOperation('GET', '/api/v1/boards');
  assert.ok(operation);
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
  assert.equal(contractData('listBoards', '/api/v1/boards', 200, projected).items[0]?.slug, 'meme');
});
