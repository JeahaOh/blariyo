import test from 'node:test';
import assert from 'node:assert/strict';
import { permitsAdminOperation } from '../dist/http/admin-permissions.js';

await test('D04-T1/T2: roles permit editorial work and restrict management operations', () => {
  for (const operation of ['createPost', 'uploadImages', 'reviewBatchItem', 'promoteBatchItem', 'createDirectCollectionRequest', 'listRuntimeCollectionSources']) {
    for (const role of ['OWNER', 'EDITOR']) assert.equal(permitsAdminOperation(role, operation), true);
  }
  for (const operation of ['updateCollectionSource', 'listCollectorOperationalEvents', 'acknowledgeCollectorOperationalEvent']) {
    assert.equal(permitsAdminOperation('OWNER', operation), true);
    assert.equal(permitsAdminOperation('EDITOR', operation), false);
  }
});
await test('D04-T3: missing, unknown roles and unclassified operations fail closed', () => {
  for (const role of ['', 'owner', 'ADMIN', 'OWNER,EDITOR']) assert.equal(permitsAdminOperation(role, 'createPost'), false);
  for (const role of ['OWNER', 'EDITOR']) assert.equal(permitsAdminOperation(role, 'newUnclassifiedAdminOperation'), false);
});
