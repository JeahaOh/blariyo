import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  classifyBranch,
  startHotfix,
  startTask,
  validatePullRequest,
} from '../../scripts/harness/branches.mjs';
import { spawnSync } from 'node:child_process';
import { parseTapSummary, validateTapSummary } from '../../scripts/harness/tap.mjs';

test('test runner accepts only a complete non-empty TAP report with no skipped tests', () => {
  assert.deepEqual(parseTapSummary('# tests 2\n# pass 2\n# fail 0\n# skipped 0\n'), {
    tests: 2,
    passed: 2,
    failed: 0,
    skipped: 0,
  });
  assert.deepEqual(parseTapSummary('# tests 0\n# pass 0\n# fail 0\n# skipped 0\n'), {
    tests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  });
  assert.throws(
    () => validateTapSummary('# tests 0\n# pass 0\n# fail 0\n# skipped 0\n'),
    /not acceptable/
  );
  assert.throws(
    () => validateTapSummary('# tests 1\n# pass 0\n# fail 0\n# skipped 1\n'),
    /not acceptable/
  );
});

test('branch role parsing requires a task-id and lowercase slug for feature/hotfix names', () => {
  assert.deepEqual(classifyBranch('refs/heads/feature/HARN-06-quality-gates'), {
    name: 'feature/HARN-06-quality-gates',
    role: 'feature',
    taskId: 'HARN-06',
    slug: 'quality-gates',
  });
  assert.equal(classifyBranch('feature/no-task-id').role, 'unknown');
  assert.equal(classifyBranch('hotfix/OPS-12-urgent').role, 'hotfix');
  assert.equal(classifyBranch('release/1.2.3').role, 'release');
});

test('PR source and target roles follow Gitflow and require an active task manifest', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-branch-policy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await mkdir(resolve(root, '.harness'), { recursive: true });
  const policy = JSON.parse(await readFile(resolve(sourceRoot, '.harness/policy.json'), 'utf8'));
  policy.activeRelease = 'release/1.2.3';
  await writeFile(resolve(root, '.harness/policy.json'), JSON.stringify(policy));
  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  for (const taskId of ['HARN-06', 'OPS-12'])
    await writeFile(
      resolve(root, `.harness/tasks/${taskId}.json`),
      JSON.stringify({ taskId, state: 'in-progress' })
    );
  const opts = { root };
  assert.equal(
    (await validatePullRequest('feature/HARN-06-quality-gates', 'develop', opts)).allowed,
    true
  );
  assert.equal((await validatePullRequest('release/1.2.3', 'main', opts)).allowed, true);
  assert.equal((await validatePullRequest('release/1.2.3', 'develop', opts)).allowed, true);
  assert.equal((await validatePullRequest('hotfix/OPS-12-urgent', 'main', opts)).allowed, true);
  assert.equal((await validatePullRequest('hotfix/OPS-12-urgent', 'develop', opts)).allowed, true);
  assert.equal(
    (await validatePullRequest('hotfix/OPS-12-urgent', 'release/1.2.3', opts)).allowed,
    true
  );
  await assert.rejects(
    validatePullRequest('feature/HARN-06-quality-gates', 'release/1.2.3', opts),
    /feature -> release is not an allowed/
  );
  await assert.rejects(
    validatePullRequest('feature/HARN-06-quality-gates', 'main', opts),
    /feature -> main is not an allowed/
  );
  await assert.rejects(
    validatePullRequest('main', 'develop', opts),
    /main is not a valid pull request source/
  );
  await assert.rejects(
    validatePullRequest('hotfix/OPS-12-urgent', 'release/9.9.9', opts),
    /not registered active/
  );
  await assert.rejects(validatePullRequest('office', 'main', opts), /unrecognized branch role/);
  await assert.rejects(
    validatePullRequest('feature/UX-77-missing-task', 'develop', opts),
    /task manifest .* missing/
  );
});

