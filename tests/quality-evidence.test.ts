import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assess, classify, hash, loadReceipt, parseCounts, snapshot } from '../scripts/quality/receipt.ts';
import type { Receipt } from '../scripts/quality/receipt.ts';
import type { Check } from '../scripts/quality/policy.ts';
import { excludedInputs } from '../scripts/quality/policy.ts';
import { evidenceDirectory, failureLocations, notRun, runCheck, verify } from '../scripts/quality/verify.ts';
import { sanitizeFindings } from '../scripts/quality/audit.ts';
import { review, reviewChange } from '../scripts/quality/review-guards.ts';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'blariyo-quality-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  env.GIT_CONFIG_NOSYSTEM = '1'; env.GIT_CONFIG_GLOBAL = join(root, 'empty-config');
  writeFileSync(env.GIT_CONFIG_GLOBAL, '');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'feature/quality-test');
  git('config', 'user.name', 'Quality Test'); git('config', 'user.email', 'quality@example.invalid');
  git('config', 'commit.gpgSign', 'false');
  writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n');
  writeFileSync(join(root, '.gitignore'), 'empty-config\n');
  git('add', 'source.ts', '.gitignore'); git('commit', '-qm', 'fixture');
  return { root, git };
}
const command: Check = { id: 'lint', command: 'node', args: ['-e', 'process.exit(0)'], parser: 'exit' };
const tap = '# tests 2\n# pass 2\n# fail 0\n# skipped 0\n# todo 0\n';

await test('actual child failure, missing executable, zero tests and interruption never pass', async t => {
  const { root } = fixture(t);
  assert.equal((await runCheck(root, command)).state, 'pass');
  assert.equal((await runCheck(root, { ...command, args: ['-e', 'process.exit(7)'] })).state, 'fail');
  assert.equal((await runCheck(root, { ...command, command: 'blariyo-nonexistent-command' })).state, 'unknown');
  assert.equal((await runCheck(root, { ...command, parser: 'node' })).state, 'unknown');
  const abort = new AbortController();
  const pending = runCheck(root, { ...command, args: ['-e', 'setInterval(() => {}, 1000)'] }, abort.signal);
  setTimeout(() => abort.abort(), 100);
  assert.equal((await pending).state, 'unknown');
  assert.equal((await runCheck(root, command, abort.signal)).state, 'not_run');
});

await test('Node and unittest summaries require real nonempty, complete counts with no skipped requirements', () => {
  assert.equal(classify(0, 'node', parseCounts(tap, 'node')), 'pass');
  assert.equal(classify(0, 'node', parseCounts(tap.replace('# pass 2', '# pass 1').replace('# skipped 0', '# skipped 1'), 'node')), 'unknown');
  assert.equal(classify(0, 'node', parseCounts(tap.replace('# tests 2', '# tests 0').replace('# pass 2', '# pass 0'), 'node')), 'unknown');
  assert.equal(classify(0, 'node', parseCounts(tap.replace('# pass 2', '# pass 3'), 'node')), 'unknown');
  assert.equal(classify(0, 'node', parseCounts(tap + tap, 'node')), 'unknown');
  assert.deepEqual(parseCounts(tap + tap, 'node-files'), { tests: 4, passed: 4, failed: 0, skipped: 0, todo: 0 });
  assert.equal(classify(0, 'node-files', parseCounts(tap + tap, 'node-files')), 'pass');
  assert.equal(parseCounts(tap + tap.replace('# pass 2\n', ''), 'node-files'), null);
  assert.equal(parseCounts(tap + tap.replace('# tests 2', '# tests 0').replace('# pass 2', '# pass 0'), 'node-files'), null);
  assert.equal(classify(0, 'node-files', parseCounts(tap + tap.replace('# pass 2', '# pass 1').replace('# skipped 0', '# skipped 1'), 'node-files')), 'unknown');
  assert.equal(classify(0, 'node', null), 'unknown');
  assert.equal(classify(1, 'exit', null), 'fail');
  assert.equal(classify(null, 'exit', null), 'unknown');
  assert.equal(classify(0, 'unittest', parseCounts('Ran 16 tests in 0.31s\n\nOK\n', 'unittest')), 'pass');
  assert.equal(classify(0, 'unittest', parseCounts('Ran 16 tests in 0.31s\n\nOK (skipped=1)\n', 'unittest')), 'unknown');
});

