import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { startHotfix } from '../../scripts/harness/branches.mjs';
import { checkMergeBack, mergeBackTargets } from '../../scripts/harness/merge-back.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function repository(t, activeRelease = null) {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-merge-back-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.name', 'Harness Merge Back Test');
  git(root, 'config', 'user.email', 'merge-back@example.invalid');
  await mkdir(resolve(root, '.harness'), { recursive: true });
  const sourceRoot = resolve(import.meta.dirname, '../..');
  const policy = JSON.parse(await readFile(resolve(sourceRoot, '.harness/policy.json'), 'utf8'));
  policy.activeRelease = activeRelease;
  await writeFile(resolve(root, '.harness/policy.json'), `${JSON.stringify(policy)}\n`);
  await writeFile(resolve(root, 'README.md'), 'base\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore: initialize merge-back fixture');
  git(root, 'branch', 'develop');
  if (activeRelease) git(root, 'branch', activeRelease);
  for (const target of ['main', 'develop', ...(activeRelease ? [activeRelease] : [])])
    git(root, 'update-ref', `refs/remotes/origin/${target}`, 'HEAD');
  return root;
}

function addSourceCommit(root, branch, message = 'release candidate') {
  git(root, 'checkout', '-b', branch);
  const marker = resolve(root, `${branch.split('/')[0]}-${Date.now()}.txt`);
  return (async () => {
    await writeFile(marker, `${message}\n`);
    git(root, 'add', marker);
    git(root, 'commit', '-m', `chore: ${message}`);
  })();
}

function mergeNoFf(root, source, target, refreshRemoteTracking = true) {
  git(root, 'checkout', target);
  git(root, 'merge', '--no-ff', source, '-m', `merge ${source} into ${target}`);
  if (refreshRemoteTracking)
    git(root, 'update-ref', `refs/remotes/origin/${target}`, `refs/heads/${target}`);
}

test('release merge-back check reports each target and completes only after both merge commits', async (t) => {
  const root = await repository(t);
  await addSourceCommit(root, 'release/1.2.3');
  const initial = await checkMergeBack('release/1.2.3', root);
  assert.equal(initial.result, 'INCOMPLETE');
  assert.deepEqual(
    initial.targets.map((item) => item.state),
    ['NOT_MERGED', 'NOT_MERGED']
  );
  assert.equal(initial.verificationLevel, 'local-ref-ancestry-only');

  mergeNoFf(root, 'release/1.2.3', 'main', false);
  const staleRemoteTracking = await checkMergeBack('release/1.2.3', root);
  assert.deepEqual(
    staleRemoteTracking.targets.map((item) => item.state),
    ['NOT_MERGED', 'NOT_MERGED']
  );
  git(root, 'update-ref', 'refs/remotes/origin/main', 'refs/heads/main');
  const afterMain = await checkMergeBack('release/1.2.3', root);
  assert.deepEqual(
    afterMain.targets.map((item) => item.state),
    ['MERGED', 'NOT_MERGED']
  );
  mergeNoFf(root, 'release/1.2.3', 'develop');
  assert.equal((await checkMergeBack('release/1.2.3', root)).result, 'COMPLETE');
});

test('hotfix merge-back includes the active release and unknown source roles fail closed', async (t) => {
  const root = await repository(t, 'release/2.0.0');
  await addSourceCommit(root, 'hotfix/OPS-12-critical-fix');
  const initial = await checkMergeBack('hotfix/OPS-12-critical-fix', root);
  assert.deepEqual(
    initial.targets.map((item) => item.target),
    ['main', 'develop', 'release/2.0.0']
  );
  assert.deepEqual(
    initial.targets.map((item) => item.state),
    ['NOT_MERGED', 'NOT_MERGED', 'NOT_MERGED']
  );
  assert.throws(
    () => mergeBackTargets('feature/OPS-12-critical-fix', {}),
    /only release or hotfix/
  );

  for (const target of ['main', 'develop', 'release/2.0.0'])
    mergeNoFf(root, 'hotfix/OPS-12-critical-fix', target);
  assert.equal((await checkMergeBack('hotfix/OPS-12-critical-fix', root)).result, 'COMPLETE');
});

test('hotfix from a deployed SHA merges to main then requires develop and active-release back-merges', async (t) => {
  const root = await repository(t, 'release/2.0.0');
  const productionSha = git(root, 'rev-parse', 'main');
  git(root, 'checkout', 'main');
  await writeFile(
    resolve(root, 'main-after-deploy.txt'),
    'main advanced after production deploy\n'
  );
  git(root, 'add', 'main-after-deploy.txt');
  git(root, 'commit', '-m', 'chore: advance main after production deploy');
  const mainTip = git(root, 'rev-parse', 'main');
  git(root, 'update-ref', 'refs/remotes/origin/main', mainTip);

  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  await writeFile(
    resolve(root, '.harness/tasks/OPS-12.json'),
    JSON.stringify({ taskId: 'OPS-12', state: 'active' })
  );
  const worktree = resolve(root, '..', `${root.split('/').at(-1)}-hotfix-lifecycle`);
  t.after(() => spawnSync('git', ['-C', root, 'worktree', 'remove', '--force', worktree]));
  const started = await startHotfix('OPS-12', 'critical-fix', productionSha, worktree, root);
  assert.equal(started.baseSha, productionSha);
  assert.equal(started.baseRef, 'production-sha');
  assert.equal(git(worktree, 'rev-parse', 'HEAD'), productionSha);

  await writeFile(resolve(worktree, 'hotfix-fix.txt'), 'critical fix\n');
  git(worktree, 'add', 'hotfix-fix.txt');
  git(worktree, 'commit', '-m', 'fix: repair production issue');
  const branch = started.branch;
  assert.deepEqual(
    (await checkMergeBack(branch, root)).targets.map((item) => item.state),
    ['NOT_MERGED', 'NOT_MERGED', 'NOT_MERGED']
  );

  mergeNoFf(root, branch, 'main');
  const afterMain = await checkMergeBack(branch, root);
  assert.equal(afterMain.result, 'INCOMPLETE');
  assert.deepEqual(
    afterMain.targets.map((item) => [item.target, item.state]),
    [
      ['main', 'MERGED'],
      ['develop', 'NOT_MERGED'],
      ['release/2.0.0', 'NOT_MERGED'],
    ]
  );

  mergeNoFf(root, branch, 'develop');
  mergeNoFf(root, branch, 'release/2.0.0');
  const complete = await checkMergeBack(branch, root);
  assert.equal(complete.result, 'COMPLETE');
  assert.deepEqual(
    complete.targets.map((item) => item.state),
    ['MERGED', 'MERGED', 'MERGED']
  );
  for (const target of ['main', 'develop', 'release/2.0.0']) {
    git(root, 'checkout', target);
    assert.equal(await readFile(resolve(root, 'hotfix-fix.txt'), 'utf8'), 'critical fix\n');
  }
  assert.notEqual(productionSha, mainTip);
});
