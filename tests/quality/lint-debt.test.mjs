import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { lint } from 'markdownlint/sync';
import jsoncParse from 'markdownlint-cli2/parsers/jsonc';
import {
  compareFindings,
  findingFingerprint,
  sqlFiles,
  validateBaseline,
} from '../../scripts/quality/lint-debt.mjs';
import {
  parseSqlFluffReport,
  requireExactFileCoverage,
  requireNonEmptyScope,
  requireReportedFiles,
} from '../../scripts/quality/lint-contracts.mjs';

const accepted = (fingerprint, overrides = {}) => ({
  fingerprint,
  path: 'apps/example/file.ts',
  reason: 'Tracked cleanup in task QLT-01',
  owner: 'platform-team',
  expiresOn: '2026-12-31',
  ...overrides,
});
const policy = { stylelint: { version: '17.15.0', configSha256: 'a'.repeat(64) } };

test('native tool setup reuses the same tools in a main checkout and a linked worktree', async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'blariyo-quality-worktree-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const main = resolve(directory, 'main');
  const linked = resolve(directory, 'linked');
  await mkdir(resolve(main, 'scripts/quality'), { recursive: true });
  await copyFile(
    resolve(import.meta.dirname, '../../scripts/quality/setup-native-tools.mjs'),
    resolve(main, 'scripts/quality/setup-native-tools.mjs')
  );
  const git = (...args) => execFileSync('git', args, { cwd: main, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.name', 'Harness Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('add', '--', 'scripts/quality/setup-native-tools.mjs');
  git('commit', '-qm', 'test: fixture');
  git('worktree', 'add', '-qb', 'linked', linked);
  const tools = resolve(main, '.git/quality-tools');
  await mkdir(tools);
  for (const [name, version] of [
    ['actionlint', '1.7.12'],
    ['shellcheck', '0.11.0'],
  ]) {
    await writeFile(resolve(tools, name), `#!/bin/sh\nprintf '%s\\n' '${version}'\n`, {
      mode: 0o755,
    });
  }
  for (const cwd of [main, linked]) {
    const result = spawnSync(process.execPath, ['scripts/quality/setup-native-tools.mjs'], {
      cwd,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '', 'pinned tools should be reused without a download');
  }
});

test('required lint scopes reject zero or invalid targets and accept a real target', () => {
  assert.equal(requireNonEmptyScope('apps/api/src', 1), 1);
  assert.throws(() => requireNonEmptyScope('apps/api/src', 0), /scope is empty or invalid/);
  assert.throws(
    () => requireNonEmptyScope('apps/api/src', Number.NaN),
    /scope is empty or invalid/
  );
  assert.throws(() => requireReportedFiles('Stylelint', []), /returned no file results/);
  assert.deepEqual(requireReportedFiles('Stylelint', [{ source: 'main.css' }]), [
    { source: 'main.css' },
  ]);
});

test('lint reports must cover every expected file exactly once', () => {
  assert.deepEqual(
    requireExactFileCoverage('SQLFluff', ['./migrations\\V001.sql'], ['migrations/V001.sql']),
    ['./migrations\\V001.sql']
  );
  assert.throws(
    () =>
      requireExactFileCoverage(
        'SQLFluff',
        ['migrations/V001.sql'],
        ['migrations/V001.sql', 'V002.sql']
      ),
    /1 missing, 0 unexpected/
  );
  assert.throws(
    () =>
      requireExactFileCoverage(
        'SQLFluff',
        ['migrations/V001.sql', 'extra.sql'],
        ['migrations/V001.sql']
      ),
    /0 missing, 1 unexpected/
  );
  assert.throws(
    () => requireExactFileCoverage('SQLFluff', ['same.sql', 'same.sql'], ['same.sql']),
    /duplicate file results/
  );
});

test('SQLFluff must report valid results for every scoped file', () => {
  assert.deepEqual(
    parseSqlFluffReport('[{"filepath":"migrations/V001.sql","violations":[]} ]', [
      'migrations/V001.sql',
    ]),
    [{ filepath: 'migrations/V001.sql', violations: [] }]
  );
  assert.throws(
    () => parseSqlFluffReport('[]', ['migrations/V001.sql']),
    /returned no file results/
  );
  assert.throws(
    () => parseSqlFluffReport('{broken', ['migrations/V001.sql']),
    /did not return valid JSON/
  );
  assert.throws(
    () => parseSqlFluffReport('[{"filepath":"x.sql"}]', ['x.sql']),
    /invalid file result/
  );
});

test('SQLFluff scope includes application, collector, content, and deployment SQL', async () => {
  const files = await sqlFiles();
  assert.ok(files.length >= 27);
  for (const path of [
    'apps/api/migrations/V001__core.sql',
    'apps/collector/src/main/resources/db/collector-v001.sql',
    'deploy/postgresql/create-roles.sql',
    'scripts/content/migrations/001_source_capture.sql',
  ])
    assert.ok(files.includes(path), `${path} is missing from the SQL lint scope`);
});

test('Markdown duplicate headings are limited to siblings while nested API templates can repeat', async () => {
  const config = jsoncParse(
    await readFile(resolve(import.meta.dirname, '../../.markdownlint-cli2.jsonc'), 'utf8')
  ).config;
  const siblingDuplicates = lint({
    strings: {
      fixture:
        '# API\n\n## Candidate operation\n\n### Request\n\n### Request\n\n## Other operation\n\n### Request\n',
    },
    config,
  });
  const duplicateHeadings = siblingDuplicates.fixture.filter((issue) =>
    issue.ruleNames.includes('MD024')
  );
  assert.equal(duplicateHeadings.length, 1);
  assert.equal(duplicateHeadings[0].lineNumber, 7);

  const endpointTemplates = lint({
    strings: {
      fixture:
        '# API\n\n## Candidate operation\n\n### Request\n\n## Other operation\n\n### Request\n',
    },
    config,
  });
  assert.equal(
    endpointTemplates.fixture.filter((issue) => issue.ruleNames.includes('MD024')).length,
    0
  );
});

test('finding fingerprint uses the affected source context, rule, tool version, and configuration', () => {
  const finding = {
    tool: 'stylelint',
    path: 'apps/web/main.css',
    ruleId: 'rule-a',
    line: 10,
    column: 2,
    message: 'expected',
    contextSha256: 'b'.repeat(64),
    fileSha256: 'c'.repeat(64),
  };
  const fingerprint = findingFingerprint(finding, '17.15.0', 'a'.repeat(64));
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(
    findingFingerprint({ ...finding, line: 11 }, '17.15.0', 'a'.repeat(64)),
    fingerprint
  );
  assert.notEqual(findingFingerprint(finding, '17.15.1', 'a'.repeat(64)), fingerprint);
  assert.notEqual(findingFingerprint(finding, '17.15.0', 'c'.repeat(64)), fingerprint);
  assert.notEqual(
    findingFingerprint({ ...finding, contextSha256: 'd'.repeat(64) }, '17.15.0', 'a'.repeat(64)),
    fingerprint
  );
});

test('changing unrelated file bytes does not invalidate an unchanged finding context', () => {
  const finding = {
    tool: 'stylelint',
    path: 'apps/web/main.css',
    ruleId: 'rule-a',
    line: 10,
    column: 2,
    message: 'expected',
  };
  const current = { ...finding, contextSha256: 'b'.repeat(64), fileSha256: 'c'.repeat(64) };
  const afterUnrelatedEdit = { ...current, fileSha256: 'd'.repeat(64) };
  const approved = findingFingerprint(current, '17.15.0', 'a'.repeat(64));
  const sameLineAfterUnrelatedEdit = findingFingerprint(
    afterUnrelatedEdit,
    '17.15.0',
    'a'.repeat(64)
  );
  assert.equal(sameLineAfterUnrelatedEdit, approved);
});

test('baseline accepts only exact current fingerprints and reports stale entries for cleanup', () => {
  const known = 'a'.repeat(64);
  const unknown = 'b'.repeat(64);
  const baseline = { schemaVersion: 1, state: 'approved', policy, items: [accepted(known)] };
  assert.deepEqual(compareFindings([{ fingerprint: known }], baseline, '2026-09-25', policy), {
    approved: 1,
    unapproved: [],
    stale: [],
  });
  assert.deepEqual(compareFindings([{ fingerprint: unknown }], baseline, '2026-09-25', policy), {
    approved: 0,
    unapproved: [{ fingerprint: unknown }],
    stale: [known],
  });
});

test('draft, incomplete, duplicate, and expired entries cannot authorize findings', () => {
  const fingerprint = 'c'.repeat(64);
  assert.throws(() =>
    validateBaseline({ schemaVersion: 1, state: 'draft-needs-review', items: [] })
  );
  assert.throws(() =>
    validateBaseline(
      {
        schemaVersion: 1,
        state: 'approved',
        policy,
        items: [accepted(fingerprint, { owner: null })],
      },
      '2026-09-25',
      policy
    )
  );
  assert.throws(() =>
    validateBaseline(
      {
        schemaVersion: 1,
        state: 'approved',
        policy,
        items: [accepted(fingerprint), accepted(fingerprint)],
      },
      '2026-09-25',
      policy
    )
  );
  assert.throws(() =>
    validateBaseline(
      {
        schemaVersion: 1,
        state: 'approved',
        policy,
        items: [accepted(fingerprint, { expiresOn: '2026-09-24' })],
      },
      '2026-09-25',
      policy
    )
  );
  assert.throws(() =>
    validateBaseline(
      { schemaVersion: 1, state: 'approved', policy: {}, items: [] },
      '2026-09-25',
      policy
    )
  );
  assert.throws(() =>
    validateBaseline(
      {
        schemaVersion: 1,
        state: 'approved',
        policy,
        items: [accepted(fingerprint, { expiresOn: '2026-99-99' })],
      },
      '2026-09-25',
      policy
    )
  );
  assert.throws(() =>
    validateBaseline({ schemaVersion: 1, state: 'approved', policy, items: [] }, '2026-09-25', {
      stylelint: { version: '17.15.0', configSha256: 'b'.repeat(64) },
    })
  );
});