await test('snapshot covers dirty/untracked inputs, deletion, rename, executable mode, settings and HEAD', t => {
  const { root, git } = fixture(t);
  const initial = snapshot(root);
  writeFileSync(join(root, 'source.ts'), 'export const value = 2;\n');
  assert.notEqual(snapshot(root).digest, initial.digest);
  writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n');
  assert.equal(snapshot(root).digest, initial.digest);
  const task = evidenceDirectory(root, 'worklog/2026-10-06/quality-test');
  writeFileSync(join(task, 'result.json'), '{}');
  assert.equal(snapshot(root).digest, initial.digest);
  writeFileSync(join(root, 'new.ts'), 'export {};');
  assert.notEqual(snapshot(root).digest, initial.digest);
  rmSync(join(root, 'new.ts'));
  chmodSync(join(root, 'source.ts'), 0o755);
  assert.notEqual(snapshot(root).digest, initial.digest);
  chmodSync(join(root, 'source.ts'), 0o644);
  renameSync(join(root, 'source.ts'), join(root, 'moved.ts'));
  assert.notEqual(snapshot(root).digest, initial.digest);
  renameSync(join(root, 'moved.ts'), join(root, 'source.ts'));
  writeFileSync(join(root, 'tsconfig.json'), '{"strict":false}');
  assert.notEqual(snapshot(root).digest, initial.digest);
  rmSync(join(root, 'tsconfig.json'));
  git('commit', '--allow-empty', '-qm', 'same files new head');
  assert.notEqual(snapshot(root).digest, initial.digest);
  rmSync(join(root, 'source.ts'));
  assert.equal(snapshot(root).files['source.ts'], 'deleted');
});

await test('receipt independently rejects stale inputs, missing/duplicate checks and altered commands', async t => {
  const { root } = fixture(t), start = snapshot(root);
  const result = await runCheck(root, command);
  const receipt: Receipt = { schema: 1, profile: 'fixture', root, completed: true, versions: { node: process.version },
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    exclusions: excludedInputs, start, end: start, results: [result], unsupported: [] };
  assert.deepEqual(assess(receipt, start, [command], root), []);
  assert.ok(assess({ ...receipt, completed: false }, start, [command], root).includes('execution-incomplete'));
  assert.ok(assess(receipt, start, [command], root, { node: 'different' }).includes('runtime-changed'));
  assert.ok(assess({ ...receipt, results: [] }, start, [command], root).length);
  assert.ok(assess({ ...receipt, results: [result, result] }, start, [command], root).length);
  assert.ok(assess({ ...receipt, results: [{ ...result, args: ['-e', '0'] }] }, start, [command], root).length);
  assert.ok(assess({ ...receipt, results: [notRun(command)] }, start, [command], root).length);
  assert.ok(assess({ ...receipt, results: [{ ...result, exitCode: 1 }] }, start, [command], root).length);
  assert.ok(assess({ ...receipt, results: [{ ...result, reason: 'output-limit' }] }, start, [command], root).length);
  writeFileSync(join(root, 'new-config.json'), '{}');
  const changed = snapshot(root);
  assert.ok(assess(receipt, changed, [command], root).includes('stale-inputs'));
  assert.ok(assess({ ...receipt, end: changed }, changed, [command], root).includes('inputs-changed-during-run'));
  const file = join(evidenceDirectory(root, 'worklog/2026-10-06/quality-test'), 'receipt.json');
  writeFileSync(file, JSON.stringify(receipt)); assert.equal(loadReceipt(file).schema, 1);
  writeFileSync(file, JSON.stringify({ ...receipt, start: { ...start, digest: hash('tampered') } }));
  assert.throws(() => loadReceipt(file));
  writeFileSync(file, '{'); assert.throws(() => loadReceipt(file));
});

