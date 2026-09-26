import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LocalCollectReader } from '../apps/api/dist/adapters/collect-reader.js';
import { BatchReviewService } from '../apps/api/dist/features/collection/batch-review.service.js';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../apps/api/dist/persistence/database.js';
import { rows } from '../apps/api/dist/persistence/rows.js';
import { migrationContext } from '../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../apps/api/dist/commands/migrations.service.js';
import { createNestApplication } from '../apps/api/dist/bootstrap/application.js';
import { UnitOfWork } from '../apps/api/dist/shared/unit-of-work.js';
import { PostsService } from '../apps/api/dist/features/posts/posts.service.js';
import { localStorage } from '../apps/api/dist/adapters/storage.js';

// Only random, disposable credentials/resources. Never reads ~/.config/blariyo.
const name = `blariyo-roles-${randomBytes(6).toString('hex')}`;
const directory = await mkdtemp(join(tmpdir(), 'blariyo-roles-'));
const deployment = fileURLToPath(new URL('../deploy/postgresql/', import.meta.url));
const secrets = {
  batch: randomBytes(32).toString('hex'),
  app: randomBytes(32).toString('hex'),
  migrator: randomBytes(32).toString('hex'),
  backup: randomBytes(32).toString('hex'),
};
type Role = keyof typeof secrets;
const connections: DataSource[] = [];
let created = false;
let stage = 'initialization';

function command(
  program: string,
  args: string[],
  input?: Buffer,
  env?: NodeJS.ProcessEnv
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(env ? { env } : {}),
    });
    const output: Buffer[] = [];
    child.stdout.on('data', (bytes: Buffer) => output.push(bytes));
    // Errors can quote SQL or credentials; report the verification stage only.
    child.stderr.on('data', (bytes: Buffer) => {
      const safe = bytes
        .toString()
        .match(
          /(?:ROLE_FIXTURE|ROLE_COLLECT|ROLE_DEDUP|BATCH|SOURCE)_[A-Z0-9_]+|permission denied for (?:table|function|schema) [a-z_]+/g
        );
      if (safe) console.error([...new Set(safe)].join(' '));
    });
    child.once('error', () => reject(new Error('COMMAND_START_FAILED')));
    child.once('close', (code) =>
      code === 0 ? resolve(Buffer.concat(output)) : reject(new Error('COMMAND_FAILED'))
    );
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
const docker = (args: string[], input?: Buffer) => command('docker', args, input);
const admin = (sql: string, database = 'blariyo') =>
  docker(
    [
      'exec',
      '-i',
      '--user',
      'postgres',
      name,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      database,
    ],
    Buffer.from(sql)
  );
