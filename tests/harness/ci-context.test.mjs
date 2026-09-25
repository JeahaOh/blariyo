import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildCiContext, writeCiContext } from '../../scripts/harness/ci-context.mjs';

const changeA = '4ea3e44b-4a0a-4efa-9d5d-471a1a15a0b6';
const changeB = 'cda12345-6e67-4a89-8abc-123456789abc';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function fixture(t, changeIds = [changeA]) {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-ci-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init', '--initial-branch=develop');
  git(root, 'config', 'user.name', 'Harness CI Context Test');
  git(root, 'config', 'user.email', 'ci-context@example.invalid');
  const sourceRoot = resolve(import.meta.dirname, '../..');
  await mkdir(join(root, '.harness/tasks'), { recursive: true });
  await cp(join(sourceRoot, '.harness/policy.json'), join(root, '.harness/policy.json'));
  const task = JSON.parse(await readFile(join(sourceRoot, '.harness/tasks/HARN-06.json'), 'utf8'));
  task.changeIds = changeIds;
  await writeFile(join(root, '.harness/tasks/HARN-06.json'), `${JSON.stringify(task, null, 2)}\n`);
  await writeFile(join(root, 'README.md'), 'baseline\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore: baseline fixture');
  const base = git(root, 'rev-parse', 'HEAD');
  return { root, base };
}

async function taskCommit(root, changeId, file, content) {
  await mkdir(join(root, file, '..'), { recursive: true });
  await writeFile(join(root, file), content);
  git(root, 'add', file);
  git(
    root,
    'commit',
    '-m',
    `feat(harness): bind ${file}\n\nTask-Id: HARN-06\nChange-Id: ${changeId}`
  );
  return git(root, 'rev-parse', 'HEAD');
}

function ciEnv(eventName, sha, overrides = {}) {
  return {
    GITHUB_EVENT_NAME: eventName,
    GITHUB_RUN_ID: '12345',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_REPOSITORY: 'example/blariyo',
    GITHUB_WORKSPACE: '/runner/work/blariyo',
    GITHUB_REF: 'refs/heads/develop',
    GITHUB_SHA: sha,
    ...overrides,
  };
}

test('PR event context binds every task/change commit to manifest and records distinct head and merge-result SHA', async (t) => {
  const { root, base } = await fixture(t, [changeA, changeB]);
  await taskCommit(root, changeA, 'scripts/harness/one.mjs', 'export const one = true;\n');
  await taskCommit(root, changeB, 'scripts/harness/two.mjs', 'export const two = true;\n');
  const head = git(root, 'rev-parse', 'HEAD');
  const mergeResult = 'f'.repeat(40);
  const context = buildCiContext(
    {
      number: 14,
      pull_request: {
        number: 14,
        base: { sha: base, ref: 'develop' },
        head: { sha: head, ref: 'feature/HARN-06-ci-context' },
      },
    },
    ciEnv('pull_request', mergeResult),
    root
  );
  assert.equal(context.subjectSha, mergeResult);
  assert.equal(context.headSha, head);
  assert.equal(context.subjectKind, 'merge-result');
  assert.equal(context.changeBindings.length, 2);
  assert.deepEqual(
    context.changeBindings.map(({ changeId }) => changeId),
    [changeA, changeB]
  );
  assert.equal(context.changeBindings[0].commitShas.length, 1);
  assert.equal(context.executionContext.providerRunId, '12345');
  assert.equal(context.executionContext.attempt, 2);
  assert.match(context.contextSha256, /^[a-f0-9]{64}$/);
});

test('push and manual contexts share binding schema and pin the submitted commit range', async (t) => {
  const { root, base } = await fixture(t);
  const head = await taskCommit(root, changeA, 'scripts/harness/push.mjs', 'export {};\n');
  const push = buildCiContext(
    { before: base, after: head, ref: 'refs/heads/develop' },
    ciEnv('push', head),
    root
  );
  const manual = buildCiContext(
    { inputs: { base_sha: base, purpose: 'reproduce CI evidence' } },
    ciEnv('workflow_dispatch', head),
    root
  );
  assert.deepEqual(push.changeBindings, manual.changeBindings);
  assert.equal(push.executionContext.kind, 'ci');
  assert.equal(manual.executionContext.kind, 'manual');
  assert.equal(manual.purpose, 'reproduce CI evidence');
  assert.equal(push.historyRange.objectCount, 1);
});

