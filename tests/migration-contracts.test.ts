import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { object } from './helpers/browser-values.ts';
await test('migration SQL stays immutable and explicit contract evolution matches canonical specs', async () => {
  const manifest = object(
    JSON.parse(await readFile('docs/migration/contract-baseline.json', 'utf8'))
  );
  const hashes = object(manifest.files);
  const evolution = object(JSON.parse(await readFile('docs/migration/contract-evolution.json', 'utf8')));
  const amendments = object(evolution.amendedContracts);
  const additions = object(evolution.addedMigrations);
  const currentHashes = { ...hashes };
  for (const [path, value] of Object.entries(amendments)) {
    const change = object(value);
    assert.ok(path.startsWith('packages/contracts/') && !path.endsWith('.sql'));
    assert.equal(change.baselineSha256, hashes[path]);
    assert.ok(typeof change.reason === 'string' && change.reason.length > 20);
    assert.ok(typeof change.sha256 === 'string');
    currentHashes[path] = change.sha256;
  }
  for (const [path, hash] of Object.entries(additions)) {
    assert.ok(!Object.hasOwn(hashes, path));
    assert.match(path, /^(apps\/api\/migrations\/V\d+__[^/]+|apps\/collector\/src\/main\/resources\/db\/collector-v\d+)\.sql$/);
    assert.equal(typeof hash, 'string');
    currentHashes[path] = hash;
  }
  assert.ok(Object.keys(hashes).length >= 16);
  for (const [path, hash] of Object.entries(currentHashes)) {
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
    Object.keys(currentHashes)
      .filter((path) => path.startsWith('apps/api/migrations/'))
      .sort()
  );
  assert.deepEqual(
    (await readdir('apps/collector/src/main/resources/db')).filter(name => /^collector-v\d+\.sql$/.test(name))
      .map(name => 'apps/collector/src/main/resources/db/' + name).sort(),
    Object.keys(currentHashes).filter(path => path.startsWith('apps/collector/src/main/resources/db/')).sort()
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
