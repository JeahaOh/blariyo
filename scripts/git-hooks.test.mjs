import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hookNames = ['pre-commit', 'pre-merge-commit', 'pre-push', 'guard.sh'];

function fixture(t, { install = true } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'blariyo git guards-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = path.join(directory, 'empty-gitconfig');
  env.GIT_TERMINAL_PROMPT = '0';
  writeFileSync(env.GIT_CONFIG_GLOBAL, '');
  const repo = path.join(directory, 'working copy');
  const remote = path.join(directory, 'remote.git');
  mkdirSync(repo);
  const run = (command, args, options = {}) => spawnSync(command, args, { cwd: repo, env, encoding: 'utf8', ...options });
  const git = (...args) => {
    const result = run('git', args);
    assert.equal(result.status, 0, `git ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
  };
  git('init', '-q', '-b', 'feature/test');
  git('config', 'user.name', 'Hook Test');
  git('config', 'user.email', 'hooks@example.invalid');
  git('config', 'commit.gpgSign', 'false');
  writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
  git('add', 'seed.txt');
  git('commit', '-qm', 'seed');
  const initial = git('rev-parse', 'HEAD');
  git('branch', 'main');
  git('branch', 'release');
  git('init', '--bare', '-q', remote);
  git('remote', 'add', 'origin', remote);
  git('push', '-q', 'origin', 'main', 'release');
  mkdirSync(path.join(repo, '.githooks'));
  mkdirSync(path.join(repo, 'scripts'));
  for (const name of hookNames) copyFileSync(path.join(project, '.githooks', name), path.join(repo, '.githooks', name));
  copyFileSync(path.join(project, 'scripts/git-hooks.mjs'), path.join(repo, 'scripts/git-hooks.mjs'));
  const installer = (mode) => run(process.execPath, ['scripts/git-hooks.mjs', mode]);
  if (install) assert.equal(installer('install').status, 0);
  const deny = (args, message) => {
    const result = run('git', args);
    assert.notEqual(result.status, 0, `Unexpected success: git ${args.join(' ')}`);
    assert.match(result.stderr, message);
    return result;
  };
  let number = 0;
  const commit = () => {
    const name = `change-${++number}.txt`;
    writeFileSync(path.join(repo, name), `${number}\n`);
    git('add', name);
    git('commit', '-qm', `change ${number}`);
    return git('rev-parse', 'HEAD');
  };
  const remoteHead = (branch) => git('--git-dir', remote, 'rev-parse', `refs/heads/${branch}`);
  return { repo, remote, initial, run, git, deny, commit, installer, remoteHead };
}

test('feature/hotfix commits and ordinary feature pushes remain allowed', (t) => {
  const f = fixture(t);
  f.commit();
  f.git('push', '-q', 'origin', 'HEAD:refs/heads/feature/test');
  f.git('switch', '-c', 'hotfix-test', 'main');
  f.commit();
  f.git('push', '-q', 'origin', 'HEAD:refs/heads/hotfix-test');
});

test('main commits and automatic local merge commits are rejected', (t) => {
  const f = fixture(t);
  f.commit();
  f.git('switch', 'main');
  f.deny(['commit', '--allow-empty', '-m', 'forbidden'], /main 직접 commit/);
  f.deny(['merge', '--no-ff', 'feature/test', '-m', 'forbidden merge'], /main 로컬 merge commit/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.initial);
});

test('release ordinary commits are rejected and no-ff integration is allowed', (t) => {
  const f = fixture(t);
  f.commit();
  f.git('switch', 'release');
  f.deny(['commit', '--allow-empty', '-m', 'forbidden'], /release 일반 commit/);
  f.git('merge', '--no-ff', 'feature/test', '-m', 'integrate feature');
  assert.equal(f.git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3);
  f.git('push', '-q', 'origin', 'release');
  assert.equal(f.remoteHead('release'), f.git('rev-parse', 'HEAD'));
});

test('release explicit merge completion is allowed after --no-commit', (t) => {
  const f = fixture(t);
  f.commit();
  f.git('switch', 'release');
  f.git('merge', '--no-ff', '--no-commit', 'feature/test');
  f.git('commit', '-qm', 'complete integration');
  assert.equal(f.git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3);
});

test('destination main is blocked for HEAD refspec and another remote name', (t) => {
  const f = fixture(t);
  f.commit();
  f.git('remote', 'add', 'another', f.remote);
  f.deny(['push', 'another', 'HEAD:refs/heads/main'], /원격 main/);
  assert.equal(f.remoteHead('main'), f.initial);
});

test('main and release deletions are rejected', (t) => {
  const f = fixture(t);
  f.deny(['push', 'origin', '--delete', 'main'], /원격 main/);
  f.deny(['push', 'origin', '--delete', 'release'], /원격 release 삭제/);
  assert.equal(f.remoteHead('main'), f.initial);
  assert.equal(f.remoteHead('release'), f.initial);
});

test('release history rewrites are rejected with force and force-with-lease', (t) => {
  const f = fixture(t);
  f.commit();
  f.git('push', '-q', 'origin', 'HEAD:refs/heads/release');
  const before = f.remoteHead('release');
  f.deny(['push', '--force', 'origin', `${f.initial}:refs/heads/release`], /release 이력을 덮어쓰는/);
  f.deny(['push', '--force-with-lease', 'origin', `${f.initial}:refs/heads/release`], /release 이력을 덮어쓰는/);
  assert.equal(f.remoteHead('release'), before);
});

test('one forbidden destination rejects the entire multi-ref push', (t) => {
  const f = fixture(t);
  f.commit();
  f.deny(['push', 'origin', 'HEAD:refs/heads/feature/new', 'HEAD:refs/heads/main'], /원격 main/);
  const listed = f.git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/feature/new');
  assert.equal(listed, '');
  assert.equal(f.remoteHead('main'), f.initial);
});

test('unknown remote release history fails closed without auto-fetch', (t) => {
  const f = fixture(t);
  const tree = f.git('--git-dir', f.remote, 'rev-parse', 'release^{tree}');
  const other = f.git('--git-dir', f.remote, '-c', 'user.name=Remote', '-c', 'user.email=remote@example.invalid', 'commit-tree', tree, '-p', f.initial, '-m', 'other writer');
  f.git('--git-dir', f.remote, 'update-ref', 'refs/heads/release', other);
  f.commit();
  f.deny(['push', '--force', 'origin', 'HEAD:refs/heads/release'], /기준 커밋이 로컬에 없습니다/);
  assert.equal(f.remoteHead('release'), other);
});

test('initial release creation is allowed, but main creation is blocked', (t) => {
  const f = fixture(t);
  const empty = path.join(path.dirname(f.remote), 'empty.git');
  f.git('init', '--bare', '-q', empty);
  f.git('push', '-q', empty, 'HEAD:refs/heads/release');
  f.deny(['push', empty, 'HEAD:refs/heads/main'], /원격 main/);
});

test('installer is repeatable, detects source drift, and protects older branches', (t) => {
  const f = fixture(t);
  assert.equal(f.installer('check').status, 0);
  assert.equal(f.installer('install').status, 0);
  const guard = path.join(f.repo, '.githooks/guard.sh');
  writeFileSync(guard, `${readFileSync(guard, 'utf8')}\n# source update\n`);
  assert.notEqual(f.installer('check').status, 0);
  assert.equal(f.installer('install').status, 0);
  f.git('add', '.githooks', 'scripts/git-hooks.mjs');
  f.git('commit', '-qm', 'version hooks');
  f.git('switch', 'main');
  assert.equal(existsSync(path.join(f.repo, '.githooks/guard.sh')), false);
  f.deny(['commit', '--allow-empty', '-m', 'still forbidden'], /main 직접 commit/);
});

test('installer preserves existing custom hooksPath and default executable hooks', (t) => {
  const f = fixture(t, { install: false });
  f.git('config', 'core.hooksPath', '/existing/hooks');
  assert.notEqual(f.installer('install').status, 0);
  assert.equal(f.git('config', '--get', 'core.hooksPath'), '/existing/hooks');
  f.git('config', '--unset', 'core.hooksPath');
  const existing = path.join(f.repo, '.git/hooks/pre-push');
  writeFileSync(existing, '#!/bin/sh\nexit 0\n');
  chmodSync(existing, 0o755);
  assert.notEqual(f.installer('install').status, 0);
  assert.equal(readFileSync(existing, 'utf8'), '#!/bin/sh\nexit 0\n');
});
