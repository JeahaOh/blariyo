import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
const exec = promisify(execFile);
assert.equal(process.argv.length, 2, 'The final verifier does not accept filters or skip flags');
assert.equal(process.versions.node, '24.18.0');
assert.ok(process.env.JAVA_HOME, 'JAVA_HOME for JDK 25 required');
const root = resolve(import.meta.dirname, '..');
process.chdir(root);
assert.equal((await exec('git', ['branch', '--show-current'])).stdout.trim(), 'main');
const initialHead = (await exec('git', ['rev-parse', 'HEAD'])).stdout;
const initialIndex = (await exec('git', ['ls-files', '--stage'])).stdout;
const database = 'postgresql://postgres@127.0.0.1:55449/postgres';
const browser = 'ws://127.0.0.1:55450/';
// No inherited production credentials or external destinations reach test subprocesses.
const env: Record<string, string> = {
  TEST_DATABASE_ADMIN_URL: database,
  PLAYWRIGHT_WS_ENDPOINT: browser,
};
for (const key of ['PATH', 'HOME', 'TMPDIR', 'JAVA_HOME', 'GRADLE_USER_HOME', 'npm_config_cache']) {
  const value = process.env[key];
  if (value !== undefined) env[key] = value;
}
for (const [name, id] of [
  ['blariyo-nest-migration-pg', 'df230f521b41a0d3ae7486b3d7590b9d0f1ddeacbe23616be4c6399c72b0a3fe'],
  [
    'blariyo-nest-playwright-20260909',
    '8de8b7dee5c7526c74c6f4c0b0d7c138d979f2834356f3ade82a654b72384079',
  ],
]) {
  assert.ok(name && id);
  assert.equal(
    (
      await exec('docker', ['inspect', '--format', '{{.Id}} {{.State.Status}}', name])
    ).stdout.trim(),
    id + ' running',
    'Start only the previously verified owned containers before verification'
  );
}
assert.equal(
  (await exec('docker', ['port', 'blariyo-nest-migration-pg', '5432/tcp'])).stdout.trim(),
  '127.0.0.1:55449'
);
assert.equal(
  (await exec('docker', ['port', 'blariyo-nest-playwright-20260909', '3000/tcp'])).stdout.trim(),
  '127.0.0.1:55450'
);
assert.equal(
  (
    await exec('docker', [
      'exec',
      'blariyo-nest-migration-pg',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atc',
      "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()",
    ])
  ).stdout.trim(),
  '0',
  'Do not overlap another test run'
);
await mkdir('test-results', { recursive: true });
const directory = await mkdtemp(resolve('test-results') + '/migration-');
const awake =
  process.platform === 'darwin'
    ? spawn('/usr/bin/caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' })
    : undefined;
const results: { name: string; code: number | null; signal: NodeJS.Signals | null; log: string }[] =
  [];
