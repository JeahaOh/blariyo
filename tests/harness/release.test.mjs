import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { checkMergeBack } from '../../scripts/harness/merge-back.mjs';
import { validateReleaseEvidence } from '../../scripts/harness/release.mjs';

const candidateSha = 'a'.repeat(40);
const rollbackSha = 'b'.repeat(40);
const changeId = '730ce6fd-2b87-401d-a07f-bba0feb27133';
const unregisteredChangeId = '439a3b76-48fa-4e6e-a71f-c762ae59f232';
const artifactHash = 'c'.repeat(64);
const imageDigest = `sha256:${'d'.repeat(64)}`;
const now = Date.parse('2026-09-25T00:00:00Z');

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function evidence(status, extra = {}, subjectSha = candidateSha) {
  return {
    status,
    subjectSha,
    observedAt: '2026-09-24T22:00:00Z',
    evidenceRef: `fixture://${status}`,
    artifactSha256: artifactHash,
    ...extra,
  };
}

function manifest(overrides = {}) {
  const subjectSha = overrides.candidateSha ?? candidateSha;
  return {
    schemaVersion: 1,
    releaseVersion: '1.2.3',
    releaseBranch: 'release/1.2.3',
    candidateSha,
    scopeFrozenAt: '2026-09-24T20:00:00Z',
    changeIds: [changeId],
    taskBindings: [{ taskId: 'HARN-07', changeId }],
    evidence: {
      ci: evidence('success', {}, subjectSha),
      quality: evidence('success', {}, subjectSha),
      architecture: evidence('success', {}, subjectSha),
      image: evidence('built', { digest: imageDigest }, subjectSha),
      database: evidence('compatible', { schemaRevision: 'core-v008' }, subjectSha),
      backupRestore: evidence(
        'verified',
        {
          backupCreatedAt: '2026-09-24T21:00:00Z',
          environment: 'isolated-release-fixture',
        },
        subjectSha
      ),
    },
    rollback: { targetSha: rollbackSha, imageDigest },
    ...overrides,
  };
}

test('release evidence cross-check binds every gate to the frozen candidate and returns a bounded result', () => {
  const result = validateReleaseEvidence(manifest(), {
    maxBackupAgeHours: 24,
    now,
    registeredChangeIds: [changeId],
  });
  assert.equal(result.result, 'CONSISTENT');
  assert.equal(result.verificationLevel, 'submitted-evidence-cross-check');
  assert.equal(result.backupAgeHours, 3);
  assert.equal(result.checks.length, 6);
  assert.match(result.limitations[0], /were not fetched or independently verified/);
});

test('release evidence blocks wrong SHA, missing registration, stale backup, and missing evidence', () => {
  const wrongSha = manifest();
  wrongSha.evidence.quality.subjectSha = rollbackSha;
  assert.throws(
    () =>
      validateReleaseEvidence(wrongSha, {
        maxBackupAgeHours: 24,
        now,
        registeredChangeIds: [changeId],
      }),
    /different candidate SHA/
  );
  assert.throws(
    () =>
      validateReleaseEvidence(manifest(), { maxBackupAgeHours: 24, now, registeredChangeIds: [] }),
    /absent from the candidate task manifests/
  );

  const staleBackup = manifest();
  staleBackup.evidence.backupRestore.backupCreatedAt = '2026-09-23T00:00:00Z';
  assert.throws(
    () =>
      validateReleaseEvidence(staleBackup, {
        maxBackupAgeHours: 24,
        now,
        registeredChangeIds: [changeId],
      }),
    /stale/
  );
  assert.throws(
    () =>
      validateReleaseEvidence(
        { ...manifest(), evidence: {} },
        { maxBackupAgeHours: 24, now, registeredChangeIds: [changeId] }
      ),
    /ci evidence is required/
  );
});

test('release evidence freezes the exact registered Change-Id set and rejects pre-freeze checks', () => {
  const extraChange = manifest({ changeIds: [changeId, unregisteredChangeId] });
  assert.throws(
    () =>
      validateReleaseEvidence(extraChange, {
        maxBackupAgeHours: 24,
        now,
        registeredChangeIds: [changeId, unregisteredChangeId],
      }),
    /taskBindings must map the release scope exactly/
  );

  const preFreeze = manifest();
  preFreeze.evidence.architecture.observedAt = '2026-09-24T19:59:59Z';
  assert.throws(
    () =>
      validateReleaseEvidence(preFreeze, {
        maxBackupAgeHours: 24,
        now,
        registeredChangeIds: [changeId],
      }),
    /predates the frozen release scope/
  );
});

