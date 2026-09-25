import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  checkCommitRange,
  checkOutgoingRefs,
  checkStaged,
  checkTaskRange,
  repositoryRoot,
} from '../../scripts/harness/check.mjs';
import {
  dispatchHook,
  installHooks,
  installedHookDirectory,
  removeHooks,
} from '../../scripts/harness/hooks.mjs';

const syntheticGithubToken = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789';

function runGit(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-harness-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  runGit(root, 'init', '--initial-branch=feature/HARN-06-harness-test');
  runGit(root, 'config', 'user.name', 'Harness Test');
  runGit(root, 'config', 'user.email', 'harness@example.invalid');
  await mkdir(join(root, '.harness'), { recursive: true });
  await cp(
    resolve(import.meta.dirname, '../../.harness/policy.json'),
    join(root, '.harness/policy.json')
  );
  await mkdir(join(root, '.harness/tasks'), { recursive: true });
  const task = JSON.parse(
    await readFile(resolve(import.meta.dirname, '../../.harness/tasks/HARN-06.json'), 'utf8')
  );
  task.changeIds = [
    ...new Set([
      ...task.changeIds,
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ]),
  ];
  await writeFile(join(root, '.harness/tasks/HARN-06.json'), `${JSON.stringify(task, null, 2)}\n`);
  return root;
}

async function commitFile(root, path, content, message, bypassHooks = false) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), content);
  runGit(root, 'add', '--', path);
  if (bypassHooks) runGit(root, '-c', 'core.hooksPath=/dev/null', 'commit', '-m', message);
  else runGit(root, 'commit', '-m', message);
  return runGit(root, 'rev-parse', 'HEAD');
}

test('staged check scans the index and does not disclose a matching token', async (t) => {
  const root = await repository(t);
  await mkdir(join(root, 'scripts/harness'), { recursive: true });
  await writeFile(join(root, 'scripts/harness/test-secret.mjs'), `token=${syntheticGithubToken}\n`);
  runGit(root, 'add', 'scripts/harness/test-secret.mjs');
  await assert.rejects(
    checkStaged(root),
    /secret candidate \(github-token\).*contents were suppressed/
  );
});

test('staged check enforces task path allowlist, including staged deletions', async (t) => {
  const root = await repository(t);
  const tracked = await commitFile(root, 'README.md', 'tracked\n', 'chore: fixture baseline');
  assert.ok(tracked);
  await writeFile(join(root, 'outside-scope.txt'), 'safe\n');
  runGit(root, 'add', 'outside-scope.txt');
  await assert.rejects(checkStaged(root), /path outside task HARN-06 allowlist: outside-scope.txt/);
  runGit(root, 'reset', '--quiet');
  runGit(root, 'rm', 'README.md');
  await assert.rejects(checkStaged(root), /path outside task HARN-06 allowlist: README.md/);
});

