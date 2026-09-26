// Full Collector database backup/restore verification uses random, tmpfs-backed PostgreSQL containers.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import pg from 'pg';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidenceDirectory = resolve(root, 'test-results/collector-restore');
const suffix = randomBytes(6).toString('hex');
const sourceContainer = `blariyo-collector-source-${suffix}`;
const restoreContainer = `blariyo-collector-restore-${suffix}`;
const sourceDatabase = `collector_source_${suffix}`;
const restoreDatabase = `collector_restore_${suffix}`;
const javaHome = process.env.JAVA_HOME;
const evidence = {
  schemaVersion: 1,
  event: 'COLLECTOR_SCHEMA_RESTORE_RUNNING',
  subjectSha: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  state: 'RUNNING',
};

await mkdir(evidenceDirectory, { recursive: true });
await writeFile(
  resolve(evidenceDirectory, 'summary.json'),
  `${JSON.stringify(evidence, null, 2)}\n`
);

function command(args, input) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', () => rejectCommand(new Error('COLLECTOR_RESTORE_DOCKER_START_FAILED')));
    child.once('exit', (code) =>
      code === 0
        ? resolveCommand(Buffer.concat(stdout))
        : rejectCommand(
            new Error(
              `COLLECTOR_RESTORE_DOCKER_COMMAND_FAILED: ${Buffer.concat(stderr).toString('utf8').trim()}`
            )
          )
    );
    child.stdin.on('error', rejectCommand);
    child.stdin.end(input);
  });
}

function jdbcUrl(database, port) {
  return `jdbc:postgresql://127.0.0.1:${port}/${database}`;
}

async function startPostgres(name, database, created) {
  await command([
    'run',
    '-d',
    '--name',
    name,
    '--tmpfs',
    '/var/lib/postgresql',
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e',
    `POSTGRES_DB=${database}`,
    '-p',
    '127.0.0.1::5432',
    'postgres:18',
  ]);
  created();
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await command([
        'exec',
        name,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        database,
      ]);
      ready = true;
      break;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
  }
  assert.ok(ready, 'temporary PostgreSQL did not become ready');
  const mapping = (await command(['port', name, '5432/tcp'])).toString().trim();
  const match = /^127\.0\.0\.1:(\d+)$/.exec(mapping);
  assert.ok(match?.[1], 'temporary PostgreSQL did not publish a loopback port');
  return Number(match[1]);
}

function normalizeSchema(bytes) {
  return bytes
    .toString('utf8')
    .split('\n')
    .filter((line) => !/^\\(?:un)?restrict /.test(line))
    .map((line) =>
      line.replace(/^(-- Dumped from database version \d+(?:\.\d+)+)(?: \([^\n]*\))?$/, '$1')
    )
    .join('\n');
}

async function snapshot(client) {
  const schemas = ['batch', 'collect', 'collector', 'quartz'];
  const listed = await client.query(
    'SELECT schemaname,tablename FROM pg_tables WHERE schemaname = ANY($1) ORDER BY schemaname,tablename',
    [schemas]
  );
  const state = {};
  for (const { schemaname, tablename } of listed.rows) {
    assert.match(schemaname, /^[a-z_]+$/);
    assert.match(tablename, /^[a-z_]+$/);
    const qualified = `"${schemaname}"."${tablename}"`;
    const rows = await client.query(
      `SELECT to_jsonb(t) AS row FROM ${qualified} t ORDER BY to_jsonb(t)::text`
    );
    state[qualified] = rows.rows.map(({ row }) => row);
  }
  const sequences = await client.query(
    'SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname = ANY($1) ORDER BY schemaname,sequencename',
    [schemas]
  );
  for (const { schemaname, sequencename } of sequences.rows) {
    assert.match(schemaname, /^[a-z_]+$/);
    assert.match(sequencename, /^[a-z_]+$/);
    const qualified = `"${schemaname}"."${sequencename}"`;
    const value = await client.query(`SELECT last_value,is_called FROM ${qualified}`);
    state[qualified] = value.rows;
  }
  return state;
}

async function runMigrationReadback(port, database) {
  const commandPath = resolve(
    root,
    'apps/collector',
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
  );
  const result = await new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      commandPath,
      [
        '-p',
        'apps/collector',
        'test',
        '--tests',
        'com.blariyo.collector.ops.MigrationMainTests',
        '--rerun-tasks',
        '--no-daemon',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          COLLECTOR_READBACK_DATABASE_URL: jdbcUrl(database, port),
          COLLECTOR_READBACK_DATABASE_USER: 'postgres',
          COLLECTOR_READBACK_DATABASE_PASSWORD: '',
        },
      }
    );
    child.once('error', () => rejectRun(new Error('COLLECTOR_RESTORE_TEST_START_FAILED')));
    child.once('exit', (code) => resolveRun(code ?? 1));
  });
  assert.equal(result, 0, 'Collector migration/readback suite failed');
}