async function run(name: string, command: string, args: string[]) {
  console.log('START ' + name);
  const log = `${directory}/${String(results.length + 1).padStart(2, '0')}-${name}.log`;
  await writeFile(log, '');
  const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk: Buffer) => appendFileSync(log, chunk));
  child.stderr.on('data', (chunk: Buffer) => appendFileSync(log, chunk));
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.once('error', (error) => {
        appendFileSync(log, error.message + '\n');
        resolve({ code: 1, signal: null });
      });
      child.once('close', (code, signal) => resolve({ code, signal }));
    }
  );
  results.push({ name, ...result, log });
  await writeFile(directory + '/results.json', JSON.stringify(results, null, 2) + '\n');
  assert.equal(result.code, 0, `${name} failed (${result.signal ?? result.code}); ${log}`);
  console.log('PASS ' + name + ' ' + log);
}
async function testFiles(directory: string, suffix: string) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(suffix)).sort();
  assert.ok(names.length, `No tests found in ${directory}`);
  return names.map((name) => directory + '/' + name);
}
try {
  await run('build', 'npm', ['run', 'build']);
  await run('test-build', 'npm', ['run', 'build:test', '-w', '@blariyo/api']);
  for (const [name, args] of [
    ['api-strict', ['run', 'typecheck', '-w', '@blariyo/api']],
    ['api-test-strict', ['run', 'typecheck:test', '-w', '@blariyo/api']],
    ['api-dev-strict', ['run', 'typecheck:dev', '-w', '@blariyo/api']],
    ['web-strict', ['run', 'typecheck:web']],
    ['tests-strict', ['run', 'typecheck:tests']],
    ['scripts-strict', ['run', 'typecheck:scripts']],
    ['contracts-strict', ['run', 'typecheck', '-w', '@blariyo/contracts']],
    ['api-lint', ['run', 'lint', '-w', '@blariyo/api']],
    ['web-lint', ['run', 'lint', '-w', '@blariyo/web']],
    ['tests-lint', ['run', 'lint:tests']],
    ['scripts-lint', ['run', 'lint:scripts']],
    ['contracts-lint', ['run', 'lint', '-w', '@blariyo/contracts']],
  ] satisfies [string, string[]][])
    await run(name, 'npm', args);
  const sourceTests = (await readdir('apps/api/test'))
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => name.replace(/\.ts$/, '.js'))
    .sort();
  const compiledTests = (await readdir('apps/api/dist-test'))
    .filter((name) => name.endsWith('.test.js'))
    .sort();
  assert.deepEqual(
    compiledTests,
    sourceTests,
    'Every source test must be compiled, with no stale tests'
  );
  await run('unit-architecture-contracts', process.execPath, [
    '--test',
    ...(await testFiles('tests', '.test.ts')),
  ]);
  await run('api-unit', process.execPath, [
    '--test',
    ...(await testFiles('apps/api/dist-test', '.service.test.js')),
  ]);
  await run('postgres-api-cli-schema-restore', process.execPath, [
    'scripts/test-nest-integration.ts',
  ]);
  await run('chromium-bff', process.execPath, [
    '--test',
    '--test-concurrency=1',
    ...(await testFiles('tests/browser', '.test.ts')),
  ]);
  await run('spring-build-unit', 'apps/collector/gradlew', [
    '-p',
    'apps/collector',
    'test',
    'bootJar',
    'fixtureClasspath',
    '--rerun-tasks',
  ]);
  await run('spring-process-recovery', process.execPath, [
    '--test',
    '--test-concurrency=1',
    ...(await testFiles('tests/spring', '.test.ts')),
  ]);
  await run('docker-production-restore', process.execPath, ['scripts/test-docker.ts']);
  async function checkLegacy(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = directory + '/' + entry.name;
      if (entry.isDirectory()) await checkLegacy(path);
      else
        assert.ok(
          !entry.name.endsWith('.test.mjs') &&
            !(directory.startsWith('apps/api/src') && /\.[cm]?js$/.test(entry.name)) &&
            !['test-docker.mjs', 'test-integration.mjs', 'generate-contracts.mjs'].includes(
              entry.name
            ),
          'Legacy entry point remains: ' + path
        );
    }
  }
  for (const directory of ['tests', 'apps/api/src', 'scripts']) await checkLegacy(directory);
  const packageJson = await readFile('package.json', 'utf8');
  assert.doesNotMatch(
    packageJson,
    /test-docker\.mjs|test-integration\.mjs|generate-contracts\.mjs|apps\/api\/src\/.*\.mjs/
  );
  await run('diff-check', 'git', ['diff', '--check']);
  console.log('ALL_REQUIRED_LOCAL_EXECUTION_GATES_PASSED ' + directory);
} finally {
  awake?.kill('SIGTERM');
  assert.equal((await exec('git', ['rev-parse', 'HEAD'])).stdout, initialHead);
  assert.equal((await exec('git', ['ls-files', '--stage'])).stdout, initialIndex);
}