test('task start blocks without develop and leaves no branch or path behind', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-start-blocked-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  const policy = JSON.parse(await readFile(resolve(sourceRoot, '.harness/policy.json'), 'utf8'));
  await writeFile(resolve(root, '.harness/policy.json'), JSON.stringify(policy));
  await writeFile(
    resolve(root, '.harness/tasks/HARN-06.json'),
    await readFile(resolve(sourceRoot, '.harness/tasks/HARN-06.json'), 'utf8')
  );
  const init = spawnSync('git', ['init', root], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  for (const [key, value] of [
    ['user.name', 'Harness Test'],
    ['user.email', 'harness@example.invalid'],
  ]) {
    const result = spawnSync('git', ['config', key, value], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  await writeFile(resolve(root, 'README.md'), 'shared fixture baseline\n');
  for (const args of [
    ['add', 'README.md'],
    ['commit', '-m', 'chore: create blocked-start fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const otherWorktree = resolve(root, '..', `${root.split('/').at(-1)}-existing`);
  t.after(() => spawnSync('git', ['-C', root, 'worktree', 'remove', '--force', otherWorktree]));
  const addWorktree = spawnSync(
    'git',
    ['worktree', 'add', '-b', 'feature/OPS-99-existing', otherWorktree, 'HEAD'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(addWorktree.status, 0, addWorktree.stderr);
  await writeFile(resolve(otherWorktree, 'README.md'), 'dirty in another worktree\n');
  await writeFile(resolve(otherWorktree, 'keep-untracked.txt'), 'preserve this local file\n');
  const otherStatus = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: otherWorktree,
    encoding: 'utf8',
  }).stdout;
  const refsBefore = spawnSync(
    'git',
    ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes/origin'],
    { cwd: root, encoding: 'utf8' }
  ).stdout;
  const worktreesBefore = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout;
  await writeFile(resolve(root, 'keep-untracked.txt'), 'preserve this local file\n');
  const originalStatus = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout;
  const path = resolve(tmpdir(), `blariyo-start-should-not-exist-${process.pid}-${Date.now()}`);
  await assert.rejects(
    startTask('HARN-06', 'quality-gates', path, root),
    /BLOCKED: develop branch is absent/
  );
  assert.equal(
    spawnSync(
      'git',
      ['show-ref', '--verify', '--quiet', 'refs/heads/feature/HARN-06-quality-gates'],
      { cwd: root }
    ).status,
    1
  );
  await assert.rejects(access(path), { code: 'ENOENT' });
  assert.equal(
    spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout,
    originalStatus,
    'blocked bootstrap must preserve dirty and untracked worktree state'
  );
  assert.equal(
    spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: otherWorktree,
      encoding: 'utf8',
    }).stdout,
    otherStatus,
    'blocked bootstrap must preserve other worktrees dirty and untracked state'
  );
  assert.equal(
    spawnSync(
      'git',
      ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes/origin'],
      { cwd: root, encoding: 'utf8' }
    ).stdout,
    refsBefore,
    'blocked bootstrap must not rewrite existing refs'
  );
  assert.equal(
    spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout,
    worktreesBefore,
    'blocked bootstrap must not add or remove worktrees'
  );
});

test('task start creates an isolated feature worktree from the approved develop tip', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-start-approved-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  const policy = JSON.parse(await readFile(resolve(sourceRoot, '.harness/policy.json'), 'utf8'));
  await writeFile(
    resolve(root, '.harness/tasks/HARN-06.json'),
    await readFile(resolve(sourceRoot, '.harness/tasks/HARN-06.json'), 'utf8')
  );
  const init = spawnSync('git', ['init', '--initial-branch=develop', root], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  const configName = spawnSync('git', ['config', 'user.name', 'Harness Test'], {
    cwd: root,
    encoding: 'utf8',
  });
  const configEmail = spawnSync('git', ['config', 'user.email', 'harness@example.invalid'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(configName.status, 0, configName.stderr);
  assert.equal(configEmail.status, 0, configEmail.stderr);
  const marker = resolve(root, 'README.md');
  await writeFile(marker, 'develop baseline\n');
  for (const args of [
    ['add', 'README.md'],
    ['commit', '-m', 'chore: initialize harness fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  policy.developBootstrapSha = spawnSync('git', ['rev-parse', 'develop'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim();
  await writeFile(resolve(root, '.harness/policy.json'), JSON.stringify(policy));
  const remote = resolve(root, '..', `${root.split('/').at(-1)}-origin.git`);
  t.after(() => rm(remote, { recursive: true, force: true }));
  assert.equal(spawnSync('git', ['init', '--bare', remote], { encoding: 'utf8' }).status, 0);
  for (const args of [
    ['remote', 'add', 'origin', remote],
    ['push', '--set-upstream', 'origin', 'develop'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const developSha = spawnSync('git', ['rev-parse', 'develop'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim();
  const worktree = resolve(root, '..', `${root.split('/').at(-1)}-task`);
  t.after(() =>
    spawnSync('git', ['worktree', 'remove', '--force', worktree], { cwd: root, encoding: 'utf8' })
  );
  const result = await startTask('HARN-06', 'quality-gates', worktree, root);
  assert.equal(result.baseRef, 'develop');
  assert.equal(result.baseSha, developSha);
  assert.equal(
    spawnSync('git', ['rev-parse', 'feature/HARN-06-quality-gates'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim(),
    developSha
  );
  assert.equal(
    spawnSync('git', ['-C', worktree, 'status', '--porcelain'], { encoding: 'utf8' }).stdout,
    ''
  );
  policy.developBootstrapSha = 'f'.repeat(40);
  await writeFile(resolve(root, '.harness/policy.json'), JSON.stringify(policy));
  const rejectedWorktree = resolve(root, '..', `${root.split('/').at(-1)}-unapproved-task`);
  await assert.rejects(
    startTask('HARN-06', 'unapproved-bootstrap', rejectedWorktree, root),
    /BLOCKED: develop .* does not descend from approved bootstrap/
  );
  await assert.rejects(access(rejectedWorktree), { code: 'ENOENT' });
  assert.equal(
    spawnSync(
      'git',
      ['show-ref', '--verify', '--quiet', 'refs/heads/feature/HARN-06-unapproved-bootstrap'],
      { cwd: root, encoding: 'utf8' }
    ).status,
    1
  );
});

test('task start blocks when local develop differs from the origin integration baseline', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-start-stale-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  const policy = JSON.parse(await readFile(resolve(sourceRoot, '.harness/policy.json'), 'utf8'));
  await writeFile(
    resolve(root, '.harness/tasks/HARN-06.json'),
    await readFile(resolve(sourceRoot, '.harness/tasks/HARN-06.json'), 'utf8')
  );
  const init = spawnSync('git', ['init', '--initial-branch=develop', root], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  for (const [key, value] of [
    ['user.name', 'Harness Test'],
    ['user.email', 'harness@example.invalid'],
  ]) {
    const result = spawnSync('git', ['config', key, value], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  await writeFile(resolve(root, 'README.md'), 'approved baseline\n');
  for (const args of [
    ['add', 'README.md'],
    ['commit', '-m', 'chore: initialize harness fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  policy.developBootstrapSha = spawnSync('git', ['rev-parse', 'develop'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim();
  await writeFile(resolve(root, '.harness/policy.json'), JSON.stringify(policy));
  const remote = resolve(root, '..', `${root.split('/').at(-1)}-origin.git`);
  t.after(() => rm(remote, { recursive: true, force: true }));
  assert.equal(spawnSync('git', ['init', '--bare', remote], { encoding: 'utf8' }).status, 0);
  for (const args of [
    ['remote', 'add', 'origin', remote],
    ['push', '--set-upstream', 'origin', 'develop'],
    ['commit', '--allow-empty', '-m', 'chore: local develop moved'],
  ]) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const worktree = resolve(root, '..', `${root.split('/').at(-1)}-task`);
  await assert.rejects(
    startTask('HARN-06', 'quality-gates', worktree, root),
    /BLOCKED: local develop .* differs from origin\/develop/
  );
  await assert.rejects(access(worktree), { code: 'ENOENT' });
  assert.equal(
    spawnSync(
      'git',
      ['show-ref', '--verify', '--quiet', 'refs/heads/feature/HARN-06-quality-gates'],
      { cwd: root, encoding: 'utf8' }
    ).status,
    1
  );
});

test('hotfix starts from the supplied production commit behind main and rejects untrusted bases', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-hotfix-start-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, '.harness/tasks'), { recursive: true });
  const sourceRoot = resolve(import.meta.dirname, '../..');
  const policy = JSON.parse(await readFile(resolve(sourceRoot, '.harness/policy.json'), 'utf8'));
  await writeFile(resolve(root, '.harness/policy.json'), `${JSON.stringify(policy)}\n`);
  await writeFile(
    resolve(root, '.harness/tasks/OPS-12.json'),
    JSON.stringify({ taskId: 'OPS-12', state: 'in-progress' })
  );
  for (const args of [
    ['init', '--initial-branch=main', root],
    ['-C', root, 'config', 'user.name', 'Harness Test'],
    ['-C', root, 'config', 'user.email', 'harness@example.invalid'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  await writeFile(resolve(root, 'README.md'), 'production\n');
  for (const args of [
    ['-C', root, 'add', 'README.md'],
    ['-C', root, 'commit', '-m', 'chore: production baseline'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const productionSha = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).stdout.trim();
  await writeFile(resolve(root, 'README.md'), 'main advanced after deploy\n');
  for (const args of [
    ['-C', root, 'add', 'README.md'],
    ['-C', root, 'commit', '-m', 'chore: main advanced'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const mainSha = spawnSync('git', ['-C', root, 'rev-parse', 'main'], {
    encoding: 'utf8',
  }).stdout.trim();
  const worktree = resolve(root, '..', `${root.split('/').at(-1)}-hotfix`);
  t.after(() => spawnSync('git', ['-C', root, 'worktree', 'remove', '--force', worktree]));
  const created = await startHotfix('OPS-12', 'urgent-fix', productionSha, worktree, root);
  assert.equal(created.baseSha, productionSha);
  assert.equal(created.baseRef, 'production-sha');
  assert.equal(
    spawnSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
    productionSha
  );
  assert.notEqual(productionSha, mainSha);
  assert.equal(
    spawnSync('git', ['-C', root, 'rev-parse', 'main'], { encoding: 'utf8' }).stdout.trim(),
    mainSha,
    'starting a hotfix must not move main'
  );

  const rejectedPath = resolve(root, '..', `${root.split('/').at(-1)}-bad-hotfix`);
  await assert.rejects(
    startHotfix('OPS-12', 'relative-path', productionSha, 'relative-worktree', root),
    /worktree path must be absolute/
  );
  await assert.rejects(
    startHotfix('OPS-12', 'untrusted-fix', 'f'.repeat(productionSha.length), rejectedPath, root),
    /production commit is unavailable|not an ancestor/
  );
  await assert.rejects(access(rejectedPath), { code: 'ENOENT' });
  assert.equal(
    spawnSync(
      'git',
      ['-C', root, 'show-ref', '--verify', '--quiet', 'refs/heads/hotfix/OPS-12-untrusted-fix'],
      { encoding: 'utf8' }
    ).status,
    1
  );
});
