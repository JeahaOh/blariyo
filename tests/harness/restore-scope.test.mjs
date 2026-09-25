import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { changedPaths, classifyRestoreChanges } from '../../scripts/harness/restore-scope.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('restore classifier requires core restore for migration and verifier changes', () => {
  assert.equal(
    classifyRestoreChanges(['apps/api/src/features/posts/posts.service.ts']).required,
    false
  );
  assert.deepEqual(classifyRestoreChanges(['apps/api/migrations/V009__next.sql']), {
    required: true,
    supported: true,
    core: true,
    collector: [],
    paths: ['apps/api/migrations/V009__next.sql'],
  });
  assert.equal(
    classifyRestoreChanges(['apps/api/test/migrations.integration.test.ts']).required,
    true
  );
  const collector = classifyRestoreChanges([
    'apps/collector/src/main/resources/db/migration/V2.sql',
  ]);
  assert.equal(collector.required, true);
  assert.equal(collector.supported, true);
});

test('restore path diff includes rename destinations and blocks unavailable or shallow history', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-restore-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.name', 'Harness Test');
  git(root, 'config', 'user.email', 'harness@example.invalid');
  await writeFile(join(root, 'README.md'), 'initial\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'chore: initialize scope fixture');
  const base = git(root, 'rev-parse', 'HEAD');
  await writeFile(join(root, 'README.md'), 'changed\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'docs: update scope fixture');
  const head = git(root, 'rev-parse', 'HEAD');
  assert.deepEqual(changedPaths(base, head, root), ['README.md']);
  assert.throws(() => changedPaths('deadbeef', head, root), /base commit is unavailable/);
});

test('Collector database changes select the dedicated restore gate', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-collector-restore-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.name', 'Harness Test');
  git(root, 'config', 'user.email', 'harness@example.invalid');
  await writeFile(join(root, 'README.md'), 'initial\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'chore: initialize collector restore fixture');
  const base = git(root, 'rev-parse', 'HEAD');
  const migration = join(root, 'apps/collector/src/main/resources/db/collector-v007.sql');
  await mkdir(migration.substring(0, migration.lastIndexOf('/')), { recursive: true });
  await writeFile(migration, 'CREATE TABLE collector.restore_fixture(id INTEGER PRIMARY KEY);\n');
  git(root, 'add', 'apps/collector/src/main/resources/db/collector-v007.sql');
  git(root, 'commit', '-m', 'feat(collector): add schema fixture');
  const head = git(root, 'rev-parse', 'HEAD');
  const script = resolve(import.meta.dirname, '../../scripts/harness/restore-scope.mjs');
  const result = spawnSync(process.execPath, [script, base, head], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /required=true/);
  assert.match(result.stdout, /core=false/);
  assert.match(result.stdout, /collector=true/);
});
