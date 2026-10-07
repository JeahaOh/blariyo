import test from 'node:test';
import assert from 'node:assert/strict';
import {runBatch} from './scheduled-batch.mjs';
import {mkdtemp, open, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {batchReports, collectWithRecovery} from './batch-schedule-retry.mjs';

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

test('real child report output drives a targeted retry and final success', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blariyo-retry-process-'));
  const called = [];
  try {
    const result = await collectWithRecovery({signal:new AbortController().signal, deadline:Date.now() + 5000,
      ready:async () => true, wait:async () => {}, publish:async () => {}, retryDelays:[1],
      run:async (sources, timeoutMs) => {
        called.push(sources);
        const path = join(directory, `attempt-${called.length}.log`);
        const output = await open(path, 'wx', 0o600);
        const report = {source:'test', state:sources ? 'COMPLETED' : 'FAILED', errors:sources ? [] : ['SOURCE_DNS_FAILED']};
        let exitCode;
        try {
          exitCode = await runBatch({args:['-e', 'console.log(process.argv[1]);process.exit(Number(process.argv[2]))',
            JSON.stringify({report}), sources ? '0' : '1'], timeoutMs, stdio:['ignore', output.fd, output.fd]});
        } finally {await output.close();}
        return {exitCode, reports:batchReports(await readFile(path, 'utf8'))};
      },
    });
    assert.deepEqual(called, [undefined, ['test']]);
    assert.equal(result.state, 'COMPLETED');
    assert.equal(result.exitCode, 0);
  } finally {await rm(directory, {recursive:true, force:true});}
});
