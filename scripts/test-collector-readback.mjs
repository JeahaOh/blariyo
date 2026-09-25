// Disposable DB only. The persistent blariyo_local database is never a test target.
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { collectorTestDatabase, collectorTestResults } from './collector-test-support.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const name = `blariyo_collector_test_${randomBytes(8).toString('hex')}`;
const database = collectorTestDatabase(
  process.env.TEST_DATABASE_ADMIN_URL ?? 'postgresql://blariyo_local@127.0.0.1:5439/postgres'
);
if (process.argv.length !== 2) throw new Error('COLLECTOR_TEST_ARGUMENTS_INVALID');
const javaHome = process.env.JAVA_HOME;
if (!javaHome) throw new Error('COLLECTOR_TEST_JAVA_25_REQUIRED');
const java = spawnSync(
  resolve(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
  ['-version'],
  { encoding: 'utf8' }
);
if (java.status !== 0 || !/version "25(?:[."])/.test(java.stderr + java.stdout))
  throw new Error('COLLECTOR_TEST_JAVA_25_REQUIRED');
const admin = new pg.Client({ ...database, connectionTimeoutMillis: 10000 });
const evidence = resolve(root, 'test-results/collector-ci');
await mkdir(evidence, { recursive: true });
// A new invocation invalidates any previous success before starting work.
await writeFile(resolve(evidence, 'summary.json'), JSON.stringify({ state: 'RUNNING' }) + '\n');
let created = false;
let summary = { state: 'FAILED' };
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  created = true;
  const command = resolve(
    root,
    'apps/collector',
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
  );
  const result = await new Promise((ok, no) => {
    const child = spawn(command, ['-p', 'apps/collector', 'test', '--rerun-tasks', '--no-daemon'], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        COLLECTOR_READBACK_DATABASE_URL: `jdbc:postgresql://${database.host}:${database.port}/${name}`,
        COLLECTOR_READBACK_DATABASE_USER: database.user,
        COLLECTOR_READBACK_DATABASE_PASSWORD: database.password,
      },
    });
    child.once('error', () => no(Error('COLLECTOR_TEST_START_FAILED')));
    child.once('exit', (code) => ok(code === 0 ? 0 : 1));
  });
  process.exitCode = result;
  if (result === 0) {
    const totals = await collectorTestResults(
      resolve(root, 'apps/collector/build/test-results/test')
    );
    summary = { state: 'PASSED', ...totals };
    console.log(JSON.stringify(summary));
  }
} catch (error) {
  // Do not echo connection strings or database-driver errors.
  const code = error?.message;
  console.error(
    typeof code === 'string' && /^COLLECTOR_TEST[A-Z_]+$/.test(code)
      ? code
      : 'COLLECTOR_TEST_FAILED'
  );
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    } catch {
      console.error(`COLLECTOR_TEST_CLEANUP_REQUIRED ${name}`);
      process.exitCode = 1;
      summary = { state: 'CLEANUP_FAILED' };
    }
  }
  await admin.end();
  await writeFile(resolve(evidence, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
}