function deniedCode(code: string) {
  return (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
async function denied(source: DataSource, sql: string, code = '42501') {
  await assert.rejects(() => source.query(sql), deniedCode(code));
}

try {
  for (const role of ['app', 'migrator', 'backup', 'batch'] as const) {
    await writeFile(join(directory, `${role}-password`), secrets[role], {
      mode: 0o600,
      flag: 'wx',
    });
  }
  await writeFile(join(directory, 'bootstrap-password'), randomBytes(32).toString('hex'), {
    mode: 0o600,
    flag: 'wx',
  });
  stage = 'PostgreSQL 18 startup';
  await docker([
    'run',
    '-d',
    '--name',
    name,
    '--tmpfs',
    '/var/lib/postgresql',
    '-p',
    '127.0.0.1::5432',
    '-e',
    'POSTGRES_DB=blariyo',
    '-e',
    'POSTGRES_PASSWORD_FILE=/run/bootstrap-password',
    '--mount',
    `type=bind,source=${join(directory, 'bootstrap-password')},target=/run/bootstrap-password,readonly`,
    '--mount',
    `type=bind,source=${join(deployment, 'pg_hba.conf')},target=/etc/blariyo-pg_hba.conf,readonly`,
    'postgres:18',
    'postgres',
    '-c',
    'hba_file=/etc/blariyo-pg_hba.conf',
  ]);
  created = true;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      // Both startup initialization and the final server accept sockets. TCP listening distinguishes the final server.
      const listening = await admin('SHOW listen_addresses');
      if (listening.toString().trim() === '*') {
        ready = true;
        break;
      }
    } catch {
      /* PostgreSQL is still initializing. */
    }
    await delay(200);
  }
  assert.ok(ready);
  const port = /^127\.0\.0\.1:(\d+)\s*$/.exec(
    (await docker(['port', name, '5432/tcp'])).toString()
  )?.[1];
  assert.ok(port);
  const url = (role: Role) =>
    `postgresql://blariyo_${role}:${secrets[role]}@127.0.0.1:${port}/blariyo`;
  const setup = () =>
    command('python3', [
      join(deployment, 'create-roles.py'),
      '--container',
      name,
      '--secrets-dir',
      directory,
    ]);

  stage = 'role creation and SCRAM authentication';
  const setupOutput = await setup();
  const batchSetup = () =>
    command('python3', [
      join(deployment, 'create-roles.py'),
      '--container',
      name,
      '--secrets-dir',
      directory,
      '--batch-only',
    ]);
  await writeFile(join(directory, 'batch-password'), secrets.app, { mode: 0o600 });
  await assert.rejects(batchSetup);
  await writeFile(join(directory, 'batch-password'), secrets.batch, { mode: 0o600 });
  await batchSetup();
  await assert.rejects(batchSetup);
  for (const secret of Object.values(secrets)) assert.ok(!setupOutput.includes(secret));
  for (const role of ['app', 'migrator', 'backup', 'batch'] as const)
    connections.push(await createDataSource(url(role)).initialize());
  const [app, migrator, backup, batch] = connections;
  assert.ok(app && migrator && backup && batch);
  const roleFlags = rows(
    await migrator.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('blariyo_app','blariyo_migrator','blariyo_backup','blariyo_batch') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)"
    )
  );
  assert.equal(roleFlags.length, 0);
  assert.equal(
    (
      await admin(
        "SELECT count(*) FROM pg_authid WHERE rolname LIKE 'blariyo_%' AND rolpassword LIKE 'SCRAM-SHA-256$%'"
      )
    )
      .toString()
      .trim(),
    '4'
  );
  await assert.rejects(
    () =>
      createDataSource(
        url('app').replace(secrets.app, randomBytes(32).toString('hex'))
      ).initialize(),
    deniedCode('28P01')
  );
  await assert.rejects(
    () => createDataSource(`postgresql://postgres:wrong@127.0.0.1:${port}/blariyo`).initialize(),
    deniedCode('28000')
  );
  await assert.rejects(
    () => createDataSource(url('app').replace('/blariyo', '/postgres')).initialize(),
    deniedCode('28000')
  );
  await assert.rejects(setup);
  const freshApp = await createDataSource(url('app')).initialize();
  await freshApp.destroy();
  console.log(
    'PASS 역할 4개 · SCRAM 접속 · 잘못된 비밀번호/관리자 TCP/다른 DB 차단 · 재실행 덮어쓰기 차단'
  );

  stage = 'real migrations and explicit privileges';
  const migration = await migrationContext(url('migrator'));
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const grants = (await readFile(join(deployment, 'apply-privileges.sql'), 'utf8')).replace(
    /^\\set ON_ERROR_STOP on\r?\n/,
    ''
  );
  await migrator.query(grants);
  const java = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
  const classpath = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
  const collectorEnv = (role: Role) => ({
    ...process.env,
    COLLECTOR_DB_URL: `jdbc:postgresql://127.0.0.1:${port}/blariyo`,
    COLLECTOR_DB_USER: `blariyo_${role}`,
    COLLECTOR_DB_PASSWORD: secrets[role],
    COLLECTOR_OBJECT_STORE_DIRECTORY: join(directory, 'collect'),
    ROLE_FIXTURE_IMAGE: join(directory, 'fixture.png'),
  });
  await command(
    java,
    ['-cp', classpath, 'com.blariyo.collector.ops.MigrationMain'],
    undefined,
    collectorEnv('migrator')
  );
  await migrator.query(grants);
  await migrator.query(grants);
  assert.equal(
    rows(await migrator.query('SELECT count(*)::int AS count FROM ops.schema_migration'))[0]?.count,
    8
  );
  assert.deepEqual(
    rows(
      await migrator.query('SELECT version FROM collector.schema_migration ORDER BY version')
    ).map((row) => row.version),
    ['V001', 'V002', 'V003', 'V004', 'V005', 'V006']
  );
  assert.equal(
    rows(await app.query("SELECT ops.is_schema_ready('V008') AS ready"))[0]?.ready,
    true
  );
  assert.equal(rows(await app.query('SHOW timezone'))[0]?.TimeZone, 'UTC');
  await denied(app, 'SELECT * FROM ops.schema_migration');
  await denied(app, 'UPDATE ops.schema_migration SET duration_ms=0');
  await denied(app, 'ALTER TABLE content.board ADD COLUMN forbidden integer');
  for (const schema of ['content', 'legal', 'ops', 'collect', 'public'])
    await denied(app, `CREATE TABLE ${schema}.__forbidden (id integer)`);
  await denied(app, 'CREATE SCHEMA forbidden');
  for (const role of ['blariyo_migrator', 'blariyo_backup', 'postgres'])
    await denied(app, `SET ROLE ${role}`);

  stage = 'batch pipeline with restricted role and object readback';
  await writeFile(
    join(directory, 'fixture.png'),
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#00a19b' } })
      .png()
      .toBuffer()
  );
  await command(
    java,
    ['-cp', classpath, 'com.blariyo.collector.run.BatchRoleFixtureMain'],
    undefined,
    collectorEnv('batch')
  );
  stage = 'batch result DB/object assertions';
  const collected = rows(
    await app.query('SELECT id,state,body_blocks,sns_links,raw_object_key FROM collect.batch_item')
  );
  assert.equal(collected.length, 1);
  assert.equal(collected[0]?.state, 'FETCHED');
  const itemId = String(collected[0]?.id);
  assert.ok(Array.isArray(collected[0]?.body_blocks) && collected[0].body_blocks.length >= 3);
  assert.deepEqual(collected[0]?.sns_links, ['https://x.com/fixture/status/123456789']);
  assert.ok(
    (await readFile(join(directory, 'collect', String(collected[0]?.raw_object_key)))).length > 0
  );
  const collectedMedia = rows(
    await app.query(
      "SELECT kind,object_key,byte_size,encode(sha256,'hex') AS hash FROM collect.batch_media"
    )
  );
  assert.deepEqual(collectedMedia.map((m) => m.kind).sort(), ['FILE', 'IMAGE']);
  for (const media of collectedMedia) {
    const bytes = await readFile(join(directory, 'collect', String(media.object_key)));
    assert.equal(bytes.length, Number(media.byte_size));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), media.hash);
  }
  const reports = rows(
    await app.query("SELECT object_key,encode(sha256,'hex') AS hash FROM collect.batch_report")
  );
  assert.equal(reports.length, 2);
  for (const report of reports)
    assert.equal(
      createHash('sha256')
        .update(await readFile(join(directory, 'collect', String(report.object_key))))
        .digest('hex'),
      report.hash
    );
  assert.equal(
    rows(await app.query('SELECT count(*)::int AS count FROM collect.batch_checkpoint'))[0]?.count,
    2
  );
  for (const table of [
    'batch_source',
    'batch_run',
    'batch_item',
    'batch_media',
    'batch_failure',
    'batch_report',
    'batch_checkpoint',
  ]) {
    await app.query(`SELECT * FROM collect.${table} LIMIT 0`);
    await denied(app, `DELETE FROM collect.${table} WHERE false`);
    await denied(
      app,
      `UPDATE collect.${table} SET ${table === 'batch_source' ? 'host=host' : table === 'batch_report' ? 'jsonl_count=jsonl_count' : table === 'batch_checkpoint' ? 'version=version' : 'id=id'} WHERE false`
    );
  }
  for (const table of ['batch_queue', 'batch_confirmation'])
    await denied(app, `SELECT * FROM collect.${table}`);
  for (const table of [
    'content.board_post',
    'collect.batch_review',
    'collect.source',
    'ops.schema_migration',
  ])
    await denied(batch, `SELECT * FROM ${table}`);
  await denied(app, "SELECT collect.assert_source_owner('theqoo')");
  await denied(batch, 'CREATE TABLE collect.__forbidden(id integer)');
  await denied(batch, 'SET ROLE blariyo_app');
  console.log(
    'PASS 별도 Java batch 계정 수집·중복 skip·본문/image/file/SNS·raw/media/report/checkpoint readback · API/batch 경계'
  );

  stage = 'application draft/publish and trigger execution';
  const storage = localStorage(join(directory, 'media'));
  const application = await createNestApplication({
    databaseUrl: url('app'),
    storage,
    collectBatchReviewEnabled: true,
    collectReader: new LocalCollectReader(join(directory, 'collect')),
  });
  try {
    const posts = application.get(PostsService);
    const review = application.get(BatchReviewService),
      actor = 'admin:v1:' + randomBytes(32).toString('base64url');
    for (const decision of ['REVIEWING', 'APPROVED'] as const) {
      const { item } = await review.detail(itemId);
      await review.review(
        itemId,
        { decision, itemVersion: item.version, lockVersion: item.review.lockVersion },
        actor,
        randomUUID()
      );
    }
    const approved = (await review.detail(itemId)).item;
    await review.promote(
      itemId,
      {
        boardSlug: 'meme',
        itemVersion: approved.version,
        lockVersion: approved.review.lockVersion,
      },
      actor,
      randomUUID()
    );
    const postId = (await review.detail(itemId)).item.review.postId;
    assert.ok(postId);
    assert.equal(
      rows(await app.query('SELECT status FROM content.board_post WHERE id=$1', [postId]))[0]
        ?.status,
      'DRAFT'
    );
    assert.equal((await storage.inventory('private')).length, 1);
    assert.equal((await storage.inventory('public')).length, 0);
    await posts.command(
      {
        action: 'publish',
        params: { postId: String(postId) },
        body: { lockVersion: 1, mode: 'IMMEDIATE' },
      },
      actor
    );
    const media = rows(
      await app.query(
        'SELECT public_storage_key,private_storage_key FROM content.board_post_image WHERE post_id=$1',
        [postId]
      )
    )[0];
    assert.ok(media);
    assert.ok(String(media.public_storage_key).startsWith(`content/published/posts/${postId}/`));
    assert.deepEqual(
      await storage.get('private', String(media.private_storage_key)),
      await storage.get('public', String(media.public_storage_key))
    );
    assert.equal(
      rows(await app.query('SELECT state FROM collect.batch_item WHERE id=$1', [itemId]))[0]?.state,
      'FETCHED'
    );
    const draft = await application.get(UnitOfWork).transaction(() =>
      posts.createDraftInTransaction(
        {
          boardSlug: 'meme',
          title: 'Role verification fixture',
          source: null,
          pinnedPosition: null,
          blocks: [{ type: 'TEXT', text: 'Disposable role test.' }],
        },
        'system:migration'
      )
    );
    await posts.command(
      {
        action: 'publish',
        params: { postId: String(draft.postId) },
        body: { lockVersion: 1, mode: 'IMMEDIATE' },
      },
      'system:scheduler'
    );
  } finally {
    await application.close();
  }
  await app.query("UPDATE content.board SET display_name=display_name WHERE slug='meme'");
  await denied(app, "UPDATE content.board SET slug='forbidden' WHERE slug='meme'", '23514');
  console.log(
    'PASS 실제 API V001–V008 / Collector V001–V006 migration · 권한 재적용 · 앱 draft/publish · trigger 유지 · DDL/ledger/역할 전환 차단'
  );

  stage = 'future objects and backup read-only ACL';
  await migrator.query(
    'CREATE TABLE content.__role_probe(id bigint GENERATED ALWAYS AS IDENTITY, value text); CREATE TABLE ops.__role_probe(id integer); CREATE TABLE collect.__role_probe(id bigint GENERATED ALWAYS AS IDENTITY)'
  );
  await app.query(
    "INSERT INTO content.__role_probe(value) VALUES ('before'); UPDATE content.__role_probe SET value='after'"
  );
  assert.equal(rows(await app.query('SELECT * FROM content.__role_probe'))[0]?.value, 'after');
  await app.query(
    "INSERT INTO content.__role_probe(value) VALUES ('delete'); DELETE FROM content.__role_probe WHERE value='delete'"
  );
  for (const source of [app, batch]) {
    await denied(source, 'SELECT * FROM collect.__role_probe');
    await denied(source, "SELECT nextval('collect.__role_probe_id_seq')");
  }
  await migrator.query(grants);
  const regrant = await migrationContext(url('migrator'));
  try {
    await regrant.get(MigrationsService).grantApplication('blariyo_app');
  } finally {
    await regrant.close();
  }
  for (const source of [app, batch]) await denied(source, 'SELECT * FROM collect.__role_probe');
  await backup.query('SELECT * FROM collect.__role_probe');
  await denied(app, 'SELECT * FROM ops.__role_probe');
  await backup.query('SELECT * FROM ops.__role_probe');
  assert.equal(
    rows(await backup.query('SHOW default_transaction_read_only'))[0]
      ?.default_transaction_read_only,
    'on'
  );
  const backupSession = backup.createQueryRunner();
  await backupSession.connect();
  try {
    await backupSession.query('SET default_transaction_read_only=off');
    await assert.rejects(
      () => backupSession.query("INSERT INTO content.__role_probe(value) VALUES ('forbidden')"),
      deniedCode('42501')
    );
    await assert.rejects(
      () => backupSession.query('CREATE TABLE content.__forbidden(id integer)'),
      deniedCode('42501')
    );
    await assert.rejects(
      () => backupSession.query('SET ROLE blariyo_migrator'),
      deniedCode('42501')
    );
  } finally {
    await backupSession.release();
  }
  console.log(
    'PASS 향후 table/sequence 권한 · 새 ops table 앱 접근 차단 · backup 읽기 전용(설정 해제 후에도 쓰기 거부)'
  );

  stage = 'backup-role pg_dump and isolated restore';
  // Password travels only through stdin into a temporary owner-only pgpass file.
  const archive = await docker(
    [
      'exec',
      '-i',
      '--user',
      'postgres',
      name,
      'sh',
      '-eu',
      '-c',
      'umask 077; file=$(mktemp); trap \'rm -f "$file"\' EXIT; cat > "$file"; PGPASSFILE="$file" pg_dump -h 127.0.0.1 -U blariyo_backup -d blariyo -Fc --no-owner --no-acl',
    ],
    Buffer.from(`127.0.0.1:5432:blariyo:blariyo_backup:${secrets.backup}\n`)
  );
  assert.ok(archive.length > 1000);
  await admin('CREATE DATABASE blariyo_restore');
  await docker(
    [
      'exec',
      '-i',
      '--user',
      'postgres',
      name,
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      'blariyo_restore',
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-acl',
    ],
    archive
  );
  const tables = rows(
    await backup.query(
      "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('content','legal','ops','collect','collector','batch','quartz') ORDER BY 1,2"
    )
  );
  const sequences = rows(
    await backup.query(
      "SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname IN ('content','legal','ops','collect','collector','batch','quartz') ORDER BY 1,2"
    )
  );
  for (const table of tables) {
    assert.equal(typeof table.schemaname, 'string');
    assert.equal(typeof table.tablename, 'string');
    const schema = String(table.schemaname),
      tableName = String(table.tablename);
    assert.match(schema, /^[a-z_]+$/);
    assert.match(tableName, /^[a-z_]+$/);
    const sql = `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM "${schema}"."${tableName}" t`;
    assert.deepEqual(await admin(sql, 'blariyo_restore'), await admin(sql));
  }
  for (const sequence of sequences) {
    const schema = String(sequence.schemaname),
      sequenceName = String(sequence.sequencename);
    assert.match(schema, /^[a-z_]+$/);
    assert.match(sequenceName, /^[a-z_]+$/);
    const sql = `SELECT last_value,is_called FROM "${schema}"."${sequenceName}"`;
    assert.deepEqual(await admin(sql, 'blariyo_restore'), await admin(sql));
  }
  console.log(
    `PASS backup 계정 dump · 별도 DB restore · ${tables.length}개 table 전체 행/ledger · ${sequences.length}개 sequence 일치`
  );
} catch (error) {
  // Print only safe structural diagnostics; SQL statements and credentials stay suppressed.
  if (created) {
    const diagnostics = await docker([
      'exec',
      '--user',
      'postgres',
      name,
      'psql',
      '-X',
      '-qAt',
      '-U',
      'postgres',
      '-d',
      'blariyo',
      '-c',
      "SELECT p.proname||':'||has_function_privilege('blariyo_batch',p.oid,'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='collect' AND p.proname LIKE 'assert_%'",
    ]).catch(() => Buffer.alloc(0));
    console.error(diagnostics.toString().trim());
  }
  if (error instanceof assert.AssertionError) console.error(`ASSERT ${error.operator}`);
  console.error(`FAIL DB 역할 검사 — ${stage} (오류 원문·비밀값 비출력)`);
  process.exitCode = 1;
} finally {
  for (const source of connections) if (source.isInitialized) await source.destroy();
  if (created) {
    await docker(['rm', '-f', name]).catch(() => {
      console.error(`FAIL 임시 container 정리 — ${name}`);
      process.exitCode = 1;
    });
  }
  await rm(directory, { recursive: true, force: true });
}
if (!process.exitCode)
  console.log('PASS DB 역할 검사 완료 — 임시 PostgreSQL·합성 비밀번호 사용, 운영 서버 미변경');