test('staged symlink inspection reads the indexed link text without following its target', async (t) => {
  const root = await repository(t);
  const manifestPath = join(root, '.harness/tasks/HARN-06.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.allowedPaths.push('tests/harness/**');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const target = join(root, 'outside-secret.txt');
  await writeFile(target, `${syntheticGithubToken}\n`);
  await mkdir(join(root, 'tests/harness'), { recursive: true });
  const linkBlob = spawnSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: root,
    input: 'outside-secret.txt',
    encoding: 'utf8',
  });
  assert.equal(linkBlob.status, 0, linkBlob.stderr);
  runGit(
    root,
    'update-index',
    '--add',
    '--cacheinfo',
    `120000,${linkBlob.stdout.trim()},tests/harness/outside-link`
  );
  const result = await checkStaged(root);
  assert.equal(result.scanned, 1);
});

test('PR task-range check applies the same manifest allowlist to every changed path', async (t) => {
  const root = await repository(t);
  runGit(root, 'add', '.harness');
  runGit(root, 'commit', '-m', 'chore: register task fixture');
  const base = await commitFile(
    root,
    'scripts/harness/allowed.mjs',
    'export {};\n',
    'chore: baseline'
  );
  const allowedHead = await commitFile(
    root,
    'scripts/harness/allowed.mjs',
    'export const ok = true;\n',
    'test: allowed path'
  );
  assert.deepEqual(checkTaskRange('feature/HARN-06-harness-test', base, allowedHead, root), {
    checked: true,
    paths: 1,
    taskId: 'HARN-06',
  });
  const outsideHead = await commitFile(root, 'outside-scope.txt', 'safe\n', 'test: outside path');
  assert.throws(
    () => checkTaskRange('feature/HARN-06-harness-test', allowedHead, outsideHead, root),
    /path outside task HARN-06 allowlist/
  );
  const manifestPath = join(root, '.harness/tasks/HARN-06.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.allowedPaths = ['**'];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  runGit(root, 'add', '.harness/tasks/HARN-06.json');
  runGit(root, 'commit', '-m', 'test: try broadening task scope');
  const manifestHead = runGit(root, 'rev-parse', 'HEAD');
  assert.throws(
    () => checkTaskRange('feature/HARN-06-harness-test', outsideHead, manifestHead, root),
    /separate governance review/
  );
});

test('outgoing range checks every commit, including a secret later deleted from the final tree', async (t) => {
  const root = await repository(t);
  const base = await commitFile(root, 'README.md', 'safe\n', 'docs: base');
  await commitFile(root, 'leak.txt', `${syntheticGithubToken}\n`, 'test: add synthetic leak');
  const head = await commitFile(root, 'leak.txt', 'removed\n', 'test: remove synthetic leak');
  const input = `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${base}\n`;
  assert.throws(
    () => checkOutgoingRefs(input, root),
    /secret candidate \(github-token\).*contents were suppressed/
  );
  const zero = '0'.repeat(head.length);
  const multi = `refs/heads/old ${zero} refs/heads/old ${base}\n${input}`;
  assert.throws(
    () => checkOutgoingRefs(multi, root),
    /deleting remote ref refs\/heads\/old is blocked.*secret candidate \(github-token\)/
  );
});

test('outgoing history parses Unicode and spaced paths and permits ordinary deletions', async (t) => {
  const root = await repository(t);
  const manifestPath = join(root, '.harness/tasks/HARN-06.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.allowedPaths.push('tests/harness/**');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const base = await commitFile(
    root,
    'tests/harness/기준 파일.txt',
    'safe\n',
    'test: add baseline'
  );
  runGit(root, 'mv', '--', 'tests/harness/기준 파일.txt', 'tests/harness/이름 변경 파일.txt');
  const renamed = spawnSync('git', ['commit', '-m', 'test: rename Unicode path'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(renamed.status, 0, renamed.stderr);
  runGit(root, 'rm', '--', 'tests/harness/이름 변경 파일.txt');
  const removed = spawnSync('git', ['commit', '-m', 'test: remove baseline'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(removed.status, 0, removed.stderr);
  const head = await commitFile(
    root,
    'tests/harness/새 파일 이름.txt',
    'safe\n',
    'test: add Unicode path'
  );
  assert.deepEqual(
    checkOutgoingRefs(
      `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${base}\n`,
      root
    ),
    { scannedCommits: 3, scannedRefs: 1 }
  );
});

test('outgoing history detects a secret introduced only by manual merge conflict resolution', async (t) => {
  const root = await repository(t);
  const base = await commitFile(root, 'README.md', 'base safe\n', 'docs: base');
  runGit(root, 'checkout', '-b', 'side/harness-resolution');
  await commitFile(root, 'README.md', 'side safe\n', 'docs: side change');
  runGit(root, 'checkout', 'feature/HARN-06-harness-test');
  await commitFile(root, 'README.md', 'feature safe\n', 'docs: feature change');
  const merge = spawnSync('git', ['merge', '--no-commit', 'side/harness-resolution'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(merge.status, 0);
  await writeFile(join(root, 'README.md'), `${syntheticGithubToken}\n`);
  runGit(root, 'add', 'README.md');
  const resolution = spawnSync('git', ['commit', '--no-verify', '-m', 'test: resolve conflict'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(resolution.status, 0, resolution.stderr);
  const head = runGit(root, 'rev-parse', 'HEAD');
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${base}\n`,
        root
      ),
    /secret candidate \(github-token\).*contents were suppressed/
  );
});

test('CI commit-range mode inspects the submitted source range rather than only HEAD', async (t) => {
  const root = await repository(t);
  const base = await commitFile(root, 'README.md', 'safe\n', 'docs: base');
  await commitFile(root, 'leak.txt', `${syntheticGithubToken}\n`, 'test: add synthetic leak');
  const head = await commitFile(root, 'leak.txt', 'removed\n', 'test: remove synthetic leak');
  assert.throws(
    () => checkCommitRange(base, head, root),
    /secret candidate \(github-token\).*contents were suppressed/
  );
});

test('clean outgoing history passes, while protected direct pushes and force updates fail', async (t) => {
  const root = await repository(t);
  const base = await commitFile(root, 'README.md', 'safe\n', 'docs: base');
  const head = await commitFile(root, 'src.js', 'export const ok = true;\n', 'test: safe change');
  assert.deepEqual(
    checkOutgoingRefs(
      `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${base}\n`,
      root
    ),
    { scannedCommits: 1, scannedRefs: 1 }
  );
  assert.throws(
    () => checkOutgoingRefs(`refs/heads/main ${head} refs/heads/main ${base}\n`, root),
    /direct push to refs\/heads\/main is blocked/
  );
  assert.deepEqual(
    checkOutgoingRefs(`refs/heads/develop ${base} refs/heads/develop ${base}\n`, root),
    { scannedCommits: 0, scannedRefs: 1 }
  );
  assert.throws(
    () => checkOutgoingRefs(`refs/heads/develop ${head} refs/heads/develop ${base}\n`, root),
    /direct push to refs\/heads\/develop is blocked/
  );
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/heads/release/1.2.0 ${head} refs/heads/release/1.2.0 ${base}\n`,
        root
      ),
    /direct push to refs\/heads\/release\/1\.2\.0 is blocked/
  );
  const multiRef = [
    `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${base}`,
    `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/main ${base}`,
  ].join('\n');
  assert.throws(
    () => checkOutgoingRefs(multiRef, root),
    /direct push to refs\/heads\/main is blocked/
  );
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/heads/feature/HARN-06-harness-test ${base} refs/heads/feature/HARN-06-harness-test ${head}\n`,
        root
      ),
    /non-fast-forward push.*blocked/
  );
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/heads/feature/legacy ${head} refs/heads/feature/legacy ${base}\n`,
        root
      ),
    /push to unrecognized branch refs\/heads\/feature\/legacy is blocked/
  );
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/tags/v1.0.0 ${head} refs/tags/v1.0.0 ${'0'.repeat(head.length)}\n`,
        root
      ),
    /push to unsupported ref refs\/tags\/v1.0.0 is blocked/
  );
  const annotated = spawnSync('git', ['tag', '-a', 'v2.0.0', '-m', syntheticGithubToken, head], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(annotated.status, 0, annotated.stderr);
  const tagObject = runGit(root, 'rev-parse', 'refs/tags/v2.0.0');
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/tags/v2.0.0 ${tagObject} refs/tags/v2.0.0 ${'0'.repeat(head.length)}\n`,
        root
      ),
    (error) => {
      assert.match(error.message, /push to unsupported ref refs\/tags\/v2\.0\.0 is blocked/);
      assert.doesNotMatch(error.message, /abcdefghijklmnopqrstuvwxyz0123456789/);
      return true;
    }
  );
});

test('new branch pushes require complete local history', async (t) => {
  const root = await repository(t);
  const head = await commitFile(root, 'README.md', 'safe\n', 'docs: base');
  const zero = '0'.repeat(head.length);
  assert.deepEqual(
    checkOutgoingRefs(
      `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${zero}\n`,
      root
    ),
    { scannedCommits: 1, scannedRefs: 1 }
  );
});

test('outgoing history fails closed for unavailable remote objects and shallow new branches', async (t) => {
  const root = await repository(t);
  const head = await commitFile(root, 'README.md', 'safe\n', 'docs: base');
  const missingRemote = 'f'.repeat(head.length);
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${missingRemote}\n`,
        root
      ),
    /remote tip .* is unavailable/
  );

  const shallowFile = resolve(root, runGit(root, 'rev-parse', '--git-path', 'shallow'));
  await writeFile(shallowFile, `${head}\n`);
  assert.equal(runGit(root, 'rev-parse', '--is-shallow-repository'), 'true');
  const zero = '0'.repeat(head.length);
  assert.throws(
    () =>
      checkOutgoingRefs(
        `refs/heads/feature/HARN-06-harness-test ${head} refs/heads/feature/HARN-06-harness-test ${zero}\n`,
        root
      ),
    /new-branch history cannot be proven in a shallow checkout/
  );
});

test('hook installation is worktree-local and removal restores the selected worktree', async (t) => {
  const root = await repository(t);
  const head = await commitFile(root, 'README.md', 'safe\n', 'docs: base');
  await cp(join(resolve(import.meta.dirname, '../..'), '.githooks'), join(root, '.githooks'), {
    recursive: true,
  });
  runGit(root, 'config', 'extensions.worktreeConfig', 'true');
  const other = join(tmpdir(), `blariyo-harness-linked-${process.pid}-${Date.now()}`);
  t.after(() => {
    spawnSync('git', ['worktree', 'remove', '--force', other], { cwd: root, encoding: 'utf8' });
  });
  runGit(root, 'worktree', 'add', '--detach', other, head);
  const defaultHookDir = runGit(other, 'rev-parse', '--git-path', 'hooks');
  const defaultHook = resolve(root, defaultHookDir, 'pre-commit');
  const marker = join(root, 'original-hook-called.txt');
  await writeFile(defaultHook, `#!/bin/sh\nprintf called > '${marker}'\n`, { mode: 0o755 });

  const installed = await installHooks(root);
  assert.equal(installed.worktree, repositoryRoot(root));
  assert.equal(
    runGit(root, 'config', '--worktree', '--get', 'core.hooksPath'),
    installedHookDirectory(root)
  );
  assert.equal(runGit(other, 'rev-parse', '--git-path', 'hooks'), defaultHookDir);
  assert.equal(
    spawnSync('git', ['config', '--worktree', '--get', 'core.hooksPath'], {
      cwd: other,
      encoding: 'utf8',
    }).status,
    1
  );
  await dispatchHook('pre-commit', [], undefined, root);
  assert.equal(await readFile(marker, 'utf8'), 'called');

  await removeHooks(root);
  assert.equal(
    spawnSync('git', ['config', '--worktree', '--get', 'core.hooksPath'], {
      cwd: root,
      encoding: 'utf8',
    }).status,
    1
  );
  assert.equal(
    spawnSync('git', ['config', '--worktree', '--get', 'core.hooksPath'], {
      cwd: other,
      encoding: 'utf8',
    }).status,
    1
  );
});

test('hook installer refuses to enable a shared worktree extension implicitly', async (t) => {
  const root = await repository(t);
  await assert.rejects(installHooks(root), /extensions\.worktreeConfig is disabled/);
  assert.equal(
    spawnSync('git', ['config', '--bool', '--get', 'extensions.worktreeConfig'], {
      cwd: root,
      encoding: 'utf8',
    }).status,
    1
  );
});

test('post-commit records commit identity and preserves commit success when recording fails', async (t) => {
  const root = await repository(t);
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await cp(join(sourceRoot, 'scripts/harness'), join(root, 'scripts/harness'), { recursive: true });
  await cp(join(sourceRoot, '.githooks'), join(root, '.githooks'), { recursive: true });
  const originalHooks = resolve(root, runGit(root, 'rev-parse', '--git-path', 'hooks'));
  await mkdir(originalHooks, { recursive: true });
  const originalMarker = join(root, 'original-post-commit.log');
  await writeFile(
    join(originalHooks, 'post-commit'),
    `#!/bin/sh\nprintf called >> '${originalMarker}'\nexit 7\n`,
    { mode: 0o755 }
  );
  runGit(root, 'config', 'extensions.worktreeConfig', 'true');
  await installHooks(root);

  const firstChange = '550e8400-e29b-41d4-a716-446655440000';
  await writeFile(join(root, 'scripts/harness/record.txt'), 'recorded\n');
  runGit(root, 'add', 'scripts/harness/record.txt');
  const first = spawnSync(
    'git',
    [
      'commit',
      '-m',
      'test: record successful commit',
      '-m',
      `Task-Id: HARN-06\nChange-Id: ${firstChange}`,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stderr, /original post-commit hook exited 7; the commit remains successful/);
  assert.equal(await readFile(originalMarker, 'utf8'), 'called');
  const recordPath = resolve(
    root,
    runGit(root, 'rev-parse', '--git-path', 'harness-post-commit.jsonl')
  );
  const records = (await readFile(recordPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(records.length, 1);
  assert.equal(records[0].commitSha, runGit(root, 'rev-parse', 'HEAD'));
  assert.equal(records[0].taskId, 'HARN-06');
  assert.equal(records[0].changeId, firstChange);

  await rm(recordPath, { force: true });
  await mkdir(recordPath);
  await writeFile(join(root, 'scripts/harness/record-failure.txt'), 'commit remains\n');
  runGit(root, 'add', 'scripts/harness/record-failure.txt');
  const second = spawnSync(
    'git',
    [
      'commit',
      '-m',
      'test: tolerate post-commit record failure',
      '-m',
      'Task-Id: HARN-06\nChange-Id: 550e8400-e29b-41d4-a716-446655440001',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stderr, /original post-commit hook exited 7; the commit remains successful/);
  assert.equal(await readFile(originalMarker, 'utf8'), 'calledcalled');
  assert.equal(runGit(root, 'cat-file', '-t', 'HEAD'), 'commit');
  assert.match(second.stderr, /commit was created, but its local post-commit record failed/);
});

test('installed pre-push blocks a secret from an earlier commit before local bare-remote receipt', async (t) => {
  const root = await repository(t);
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await cp(join(sourceRoot, 'scripts/harness'), join(root, 'scripts/harness'), { recursive: true });
  await cp(join(sourceRoot, '.harness'), join(root, '.harness'), { recursive: true });
  await cp(join(sourceRoot, '.githooks'), join(root, '.githooks'), { recursive: true });
  const base = await commitFile(root, 'README.md', 'safe\n', 'docs: base');
  runGit(root, 'config', 'extensions.worktreeConfig', 'true');
  const remote = join(tmpdir(), `blariyo-harness-remote-${process.pid}-${Date.now()}`);
  const init = spawnSync('git', ['init', '--bare', remote], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  t.after(() => rm(remote, { recursive: true, force: true }));
  runGit(root, 'remote', 'add', 'origin', remote);
  await installHooks(root);

  await writeFile(join(root, 'scripts/harness/bad-commit.txt'), 'blocked\n');
  runGit(root, 'add', 'scripts/harness/bad-commit.txt');
  const badCommit = spawnSync('git', ['commit', '-m', 'test: missing required trailers'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(badCommit.status, 0);
  assert.match(badCommit.stderr, /commit message requires Task-Id and Change-Id trailers/);
  runGit(root, 'reset', '--quiet');
  await writeFile(join(root, 'scripts/harness/mismatched-task.txt'), 'blocked\n');
  runGit(root, 'add', 'scripts/harness/mismatched-task.txt');
  const mismatchedCommit = spawnSync(
    'git',
    [
      'commit',
      '-m',
      'test: wrong task trailer',
      '-m',
      'Task-Id: OPS-12\nChange-Id: 550e8400-e29b-41d4-a716-446655440000',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.notEqual(mismatchedCommit.status, 0);
  assert.match(mismatchedCommit.stderr, /does not match branch task HARN-06/);
  runGit(root, 'reset', '--quiet');
  await writeFile(join(root, 'scripts/harness/unregistered-change.txt'), 'blocked\n');
  runGit(root, 'add', 'scripts/harness/unregistered-change.txt');
  const unregisteredCommit = spawnSync(
    'git',
    [
      'commit',
      '-m',
      'test: unregistered change',
      '-m',
      'Task-Id: HARN-06\nChange-Id: 550e8400-e29b-41d4-a716-446655440099',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.notEqual(unregisteredCommit.status, 0);
  assert.match(unregisteredCommit.stderr, /Change-Id .* is not registered in task HARN-06/);
  runGit(root, 'reset', '--quiet');

  const initialPush = spawnSync(
    'git',
    ['push', 'origin', 'HEAD:refs/heads/feature/HARN-06-harness-test'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(initialPush.status, 0, initialPush.stderr);
  const remoteHead = runGit(remote, 'rev-parse', 'refs/heads/feature/HARN-06-harness-test');
  await commitFile(
    root,
    'leak.txt',
    `${syntheticGithubToken}\n`,
    'test: add synthetic secret\n\nTask-Id: HARN-06\nChange-Id: 550e8400-e29b-41d4-a716-446655440000',
    true
  );
  const head = await commitFile(
    root,
    'leak.txt',
    'removed\n',
    'test: remove synthetic secret\n\nTask-Id: HARN-06\nChange-Id: 550e8400-e29b-41d4-a716-446655440001',
    true
  );
  assert.notEqual(head, base);
  const blockedPush = spawnSync(
    'git',
    ['push', 'origin', 'HEAD:refs/heads/feature/HARN-06-harness-test'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.notEqual(blockedPush.status, 0);
  assert.match(blockedPush.stderr, /secret candidate \(github-token\).*contents were suppressed/);
  assert.doesNotMatch(blockedPush.stderr, /abcdefghijklmnopqrstuvwxyz0123456789/);
  assert.equal(runGit(remote, 'rev-parse', 'refs/heads/feature/HARN-06-harness-test'), remoteHead);
});
