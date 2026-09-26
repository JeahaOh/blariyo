import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { acquireTaskLeases, inspectTaskLeases } from '../../scripts/harness/leases.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-leases-'));
  const stateRoot = join(root, 'harness-cache');
  git(root, 'init', '--initial-branch=main');
  const priorStateRoot = process.env.HARNESS_STATE_ROOT;
  process.env.HARNESS_STATE_ROOT = stateRoot;
  t.after(async () => {
    if (priorStateRoot === undefined) delete process.env.HARNESS_STATE_ROOT;
    else process.env.HARNESS_STATE_ROOT = priorStateRoot;
    await rm(root, { recursive: true, force: true });
  });
  return { root, stateRoot };
}

test('task and named resource leases serialize work and release only their own locks', async (t) => {
  const { root } = await fixture(t);
  const owner = await acquireTaskLeases('HARN-06', ['database:test', 'port:4310'], root);
  const blocked = await inspectTaskLeases('HARN-07', ['database:test'], root);
  assert.deepEqual(
    blocked.locks.map(({ name, state }) => [name, state]),
    [
      ['task:HARN-07', 'ABSENT'],
      ['resource:database:test', 'LOCKED'],
    ]
  );
  assert.equal(blocked.available, false);
  await assert.rejects(acquireTaskLeases('HARN-07', ['database:test'], root), /already held/);
  const afterRejectedAcquire = await inspectTaskLeases('HARN-07', ['database:test'], root);
  assert.equal(afterRejectedAcquire.locks[0].state, 'AVAILABLE');
  assert.equal(afterRejectedAcquire.locks[1].state, 'LOCKED');
  await owner.release();
  await owner.release();
  const released = await inspectTaskLeases('HARN-07', ['database:test'], root);
  assert.equal(released.available, true);
  assert.ok(released.locks.every((lock) => lock.state === 'AVAILABLE'));
});

test('the operating system releases a crashed lease holder without killing another process', async (t) => {
  const { root, stateRoot } = await fixture(t);
  const source = resolve(import.meta.dirname, '../../scripts/harness/leases.mjs');
  const code =
    `import { acquireTaskLeases } from ${JSON.stringify(pathToFileURL(source).href)};\n` +
    `await acquireTaskLeases('HARN-06', ['database:test'], ${JSON.stringify(root)});\n` +
    `console.log('LEASE_READY');\nsetInterval(() => {}, 1000);\n`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
    cwd: root,
    env: { ...process.env, HARNESS_STATE_ROOT: stateRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  child.stdout.setEncoding('utf8');
  const ready = new Promise((resolveReady, rejectReady) => {
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes('LEASE_READY')) resolveReady();
    });
    child.once('error', rejectReady);
    child.once('exit', (codeValue) => {
      if (!stdout.includes('LEASE_READY'))
        rejectReady(new Error(`lease child exited ${codeValue}`));
    });
  });
  await ready;
  const active = await inspectTaskLeases('HARN-07', ['database:test'], root);
  assert.equal(active.available, false);
  child.kill('SIGTERM');
  await new Promise((resolveExit) => child.once('exit', resolveExit));
  const released = await inspectTaskLeases('HARN-07', ['database:test'], root);
  assert.equal(released.available, true);
});
