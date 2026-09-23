import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function collectorTestDatabase(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('COLLECTOR_TEST_DATABASE_INVALID'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !['5439', '55449'].includes(url.port) || url.pathname !== '/postgres' ||
      url.search || url.hash || !url.username)
    throw new Error('COLLECTOR_TEST_DATABASE_INVALID');
  try {
    return { host: url.hostname, port: Number(url.port), database: 'postgres',
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) };
  } catch { throw new Error('COLLECTOR_TEST_DATABASE_INVALID'); }
}

/** Gradle emits one trusted JUnit XML testsuite per file; do not count missing or skipped suites as success. */
export async function collectorTestResults(directory: string) {
  const files = (await readdir(directory)).filter((name) => /^TEST-.+\.xml$/.test(name));
  if (!files.length) throw new Error('COLLECTOR_TEST_REPORTS_MISSING');
  const totals = { suites: files.length, tests: 0, failures: 0, errors: 0, skipped: 0 };
  let readbackTests = 0;
  for (const name of files) {
    const xml = await readFile(join(directory, name), 'utf8');
    const suite = /<testsuite\s+([^>]+)>/.exec(xml)?.[1];
    if (!suite) throw new Error('COLLECTOR_TEST_REPORT_INVALID');
    for (const field of ['tests', 'failures', 'errors', 'skipped'] as const) {
      const number = new RegExp(`\\b${field}="([0-9]+)"`).exec(suite)?.[1];
      if (number === undefined) throw new Error('COLLECTOR_TEST_REPORT_INVALID');
      const count = Number(number);
      if (!Number.isSafeInteger(count)) throw new Error('COLLECTOR_TEST_REPORT_INVALID');
      totals[field] += count;
      if (field === 'tests' && name.endsWith('ReadbackTests.xml')) readbackTests += count;
    }
  }
  if (!totals.tests || !readbackTests || totals.failures || totals.errors || totals.skipped)
    throw new Error('COLLECTOR_TESTS_INCOMPLETE');
  return { ...totals, readbackTests };
}
