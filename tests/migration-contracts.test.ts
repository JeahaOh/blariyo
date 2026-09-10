import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { object } from './helpers/browser-values.ts';
await test('migration-start SQL, OpenAPI and generated API contracts remain byte-identical', async () => {
  const manifest = object(
    JSON.parse(await readFile('docs/migration/contract-baseline.json', 'utf8'))
  );
  const hashes = object(manifest.files);
  assert.ok(Object.keys(hashes).length >= 16);
  for (const [path, hash] of Object.entries(hashes)) {
    assert.equal(typeof hash, 'string');
    assert.equal(
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
      hash,
      path
    );
  }
  const sql = (await readdir('apps/api/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => 'apps/api/migrations/' + name)
    .sort();
  assert.deepEqual(
    sql,
    Object.keys(hashes)
      .filter((path) => path.startsWith('apps/api/migrations/'))
      .sort()
  );
  for (const [canonical, packaged] of [
    [
      'docs/development-specs/m0-core/openapi/m0-core.yaml',
      'packages/contracts/openapi/m0-core.yaml',
    ],
    [
      'docs/development-specs/m0-collection-assist/openapi/m0-collection-assist.yaml',
      'packages/contracts/openapi/m0-collection-assist.yaml',
    ],
  ]) {
    assert.ok(canonical && packaged);
    assert.equal(await readFile(canonical, 'utf8'), await readFile(packaged, 'utf8'));
  }
});