test('release manifest command confirms Change-Ids in task manifests at the candidate commit', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-release-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  const task = { taskId: 'HARN-07', state: 'in-progress', changeIds: [changeId] };
  await writeFile(resolve(root, '.harness/tasks/HARN-07.json'), `${JSON.stringify(task)}\n`);
  for (const args of [
    ['init', '--initial-branch=main', root],
    ['-C', root, 'config', 'user.name', 'Harness Test'],
    ['-C', root, 'config', 'user.email', 'harness@example.invalid'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  await writeFile(resolve(root, 'README.md'), 'rollback fixture\n');
  for (const args of [
    ['-C', root, 'add', 'README.md'],
    ['-C', root, 'commit', '-m', 'chore: create rollback fixture'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const rollbackTarget = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).stdout.trim();
  await writeFile(resolve(root, '.harness/tasks/HARN-07.json'), `${JSON.stringify(task)}\n`);
  for (const args of [
    ['-C', root, 'add', '.harness/tasks/HARN-07.json'],
    ['-C', root, 'commit', '-m', 'chore: add release task fixture'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const sha = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).stdout.trim();
  const input = manifest({
    candidateSha: sha,
    rollback: { targetSha: rollbackTarget, imageDigest },
  });
  const manifestPath = resolve(root, 'release-fixture.json');
  await writeFile(manifestPath, `${JSON.stringify(input)}\n`);
  const cli = resolve(import.meta.dirname, '../../scripts/harness/cli.mjs');
  const command = spawnSync(
    process.execPath,
    [cli, 'release-check', manifestPath, '--max-backup-age-hours', '24'],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  assert.equal(command.status, 0, command.stderr);
  const checked = JSON.parse(command.stdout);
  assert.equal(checked.candidateSha, sha);
  assert.equal((await readFile(manifestPath, 'utf8')).includes('CONSISTENT'), false);

  input.changeIds[0] = unregisteredChangeId;
  input.taskBindings[0].changeId = unregisteredChangeId;
  await writeFile(manifestPath, `${JSON.stringify(input)}\n`);
  const rejected = spawnSync(
    process.execPath,
    [cli, 'release-check', manifestPath, '--max-backup-age-hours', '24'],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /not registered/);
});

test('release freeze excludes a later develop feature and rejects adding it to the frozen manifest', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-release-freeze-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  for (const args of [
    ['init', '--initial-branch=main', root],
    ['-C', root, 'config', 'user.name', 'Harness Test'],
    ['-C', root, 'config', 'user.email', 'harness@example.invalid'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  await writeFile(resolve(root, 'README.md'), 'production rollback target\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'chore: release freeze base');
  const rollbackTarget = git(root, 'rev-parse', 'HEAD');
  const frozenTask = { taskId: 'HARN-07', state: 'in-progress', changeIds: [changeId] };
  await writeFile(resolve(root, '.harness/tasks/HARN-07.json'), `${JSON.stringify(frozenTask)}\n`);
  git(root, 'add', '.harness/tasks/HARN-07.json');
  git(root, 'commit', '-m', 'feat: frozen release scope');
  const candidateSha = git(root, 'rev-parse', 'HEAD');
  git(root, 'branch', 'develop');
  git(root, 'branch', 'release/1.2.3');
  git(root, 'checkout', 'develop');
  const laterTask = { taskId: 'OPS-12', state: 'in-progress', changeIds: [unregisteredChangeId] };
  await writeFile(resolve(root, '.harness/tasks/OPS-12.json'), `${JSON.stringify(laterTask)}\n`);
  git(root, 'add', '.harness/tasks/OPS-12.json');
  git(root, 'commit', '-m', 'feat: next release feature');
  const laterFeatureSha = git(root, 'rev-parse', 'HEAD');
  assert.equal(
    spawnSync('git', ['merge-base', '--is-ancestor', laterFeatureSha, 'release/1.2.3'], {
      cwd: root,
      encoding: 'utf8',
    }).status,
    1,
    'the post-freeze feature must remain outside the release branch'
  );

  const input = manifest({
    candidateSha,
    changeIds: [changeId],
    taskBindings: [{ taskId: 'HARN-07', changeId }],
    rollback: { targetSha: rollbackTarget, imageDigest },
  });
  const manifestPath = resolve(root, 'release-freeze.json');
  await writeFile(manifestPath, `${JSON.stringify(input)}\n`);
  const cli = resolve(import.meta.dirname, '../../scripts/harness/cli.mjs');
  const accepted = spawnSync(
    process.execPath,
    [cli, 'release-check', manifestPath, '--max-backup-age-hours', '24'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).candidateSha, candidateSha);

  input.changeIds.push(unregisteredChangeId);
  input.taskBindings.push({ taskId: 'OPS-12', changeId: unregisteredChangeId });
  await writeFile(manifestPath, `${JSON.stringify(input)}\n`);
  const rejected = spawnSync(
    process.execPath,
    [cli, 'release-check', manifestPath, '--max-backup-age-hours', '24'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /task manifest OPS-12 is missing at candidate SHA/);

  await writeFile(
    resolve(root, '.harness/policy.json'),
    `${JSON.stringify({ activeRelease: 'release/1.2.3' })}\n`
  );
  git(root, 'update-ref', 'refs/remotes/origin/main', candidateSha);
  git(root, 'update-ref', 'refs/remotes/origin/develop', candidateSha);
  git(root, 'checkout', 'release/1.2.3');
  await writeFile(resolve(root, 'release-stabilization.txt'), 'approved release correction\n');
  git(root, 'add', 'release-stabilization.txt');
  git(
    root,
    'commit',
    '-m',
    `fix: approved release stabilization\n\nTask-Id: HARN-07\nChange-Id: ${changeId}`
  );
  const beforeMerges = await checkMergeBack('release/1.2.3', root);
  assert.equal(beforeMerges.result, 'INCOMPLETE');
  assert.deepEqual(
    beforeMerges.targets.map((item) => item.state),
    ['NOT_MERGED', 'NOT_MERGED']
  );

  git(root, 'checkout', 'main');
  git(root, 'merge', '--no-ff', 'release/1.2.3', '-m', 'merge release into main');
  git(root, 'update-ref', 'refs/remotes/origin/main', git(root, 'rev-parse', 'main'));
  const afterMainMerge = await checkMergeBack('release/1.2.3', root);
  assert.equal(afterMainMerge.result, 'INCOMPLETE');
  assert.deepEqual(
    afterMainMerge.targets.map((item) => [item.target, item.state]),
    [
      ['main', 'MERGED'],
      ['develop', 'NOT_MERGED'],
    ]
  );

  git(root, 'checkout', 'develop');
  git(root, 'merge', '--no-ff', 'release/1.2.3', '-m', 'merge release into develop');
  git(root, 'update-ref', 'refs/remotes/origin/develop', git(root, 'rev-parse', 'develop'));
  const completed = await checkMergeBack('release/1.2.3', root);
  assert.equal(completed.result, 'COMPLETE');
  assert.deepEqual(
    completed.targets.map((item) => item.state),
    ['MERGED', 'MERGED']
  );
  assert.equal(git(root, 'show', 'main:release-stabilization.txt'), 'approved release correction');
  assert.equal(
    git(root, 'show', 'develop:release-stabilization.txt'),
    'approved release correction'
  );
  assert.equal(
    await readFile(resolve(root, '.harness/tasks/OPS-12.json'), 'utf8'),
    `${JSON.stringify(laterTask)}\n`
  );
  assert.equal(
    spawnSync('git', ['merge-base', '--is-ancestor', laterFeatureSha, 'release/1.2.3'], {
      cwd: root,
      encoding: 'utf8',
    }).status,
    1,
    'the post-freeze feature must remain outside the released scope'
  );
  assert.equal(
    spawnSync('git', ['merge-base', '--is-ancestor', laterFeatureSha, 'main'], {
      cwd: root,
      encoding: 'utf8',
    }).status,
    1,
    'the post-freeze feature must not leak into the release merge on main'
  );
});