await test('output refuses paths outside worklog and symlink escapes', t => {
  const { root } = fixture(t);
  assert.throws(() => evidenceDirectory(root, '../outside'));
  mkdirSync(join(root, 'outside'));
  symlinkSync(join(root, 'outside'), join(root, 'worklog'));
  assert.throws(() => evidenceDirectory(root, 'worklog/2026-10-06/quality-test'));
  assert.throws(() => snapshot(root));
});

await test('review recognizes skip/only/deletion/assertions while ignoring fixture strings and equivalent assertions', () => {
  const good = "test('x', () => { assert.equal(1, 1); });";
  assert.ok(reviewChange('x.test.ts', good, '').some(f => f.rule === 'test-count-decreased'));
  assert.ok(reviewChange('x.test.ts', good, "test.skip('x', () => { assert.equal(1, 1); });").some(f => f.rule === 'test-skip-added'));
  assert.ok(reviewChange('x.test.ts', good, "test('x', { only: true }, () => {});").some(f => f.rule === 'test-only-added'));
  assert.ok(reviewChange('x.test.ts', good, "test('x', () => {});").some(f => f.rule === 'assertion-count-decreased'));
  assert.ok(reviewChange('x.test.ts', good, '// eslint-disable\n' + good).some(f => f.rule === 'ignore-added'));
  assert.deepEqual(reviewChange('x.test.ts', good, good.replace('assert.equal(1, 1)', 'assert.ok(true)')), []);
  assert.deepEqual(reviewChange('x.test.ts', '', 'const fixture = "test.skip(); // eslint-disable";'), []);
  assert.deepEqual(reviewChange('x.test.ts', good, good.replace("'x'", "'renamed'")), []);
  assert.ok(reviewChange('tsconfig.json', '{"strict":true}', '{"strict":false}').length);
  assert.ok(reviewChange('.github/workflows/ci.yml', 'run: npm test', 'run: true').length);
  assert.ok(reviewChange('tools/iron-laws/config.yml', 'enabled_rules: [IL-101]', 'enabled_rules: []').length);
  assert.ok(reviewChange('tools/oxlint/anti-slop/index.ts', 'register(rule)', '').length);
});

await test('Git review handles moves, untracked tests and unsupported languages without mutating inputs', t => {
  const { root, git } = fixture(t);
  writeFileSync(join(root, 'x.test.ts'), "test('x', () => assert.ok(true));");
  git('add', 'x.test.ts'); git('commit', '-qm', 'test');
  const base = git('rev-parse', 'HEAD');
  renameSync(join(root, 'x.test.ts'), join(root, 'renamed.test.ts'));
  git('add', 'x.test.ts', 'renamed.test.ts');
  writeFileSync(join(root, 'new.test.ts'), 'test.only("new", () => {});');
  writeFileSync(join(root, 'Component.vue'), '<template>test.skip()</template>');
  const start = snapshot(root), result = review(root, base);
  assert.equal(result.findings.filter(f => f.rule === 'test-count-decreased').length, 0);
  assert.ok(result.findings.some(f => f.rule === 'test-only-added'));
  assert.deepEqual(result.unsupported, ['Component.vue']);
  assert.deepEqual(snapshot(root), start);
});

await test('advisory evidence omits source snippets and rejects malformed findings', () => {
  const safe = sanitizeFindings([{ rule_id: 'IL-101', file_path: 'source.ts', line_number: 1,
    severity: 'HIGH', confidence: 'REVIEW', snippet: 'synthetic-sensitive-marker', details: { token: 'private' } }]);
  assert.deepEqual(safe, [{ rule: 'IL-101', file: 'source.ts', line: 1, severity: 'HIGH', confidence: 'REVIEW' }]);
  assert.doesNotMatch(JSON.stringify(safe), /synthetic-sensitive-marker|private|snippet/);
  assert.throws(() => sanitizeFindings([{ rule_id: 'IL-101' }]));
});

