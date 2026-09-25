import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { acquireTaskLeases, inspectTaskLeases } from '../../scripts/harness/leases.mjs';
import {
  handoffTask,
  inspectTaskResume,
  taskReady,
  taskLeaseSpec,
  verificationEnvironment,
  verifyTask,
} from '../../scripts/harness/verify.mjs';

test('verification subprocess receives only runtime environment keys, not credential variables', () => {
  assert.deepEqual(
    verificationEnvironment({
      PATH: '/usr/bin',
      HOME: '/tmp/user',
      npm_execpath: '/npm/npm-cli.js',
      AWS_ACCESS_KEY_ID: 'synthetic-secret',
      TEST_DATABASE_ADMIN_URL: 'postgresql://synthetic-secret',
    }),
    {
      PATH: '/usr/bin',
      HOME: '/tmp/user',
      npm_execpath: '/npm/npm-cli.js',
    }
  );
});

test('registered verification commands include the quality baseline regression suite', async (t) => {
  const root = await fixture(t);
  const manifestPath = join(root, '.harness/tasks/HARN-06.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.verification = [
    'test:harness',
    'test:quality',
    'lint:harness',
    'lint:all',
    'test:architecture',
  ];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  assert.deepEqual(await taskLeaseSpec('HARN-06', root), {
    root: await realpath(root),
    resources: [],
  });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-verify-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init', '--initial-branch=feature/HARN-06-verify-tests');
  git(root, 'config', 'user.name', 'Harness Verify Test');
  git(root, 'config', 'user.email', 'verify@example.invalid');
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await mkdir(join(root, '.harness/tasks'), { recursive: true });
  await cp(join(sourceRoot, '.harness/policy.json'), join(root, '.harness/policy.json'));
  const sourceTask = JSON.parse(
    await readFile(join(sourceRoot, '.harness/tasks/HARN-06.json'), 'utf8')
  );
  await writeFile(
    join(root, '.harness/tasks/HARN-06.json'),
    JSON.stringify(
      {
        ...sourceTask,
        state: 'in-progress',
        verification: ['test:harness'],
      },
      null,
      2
    )
  );
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'verify-fixture',
      private: true,
      type: 'module',
      scripts: { 'test:harness': 'node scripts/check.mjs' },
    })
  );
  await writeFile(
    join(root, 'scripts/check.mjs'),
    "console.log('# tests 1\\n# pass 1\\n# fail 0\\n# skipped 0');\n"
  );
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore: create verify fixture');
  return root;
}

test('verify records local evidence bound to HEAD, source, task manifest, and policy; ready is read-only', async (t) => {
  const root = await fixture(t);
  const manifestPath = join(root, '.harness/tasks/HARN-06.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.resources = ['database:test'];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const competing = await acquireTaskLeases('HARN-07', ['database:test'], root);
  await assert.rejects(verifyTask('HARN-06', root), /lease is already held/);
  const releasedAfterConflict = await inspectTaskLeases('HARN-06', ['database:test'], root);
  assert.equal(releasedAfterConflict.locks[0].state, 'AVAILABLE');
  await competing.release();

  const report = await verifyTask('HARN-06', root);
  assert.equal(report.state, 'PASS');
  assert.equal(report.checks[0].tests, 1);
  assert.match(report.sourceFingerprint.before, /^[a-f0-9]{64}$/);
  assert.deepEqual(await taskReady('HARN-06', root), {
    taskId: 'HARN-06',
    ready: true,
    reasons: [],
    runId: report.runId,
    state: 'PASS',
    checks: report.checks,
  });
  const resume = await inspectTaskResume('HARN-06', root);
  assert.equal(resume.verificationState, 'CURRENT');
  assert.equal(resume.rerunCommands.length, 0);
  assert.equal(resume.canResume, false);
  assert.equal(resume.ownership.state, 'AVAILABLE');
  const handoff = await handoffTask('HARN-06', root);
  assert.equal(handoff.readiness.ready, true);
  assert.equal(handoff.taskState, 'in-progress');
  assert.equal(
    JSON.parse(await readFile(join(root, handoff.evidenceFile), 'utf8')).handoffId,
    handoff.handoffId
  );
  assert.equal(
    (await readdir(join(root, '.git/harness-runs'))).filter((name) =>
      name.startsWith('handoff-HARN-06-')
    ).length,
    1
  );
  await writeFile(
    join(root, 'scripts/check.mjs'),
    "console.log('# tests 1\\n# pass 0\\n# fail 0\\n# skipped 1');\n"
  );
  assert.match((await taskReady('HARN-06', root)).reasons.join(' '), /source fingerprint changed/);
  const staleResume = await inspectTaskResume('HARN-06', root);
  assert.equal(staleResume.verificationState, 'STALE');
  assert.match(staleResume.reasons.join(' '), /source fingerprint changed/);
  assert.deepEqual(staleResume.rerunCommands, ['test:harness']);
});

test('verify rejects zero/skipped test reports and records failure instead of ready', async (t) => {
  const root = await fixture(t);
  await writeFile(
    join(root, 'scripts/check.mjs'),
    "console.log('# tests 0\\n# pass 0\\n# fail 0\\n# skipped 0');\n"
  );
  await assert.rejects(verifyTask('HARN-06', root), /verification FAIL/);
  const ready = await taskReady('HARN-06', root);
  assert.equal(ready.ready, false);
  assert.match(ready.reasons.join(' '), /latest verification state is FAIL/);
});

test('verify refuses task-supplied commands outside the fixed non-deploying allowlist', async (t) => {
  const root = await fixture(t);
  const manifestPath = join(root, '.harness/tasks/HARN-06.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.verification = ['policies:publish'];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await assert.rejects(verifyTask('HARN-06', root), /outside the fixed verification allowlist/);
});