function validateJava() {
  assert.ok(javaHome, 'JAVA_HOME must point to Java 25');
  const java = spawnSync(
    resolve(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
    ['-version'],
    {
      encoding: 'utf8',
    }
  );
  assert.equal(java.status, 0, 'JAVA_HOME is not executable');
  assert.match(
    java.stderr + java.stdout,
    /version "25(?:[."])/,
    'Collector restore verifier requires Java 25'
  );
}

let sourceCreated = false;
let restoreCreated = false;
let sourcePort;
const openClients = new Set();

async function connectClient(config) {
  const client = new pg.Client(config);
  await client.connect();
  openClients.add(client);
  return client;
}

async function closeClient(client) {
  openClients.delete(client);
  await client.end();
}

try {
  validateJava();
  sourcePort = await startPostgres(sourceContainer, sourceDatabase, () => {
    sourceCreated = true;
  });
  await runMigrationReadback(sourcePort, sourceDatabase);

  const source = await connectClient({
    host: '127.0.0.1',
    port: sourcePort,
    user: 'postgres',
    database: sourceDatabase,
  });
  await source.query('INSERT INTO collector.token_audit(scope,token_hmac) VALUES($1,$2)', [
    'restore-fixture',
    'a'.repeat(64),
  ]);
  const before = await snapshot(source);
  const sourceSchema = normalizeSchema(
    await command([
      'exec',
      sourceContainer,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      sourceDatabase,
      '--schema-only',
    ])
  );
  const archive = await command([
    'exec',
    sourceContainer,
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    sourceDatabase,
    '-Fc',
  ]);
  await closeClient(source);
  assert.ok(archive.length > 1000, 'Collector backup archive is unexpectedly small');

  const restorePort = await startPostgres(restoreContainer, restoreDatabase, () => {
    restoreCreated = true;
  });
  await command(
    [
      'exec',
      '-i',
      restoreContainer,
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      restoreDatabase,
      '--exit-on-error',
    ],
    archive
  );
  const restored = await connectClient({
    host: '127.0.0.1',
    port: restorePort,
    user: 'postgres',
    database: restoreDatabase,
  });
  const after = await snapshot(restored);
  const restoredSchema = normalizeSchema(
    await command([
      'exec',
      restoreContainer,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      restoreDatabase,
      '--schema-only',
    ])
  );
  await closeClient(restored);
  const referenceDatabase = `collector_reference_${suffix}`;
  await command(['exec', restoreContainer, 'createdb', '-U', 'postgres', referenceDatabase]);
  await command(
    [
      'exec',
      '-i',
      restoreContainer,
      'psql',
      '-U',
      'postgres',
      '-d',
      referenceDatabase,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    Buffer.from(sourceSchema)
  );
  const referenceSchema = normalizeSchema(
    await command([
      'exec',
      restoreContainer,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      referenceDatabase,
      '--schema-only',
    ])
  );
  if (restoredSchema !== referenceSchema)
    throw new Error('COLLECTOR_RESTORED_SCHEMA_DIFFERS_FROM_REFERENCE');
  assert.deepEqual(after, before, 'restored Collector rows or sequences differ from the source');

  await runMigrationReadback(restorePort, restoreDatabase);
  const checked = await connectClient({
    host: '127.0.0.1',
    port: restorePort,
    user: 'postgres',
    database: restoreDatabase,
  });
  const afterMigration = await snapshot(checked);
  await closeClient(checked);
  assert.deepEqual(
    afterMigration,
    before,
    'running migrations after restore changed Collector state'
  );

  evidence.event = 'COLLECTOR_SCHEMA_RESTORE_VERIFIED';
  evidence.state = 'PASS';
  evidence.sourceSchemaSha256 = createHash('sha256').update(sourceSchema).digest('hex');
  evidence.archiveSha256 = createHash('sha256').update(archive).digest('hex');
  evidence.restoredTablesAndSequences = Object.keys(after).length;
  evidence.migrationVersions = ['V001', 'V002', 'V003', 'V004', 'V005', 'V006'];
  console.log(JSON.stringify(evidence));
} catch (error) {
  evidence.event = 'COLLECTOR_SCHEMA_RESTORE_FAILED';
  evidence.state = 'FAILED';
  evidence.failure = error instanceof Error ? error.message : 'COLLECTOR_RESTORE_FAILED';
  console.error(evidence.failure);
  process.exitCode = 1;
} finally {
  for (const client of openClients) await client.end().catch(() => undefined);
  openClients.clear();
  if (restoreCreated) {
    try {
      await command(['rm', '-f', restoreContainer]);
    } catch {
      evidence.cleanupFailedContainer = restoreContainer;
      process.exitCode = 1;
    }
  }
  if (sourceCreated) {
    try {
      await command(['rm', '-f', sourceContainer]);
    } catch {
      evidence.cleanupFailedContainer = sourceContainer;
      process.exitCode = 1;
    }
  }
  await writeFile(
    resolve(evidenceDirectory, 'summary.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
}
