import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const testBuild = args.length === 1 && args[0] === '--test';
if (args.length && !testBuild) throw new Error('Usage: node build.ts [--test]');
// Only the selected generated output is removed. SQL migrations and source are preserved.
await rm(new URL(testBuild ? './dist-test/' : './dist/', import.meta.url), {
  recursive: true,
  force: true,
});
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url)),
    '-p',
    testBuild ? 'tsconfig.test.json' : 'tsconfig.json',
  ],
  {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    stdio: 'inherit',
  }
);
if (result.error) console.error('API_BUILD_FAILED');
process.exitCode = result.status ?? 1;
