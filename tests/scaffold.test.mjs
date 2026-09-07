import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('implementation OpenAPI is identical to the canonical input', async () => {
  const [docs, contract] = await Promise.all(
    [
      'docs/development-specs/m0-core/openapi/m0-core.yaml',
      'packages/contracts/openapi/m0-core.yaml',
    ].map((f) => readFile(f, 'utf8'))
  );
  assert.equal(contract, docs);
});