test('CI context blocks missing trailers, unregistered change IDs, zero-base pushes, and unrelated manual bases', async (t) => {
  const { root, base } = await fixture(t);
  const head = await taskCommit(root, changeA, 'scripts/harness/change.mjs', 'export {};\n');
  const unknown = 'dca12345-6e67-4a89-8abc-123456789abc';
  await taskCommit(root, unknown, 'scripts/harness/unknown.mjs', 'export {};\n');
  const unknownHead = git(root, 'rev-parse', 'HEAD');
  assert.throws(
    () =>
      buildCiContext(
        { before: base, after: unknownHead, ref: 'refs/heads/develop' },
        ciEnv('push', unknownHead),
        root
      ),
    /not registered/
  );
  assert.throws(
    () =>
      buildCiContext(
        { before: '0'.repeat(40), after: head, ref: 'refs/heads/develop' },
        ciEnv('push', head),
        root
      ),
    /no trusted comparison base/
  );
  assert.throws(
    () =>
      buildCiContext(
        { inputs: { base_sha: 'a'.repeat(40), purpose: 'test' } },
        ciEnv('workflow_dispatch', head),
        root
      ),
    /base commit is unavailable|not an ancestor/
  );
});

test('CI context rejects non-merge commits without exactly one task/change trailer', async (t) => {
  const { root, base } = await fixture(t);
  await taskCommit(root, changeA, 'scripts/harness/valid.mjs', 'export {};\n');
  await writeFile(join(root, 'scripts/harness/missing.mjs'), 'export {};\n');
  git(root, 'add', 'scripts/harness/missing.mjs');
  git(root, 'commit', '-m', 'docs: unbound commit');
  const head = git(root, 'rev-parse', 'HEAD');
  assert.throws(
    () =>
      buildCiContext(
        { before: base, after: head, ref: 'refs/heads/develop' },
        ciEnv('push', head),
        root
      ),
    /exactly one Task-Id and Change-Id/
  );
});

test('PR context excludes target-branch sync commits and merge commits while binding task commits', async (t) => {
  const { root, base } = await fixture(t);
  git(root, 'checkout', '-b', 'feature/HARN-06-sync');
  const featureCommit = await taskCommit(
    root,
    changeA,
    'scripts/harness/feature.mjs',
    'export const feature = true;\n'
  );
  git(root, 'checkout', 'develop');
  await writeFile(join(root, 'README.md'), 'target advanced\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'docs: target branch progress');
  const prBase = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', 'feature/HARN-06-sync');
  git(root, 'merge', '--no-ff', 'develop', '-m', 'Merge develop into feature');
  const prHead = git(root, 'rev-parse', 'HEAD');
  const mergeResult = 'e'.repeat(40);
  const context = buildCiContext(
    {
      pull_request: {
        number: 15,
        base: { sha: prBase, ref: 'develop' },
        head: { sha: prHead, ref: 'feature/HARN-06-sync' },
      },
    },
    ciEnv('pull_request', mergeResult),
    root
  );
  assert.deepEqual(
    context.changeBindings.map((binding) => binding.commitShas),
    [[featureCommit]]
  );
  assert.equal(context.historyRange.objectCount, 2);
  assert.notEqual(context.baseSha, base);
});

test('CI context writer persists the full record and exposes stable job outputs', async (t) => {
  const { root, base } = await fixture(t);
  const head = await taskCommit(
    root,
    changeA,
    'scripts/harness/context-output.mjs',
    'export {};\n'
  );
  const eventPath = join(root, 'event.json');
  const outputPath = join(root, 'ci-context.json');
  const githubOutput = join(root, 'github-output.txt');
  await writeFile(
    eventPath,
    JSON.stringify({ before: base, after: head, ref: 'refs/heads/develop' })
  );
  const context = await writeCiContext(
    eventPath,
    outputPath,
    ciEnv('push', head, { GITHUB_OUTPUT: githubOutput }),
    root
  );
  assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).contextSha256, context.contextSha256);
  const output = await readFile(githubOutput, 'utf8');
  assert.match(output, new RegExp(`subject_sha=${head}`));
  assert.match(output, new RegExp(`bindings_sha256=${context.bindingsSha256}`));
  assert.match(output, /event_name=push/);
});
