import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
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
const secrets = { app: randomBytes(32).toString('hex'), migrator: randomBytes(32).toString('hex'), backup: randomBytes(32).toString('hex') };
type Role = keyof typeof secrets;
const connections: DataSource[] = [];
let created = false;
let stage = 'initialization';

function command(program: string, args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    child.stdout.on('data', (bytes: Buffer) => output.push(bytes));
    // Errors can quote SQL or credentials; report the verification stage only.
    child.stderr.resume();
    child.once('error', () => reject(new Error('COMMAND_START_FAILED')));
    child.once('close', code => code === 0 ? resolve(Buffer.concat(output)) : reject(new Error('COMMAND_FAILED')));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
const docker = (args: string[], input?: Buffer) => command('docker', args, input);
const admin = (sql: string, database = 'blariyo') => docker(['exec', '-i', '--user', 'postgres', name,
  'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], Buffer.from(sql));
function deniedCode(code: string) {
  return (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
async function denied(source: DataSource, sql: string, code = '42501') {
  await assert.rejects(() => source.query(sql), deniedCode(code));
}

try {
  for (const role of ['app', 'migrator', 'backup'] as const) {
    await writeFile(join(directory, `${role}-password`), secrets[role], { mode: 0o600, flag: 'wx' });
  }
  await writeFile(join(directory, 'bootstrap-password'), randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
  stage = 'PostgreSQL 18 startup';
  await docker(['run', '-d', '--name', name, '--tmpfs', '/var/lib/postgresql',
    '-p', '127.0.0.1::5432', '-e', 'POSTGRES_DB=blariyo', '-e', 'POSTGRES_PASSWORD_FILE=/run/bootstrap-password',
    '--mount', `type=bind,source=${join(directory, 'bootstrap-password')},target=/run/bootstrap-password,readonly`,
    '--mount', `type=bind,source=${join(deployment, 'pg_hba.conf')},target=/etc/blariyo-pg_hba.conf,readonly`,
    'postgres:18', 'postgres', '-c', 'hba_file=/etc/blariyo-pg_hba.conf']);
  created = true;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      // Both startup initialization and the final server accept sockets. TCP listening distinguishes the final server.
      const listening = await admin('SHOW listen_addresses');
      if (listening.toString().trim() === '*') { ready = true; break; }
    } catch { /* PostgreSQL is still initializing. */ }
    await delay(200);
  }
  assert.ok(ready);
  const port = /^127\.0\.0\.1:(\d+)\s*$/.exec((await docker(['port', name, '5432/tcp'])).toString())?.[1];
  assert.ok(port);
  const url = (role: Role) => `postgresql://blariyo_${role}:${secrets[role]}@127.0.0.1:${port}/blariyo`;
  const setup = () => command('python3', [join(deployment, 'create-roles.py'), '--container', name, '--secrets-dir', directory]);

  stage = 'role creation and SCRAM authentication';
  const setupOutput = await setup();
  for (const secret of Object.values(secrets)) assert.ok(!setupOutput.includes(secret));
  for (const role of ['app', 'migrator', 'backup'] as const) connections.push(await createDataSource(url(role)).initialize());
  const [app, migrator, backup] = connections;
  assert.ok(app && migrator && backup);
  const roleFlags = rows(await migrator.query("SELECT rolname FROM pg_roles WHERE rolname IN ('blariyo_app','blariyo_migrator','blariyo_backup') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)"));
  assert.equal(roleFlags.length, 0);
  assert.equal((await admin("SELECT count(*) FROM pg_authid WHERE rolname LIKE 'blariyo_%' AND rolpassword LIKE 'SCRAM-SHA-256$%'" )).toString().trim(), '3');
  await assert.rejects(() => createDataSource(url('app').replace(secrets.app, randomBytes(32).toString('hex'))).initialize(), deniedCode('28P01'));
  await assert.rejects(() => createDataSource(`postgresql://postgres:wrong@127.0.0.1:${port}/blariyo`).initialize(), deniedCode('28000'));
  await assert.rejects(() => createDataSource(url('app').replace('/blariyo', '/postgres')).initialize(), deniedCode('28000'));
  await assert.rejects(setup);
  const freshApp = await createDataSource(url('app')).initialize();
  await freshApp.destroy();
  console.log('PASS 역할 3개 · SCRAM 접속 · 잘못된 비밀번호/관리자 TCP/다른 DB 차단 · 재실행 덮어쓰기 차단');

  stage = 'real migrations and explicit privileges';
  const migration = await migrationContext(url('migrator'));
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const grants = (await readFile(join(deployment, 'apply-privileges.sql'), 'utf8')).replace(/^\\set ON_ERROR_STOP on\r?\n/, '');
  await migrator.query(grants);
  await migrator.query(grants);
  assert.equal(rows(await migrator.query('SELECT count(*)::int AS count FROM ops.schema_migration'))[0]?.count, 5);
  assert.equal(rows(await app.query("SELECT ops.is_schema_ready('V005') AS ready"))[0]?.ready, true);
  assert.equal(rows(await app.query('SHOW timezone'))[0]?.TimeZone, 'UTC');
  await denied(app, 'SELECT * FROM ops.schema_migration');
  await denied(app, 'UPDATE ops.schema_migration SET duration_ms=0');
  await denied(app, 'ALTER TABLE content.board ADD COLUMN forbidden integer');
  for (const schema of ['content', 'legal', 'ops', 'collect', 'public']) await denied(app, `CREATE TABLE ${schema}.__forbidden (id integer)`);
  await denied(app, 'CREATE SCHEMA forbidden');
  for (const role of ['blariyo_migrator', 'blariyo_backup', 'postgres']) await denied(app, `SET ROLE ${role}`);

  stage = 'application draft/publish and trigger execution';
  const application = await createNestApplication({ databaseUrl: url('app'), storage: localStorage(join(directory, 'media')) });
  try {
    const posts = application.get(PostsService);
    const draft = await application.get(UnitOfWork).transaction(() => posts.createDraftInTransaction({ boardSlug: 'meme', title: 'Role verification fixture', source: null, pinnedPosition: null, blocks: [{ type: 'TEXT', text: 'Disposable role test.' }] }, 'system:migration'));
    await posts.command({ action: 'publish', params: { postId: String(draft.postId) }, body: { lockVersion: 1, mode: 'IMMEDIATE' } }, 'system:scheduler');
  } finally { await application.close(); }
  await app.query("UPDATE content.board SET display_name=display_name WHERE slug='meme'");
  await denied(app, "UPDATE content.board SET slug='forbidden' WHERE slug='meme'", '23514');
  console.log('PASS 실제 V001–V005 migration · 권한 재적용 · 앱 draft/publish · trigger 유지 · DDL/ledger/역할 전환 차단');

  stage = 'future objects and backup read-only ACL';
  await migrator.query('CREATE TABLE content.__role_probe(id bigint GENERATED ALWAYS AS IDENTITY, value text); CREATE TABLE ops.__role_probe(id integer)');
  await app.query("INSERT INTO content.__role_probe(value) VALUES ('before'); UPDATE content.__role_probe SET value='after'");
  assert.equal(rows(await app.query('SELECT * FROM content.__role_probe'))[0]?.value, 'after');
  await app.query("INSERT INTO content.__role_probe(value) VALUES ('delete'); DELETE FROM content.__role_probe WHERE value='delete'");
  await denied(app, 'SELECT * FROM ops.__role_probe');
  await backup.query('SELECT * FROM ops.__role_probe');
  assert.equal(rows(await backup.query('SHOW default_transaction_read_only'))[0]?.default_transaction_read_only, 'on');
  const backupSession = backup.createQueryRunner();
  await backupSession.connect();
  try {
    await backupSession.query('SET default_transaction_read_only=off');
    await assert.rejects(() => backupSession.query("INSERT INTO content.__role_probe(value) VALUES ('forbidden')"), deniedCode('42501'));
    await assert.rejects(() => backupSession.query('CREATE TABLE content.__forbidden(id integer)'), deniedCode('42501'));
    await assert.rejects(() => backupSession.query('SET ROLE blariyo_migrator'), deniedCode('42501'));
  } finally { await backupSession.release(); }
  console.log('PASS 향후 table/sequence 권한 · 새 ops table 앱 접근 차단 · backup 읽기 전용(설정 해제 후에도 쓰기 거부)');

  stage = 'backup-role pg_dump and isolated restore';
  // Password travels only through stdin into a temporary owner-only pgpass file.
  const archive = await docker(['exec', '-i', '--user', 'postgres', name, 'sh', '-eu', '-c',
    'umask 077; file=$(mktemp); trap \'rm -f "$file"\' EXIT; cat > "$file"; PGPASSFILE="$file" pg_dump -h 127.0.0.1 -U blariyo_backup -d blariyo -Fc --no-owner --no-acl'],
  Buffer.from(`127.0.0.1:5432:blariyo:blariyo_backup:${secrets.backup}\n`));
  assert.ok(archive.length > 1000);
  await admin('CREATE DATABASE blariyo_restore');
  await docker(['exec', '-i', '--user', 'postgres', name, 'pg_restore', '-U', 'postgres', '-d', 'blariyo_restore', '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl'], archive);
  const tables = rows(await backup.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('content','legal','ops','collect') ORDER BY 1,2"));
  const sequences = rows(await backup.query("SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname IN ('content','legal','ops','collect') ORDER BY 1,2"));
  for (const table of tables) {
    assert.equal(typeof table.schemaname, 'string'); assert.equal(typeof table.tablename, 'string');
    const schema = String(table.schemaname), tableName = String(table.tablename);
    assert.match(schema, /^[a-z_]+$/); assert.match(tableName, /^[a-z_]+$/);
    const sql = `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM "${schema}"."${tableName}" t`;
    assert.deepEqual(await admin(sql, 'blariyo_restore'), await admin(sql));
  }
  for (const sequence of sequences) {
    const schema = String(sequence.schemaname), sequenceName = String(sequence.sequencename);
    assert.match(schema, /^[a-z_]+$/); assert.match(sequenceName, /^[a-z_]+$/);
    const sql = `SELECT last_value,is_called FROM "${schema}"."${sequenceName}"`;
    assert.deepEqual(await admin(sql, 'blariyo_restore'), await admin(sql));
  }
  console.log(`PASS backup 계정 dump · 별도 DB restore · ${tables.length}개 table 전체 행/ledger · ${sequences.length}개 sequence 일치`);
} catch {
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
if (!process.exitCode) console.log('PASS DB 역할 검사 완료 — 임시 PostgreSQL·합성 비밀번호 사용, 운영 서버 미변경');
