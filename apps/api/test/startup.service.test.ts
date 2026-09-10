import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCollectorTokens } from '../dist/bootstrap/startup.js';

await test('disabled collection never reads a token file', async () => {
  let reads = 0;
  const tokens = await loadCollectorTokens(
    { collectManualUrlEnabled: false, collectDiscordCommandEnabled: false },
    { COLLECTOR_TOKENS_FILE: '/missing/collector-tokens.json' },
    async () => {
      reads++;
      throw new Error('token file must not be read');
    }
  );
  assert.deepEqual(tokens, []);
  assert.equal(reads, 0);
});
await test('enabled collection reads the configured UTF-8 token artifact and validates its shape', async () => {
  let requested: { path: string; encoding: string } | undefined;
  const credential = { collectorId: 'fixture', tokenSha256: 'a'.repeat(64), scopes: ['collect'] };
  const tokens = await loadCollectorTokens(
    { collectManualUrlEnabled: true },
    { COLLECTOR_TOKENS_FILE: '/fixture/collector-tokens.json' },
    async (path, encoding) => {
      requested = { path, encoding };
      return JSON.stringify([credential]);
    }
  );
  assert.deepEqual(tokens, [credential]);
  assert.deepEqual(requested, { path: '/fixture/collector-tokens.json', encoding: 'utf8' });
  for (const invalid of [
    '["fixture-token"]',
    '{}',
    JSON.stringify([{ ...credential, scopes: [1] }]),
    JSON.stringify([{ ...credential, contractVersion: 2 }]),
  ])
    await assert.rejects(
      loadCollectorTokens(
        { collectManualUrlEnabled: true },
        { COLLECTOR_TOKENS_FILE: '/fixture/collector-tokens.json' },
        async () => invalid
      ),
      /COLLECTOR_TOKENS_INVALID/
    );
});