await test('failure diagnostics expose file locations without raw assertion values or credentials', () => {
  assert.deepEqual(failureLocations('test at tests/browser/core.test.ts:12:3\n'
    + 'Expected secret-value\nReceived https://user:password@example.invalid\n'
    + 'test at tests/browser/core.test.ts:12:3\n'
    + 'test at https://user:password@example.invalid\n'), ['tests/browser/core.test.ts:12:3']);
});

await test('Docker browser verification rebuilds stale output and never starts tests after a failed build', async t => {
  const root = realpathSync(fixture(t).root), project = resolve(import.meta.dirname, '..');
  const manifest: unknown = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  assert.ok(typeof manifest === 'object' && manifest !== null && 'scripts' in manifest);
  const scripts = manifest.scripts;
  assert.ok(typeof scripts === 'object' && scripts !== null && 'test:browser:docker' in scripts);
  const browserScript = scripts['test:browser:docker'];
  assert.ok(typeof browserScript === 'string');
  writeFileSync(join(root, '.gitignore'), 'empty-config\nnode_modules\ndist/\nbrowser-ran\n');
  symlinkSync(join(project, 'node_modules'), join(root, 'node_modules'));
  mkdirSync(join(root, 'dist')); mkdirSync(join(root, 'scripts/local'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: {
    build: 'node build.mjs', 'test:browser:docker': browserScript,
  } }));
  writeFileSync(join(root, 'build.mjs'), "import {copyFileSync} from 'node:fs';copyFileSync('value.mjs','dist/value.mjs');\n");
  writeFileSync(join(root, 'value.mjs'), 'export const value = 0;\n');
  writeFileSync(join(root, 'dist/value.mjs'), 'export const value = 42;\n');
  writeFileSync(join(root, 'fixture.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {value} from './dist/value.mjs';test('compiled behavior',()=>assert.equal(value,42));\n");
  writeFileSync(join(root, 'scripts/local/playwright-tests.mjs'), "import {spawnSync} from 'node:child_process';import {writeFileSync} from 'node:fs';writeFileSync('browser-ran','yes');const env={...process.env};delete env.NODE_TEST_CONTEXT;process.exitCode=spawnSync(process.execPath,['--test','--test-reporter=tap','fixture.test.mjs'],{stdio:'inherit',env}).status??1;\n");
  const task = 'worklog/2026-10-06/browser-build-regression';
  const stale = await verify(root, 'browser-docker', task);
  assert.ok(stale.problems.includes('browser-docker:not-passing'));
  assert.equal(loadReceipt(stale.file).results[0]?.counts?.failed, 1);
  assert.equal(readFileSync(join(root, 'dist/value.mjs'), 'utf8'), 'export const value = 0;\n');

  writeFileSync(join(root, 'value.mjs'), 'export const value = 42;\n');
  const fresh = await verify(root, 'browser-docker', task);
  assert.deepEqual(fresh.problems, []);
  assert.equal(loadReceipt(fresh.file).results[0]?.counts?.passed, 1);

  rmSync(join(root, 'browser-ran'));
  writeFileSync(join(root, 'build.mjs'), 'process.exit(7);\n');
  const failed = await verify(root, 'browser-docker', task);
  assert.ok(failed.problems.includes('browser-docker:not-passing'));
  assert.equal(existsSync(join(root, 'browser-ran')), false);
});

await test('review flags root and workspace package command weakening without changing files', () => {
  const before = JSON.stringify({ scripts: { lint: 'eslint .', test: 'node --test', build: 'tsc' } });
  const bypass = JSON.stringify({ scripts: { lint: 'node -e "process.exit(0)"' } });
  for (const path of ['package.json', 'apps/api/package.json', 'apps/web/package.json', 'packages/contracts/package.json']) {
    assert.ok(reviewChange(path, before, bypass).some(f => f.rule === 'verification-policy-changed'), path);
    assert.deepEqual(reviewChange(path, before, before), []);
  }
  assert.deepEqual(reviewChange('data/example.json', before, bypass), []);
});
