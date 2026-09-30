import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { executeRetention } from './run-collect-retention.mjs';

await test('retention wrapper uses a real child; notification failure leaves purge result and never leaks its raw output', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-retention-alert-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = resolve(root, 'fixture');
  await writeFile(executable, `#!${process.execPath}\nconsole.error('synthetic-secret-must-not-leak');console.log(JSON.stringify({purged:2,failed:0}));\n`);
  await chmod(executable, 0o700); const observed = [];
  const result = await executeRetention({ executable, args: ['--once', '--write-db'], env: {}, incidents: {
    observe: async e => { observed.push(e); throw Error('synthetic-secret-must-not-leak'); },
  } });
  assert.equal(result.state, 'PURGED_VERIFIED'); assert.equal(result.purged, 2); assert.equal(observed[0].errorCode, null);
  assert.equal(result.notification.errorCode, 'ALERT_STATE_FAILED'); assert(!JSON.stringify(result).includes('synthetic-secret'));
  await writeFile(executable, `#!${process.execPath}\nconsole.error('BATCH_RETENTION_FAILED code=OBJECT_DELETE_DENIED');console.log(JSON.stringify({purged:0,failed:1}));process.exitCode=1;\n`);
  const failed = await executeRetention({ executable, args: ['--once', '--write-db'], env: {}, incidents: { observe: async e => {
    observed.push(e); return { pending: 1, sent: 0 };
  } } });
  assert.equal(failed.state, 'FAILED'); assert.equal(failed.errorCode, 'OBJECT_DELETE_DENIED'); assert.equal(observed[1].job, 'COLLECT_RETENTION');
});
