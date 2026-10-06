import test from 'node:test';
import assert from 'node:assert/strict';
import {runBatch} from './scheduled-batch.mjs';

test('preserves batch failures instead of reporting success', async () => {
  assert.equal(await runBatch({args:['-e', 'process.exit(7)'], stdio:'ignore'}), 7);
});

test('terminates a stuck batch even when it ignores SIGTERM', async () => {
  const started = Date.now();
  assert.equal(await runBatch({args:['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
    timeoutMs:500, graceMs:100, stdio:'ignore'}), 124);
  assert.ok(Date.now() - started < 5000);
});

test('failed executable rejects without leaving timers behind', async () => {
  await assert.rejects(runBatch({command:'/nonexistent/blariyo-node', stdio:'ignore'}), {code:'ENOENT'});
});
