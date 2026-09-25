import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { validateTapSummary } from './tap.mjs';

const root = resolve(import.meta.dirname, '../..');
const testDirectory = resolve(root, 'tests/harness');
const files = (await readdir(testDirectory))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => resolve(testDirectory, name));
if (files.length === 0) throw new Error('No harness test files found');

const result = spawnSync(
  process.execPath,
  ['--test', '--test-timeout=120000', '--test-reporter=tap', ...files],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  }
);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
else {
  try {
    const summary = validateTapSummary(result.stdout);
    console.log(
      `[harness] ${summary.passed}/${summary.tests} tests passed; skips=${summary.skipped}`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
