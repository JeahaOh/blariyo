import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildJobReceipt, writeJobReceipt } from '../../scripts/harness/job-receipt.mjs';

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function repository(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'harness-job-receipt-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Receipt Test');
  git(root, 'config', 'user.email', 'receipt@example.invalid');
  const file = resolve(root, 'tracked.txt');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(file, 'safe fixture\n'));
  git(root, 'add', 'tracked.txt');
  git(root, 'commit', '-m', 'test: receipt fixture');
  return root;
}

function env(root, changes = {}) {
  return {
    JOB_NAME: 'quality',
    JOB_STATUS: 'success',
    GITHUB_RUN_ID: '123456',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_EVENT_NAME: 'pull_request',
    SUBJECT_SHA: git(root, 'rev-parse', 'HEAD'),
    CONTEXT_SHA256: 'a'.repeat(64),
    BINDINGS_SHA256: 'b'.repeat(64),
    ...changes,
  };
}

test('job receipt binds the exact checkout, CI attempt, and task/change digests without source data', async (t) => {
  const root = await repository(t);
  const receipt = buildJobReceipt(env(root), root);
  assert.equal(receipt.checkoutMatchesSubject, true);
  assert.equal(receipt.run.attempt, 2);
  assert.equal(receipt.contextSha256, 'a'.repeat(64));
  assert.equal(receipt.bindingsSha256, 'b'.repeat(64));
  assert.equal(JSON.stringify(receipt).includes('safe fixture'), false);

  const path = resolve(root, 'receipt.json');
  await writeJobReceipt(path, env(root, { RESTORE_REQUIRED: 'false' }), root);
  const stored = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(stored.restoreRequired, false);
  assert.equal(stored.receiptType, 'ci-job');
  await assert.rejects(writeJobReceipt(path, env(root), root), /EEXIST/);
});

test('job receipts fail closed on missing or malformed identity and record checkout mismatch', async (t) => {
  const root = await repository(t);
  assert.throws(() => buildJobReceipt(env(root, { CONTEXT_SHA256: '' }), root), /inputs missing/);
  assert.throws(() => buildJobReceipt(env(root, { SUBJECT_SHA: 'deadbeef' }), root), /subject SHA/);
  assert.throws(
    () => buildJobReceipt(env(root, { JOB_STATUS: 'warning' }), root),
    /invalid result/
  );
  const mismatch = buildJobReceipt(env(root, { SUBJECT_SHA: 'c'.repeat(40) }), root);
  assert.equal(mismatch.checkoutMatchesSubject, false);
});
