import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectorTestDatabase, collectorTestResults } from '../scripts/collector-test-support.ts';

await test('Collector verification accepts only loopback admin databases and decodes credentials', () => {
  assert.deepEqual(collectorTestDatabase('postgresql://fixture:p%40ss@127.0.0.1:55449/postgres'), {
    host: '127.0.0.1',
    port: 55449,
    database: 'postgres',
    user: 'fixture',
    password: 'p@ss',
  });
  assert.equal(collectorTestDatabase('postgres://fixture@localhost:5439/postgres').port, 5439);
  for (const value of [
    'postgresql://fixture@database.example.com:55449/postgres',
    'postgresql://fixture@127.0.0.1:5439/blariyo_local',
    'postgresql://fixture@127.0.0.1:5432/postgres',
    'postgresql://fixture@127.0.0.1:55449/postgres?host=database.example.com',
    'postgresql://fixture@127.0.0.1:55449/postgres#fragment',
    'postgresql://127.0.0.1:55449/postgres',
    'https://fixture@127.0.0.1:55449/postgres',
    'not a connection string',
  ])
    assert.throws(() => collectorTestDatabase(value), /COLLECTOR_TEST_DATABASE_INVALID/);
});

await test('Collector verification rejects missing, partial and skipped JUnit results', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'collector-report-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(collectorTestResults(directory), /REPORTS_MISSING/);
  const path = join(directory, 'TEST-fixture.ReadbackTests.xml');
  const report = (tests: number, failures: number, errors: number, skipped: number) =>
    `<testsuite name="fixture.ReadbackTests" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}"></testsuite>`;
  for (const counts of [
    [0, 0, 0, 0],
    [2, 1, 0, 0],
    [2, 0, 1, 0],
    [2, 0, 0, 1],
  ] as const) {
    await writeFile(path, report(counts[0], counts[1], counts[2], counts[3]));
    await assert.rejects(collectorTestResults(directory), /TESTS_INCOMPLETE/);
  }
  await writeFile(path, '<testsuite tests="2"></testsuite>');
  await assert.rejects(collectorTestResults(directory), /REPORT_INVALID/);
  await writeFile(path, report(2, 0, 0, 0));
  assert.deepEqual(await collectorTestResults(directory), {
    suites: 1,
    tests: 2,
    failures: 0,
    errors: 0,
    skipped: 0,
    readbackTests: 2,
  });
  await rm(path);
  await writeFile(join(directory, 'TEST-fixture.ParserTests.xml'), report(2, 0, 0, 0));
  await assert.rejects(collectorTestResults(directory), /TESTS_INCOMPLETE/);
});
