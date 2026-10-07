import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { requiredRow } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource, DatabaseContext } from '../dist/persistence/database.js';
import { TypeOrmMigrationsRepository } from '../dist/persistence/migrations.repository.js';
import { TypeOrmHealthRepository } from '../dist/persistence/health.repository.js';
import { legacyMigrations } from './legacy-migration-fixture.js';
const url = process.env.TEST_NEST_DATABASE_URL;
if (!url) throw new Error('TEST_NEST_DATABASE_URL required');
await test('TypeORM migration preserves SQL ledger, all down/up scripts and restricted application readiness', async (t) => {
  const app = await migrationContext(url);
  const source = await createDataSource(url).initialize(),
    db = new DatabaseContext(source),
    health = new TypeOrmHealthRepository(db),
    repo = new TypeOrmMigrationsRepository(db),
    service = legacyMigrations(db);
  t.after(async () => {
    await app.close();
    await source.destroy();
  });
  const settings = requiredRow(
    await source.query(
      "SELECT current_setting('TimeZone') timezone,current_setting('statement_timeout') statement_timeout,current_setting('lock_timeout') lock_timeout,current_setting('idle_in_transaction_session_timeout') idle_timeout"
    )
  );
  assert.deepEqual(settings, {
    timezone: 'UTC',
    statement_timeout: '30s',
    lock_timeout: '5s',
    idle_timeout: '30s',
  });
  const holder = source.createQueryRunner(),
    waiter = source.createQueryRunner();
  await holder.connect();
  await waiter.connect();
  try {
    await holder.query('SELECT pg_advisory_lock(92734152)');
    await waiter.query("SET lock_timeout='50ms'");
    await assert.rejects(waiter.query('SELECT pg_advisory_lock(92734152)'), { code: '55P03' });
    await waiter.query("SET statement_timeout='50ms'");
    await assert.rejects(waiter.query('SELECT pg_sleep(1)'), { code: '57014' });
    assert.equal(requiredRow(await waiter.query('SELECT 1 AS alive')).alive, 1);
  } finally {
    await holder.query('SELECT pg_advisory_unlock(92734152)');
    await waiter.query('RESET lock_timeout');
    await waiter.query('RESET statement_timeout');
    await holder.release();
    await waiter.release();
  }
  await service.migrate();
  await service.migrate();
  assert.equal(await health.ready(true), true);
  assert.equal(
    requiredRow(await source.query("SELECT ops.is_schema_ready('V008') AS ready")).ready,
    true
  );
  assert.equal(
    requiredRow(await source.query("SELECT ops.is_schema_ready('V999') AS ready")).ready,
    false
  );
  for (const sql of [
    "UPDATE content.board SET slug='renamed'",
    "UPDATE content.board SET updated_by='raw-email@example.invalid'",
    "INSERT INTO content.board_post(board_id,title,status,scheduled_at,created_by,created_at,updated_by,updated_at) VALUES(1,'broken','DRAFT',now(),'system:migration',now(),'system:migration',now())",
    "INSERT INTO ops.outbox_task(type,status,aggregate_type,aggregate_id,payload,next_attempt_at,created_by,created_at,updated_by,updated_at) VALUES('OBJECT_DELETE_PRIVATE','PENDING','STORAGE_OBJECT',999,'{}',now(),'system:migration',now(),'system:migration',now())",
  ])
    await assert.rejects(source.query(sql), { code: '23514' });
  assert.equal(
    requiredRow(
      await source.query(
        "SELECT count(*) FROM information_schema.schemata WHERE schema_name IN ('identity','community')"
      )
    ).count,
    '0'
  );
  for (let i = 0; i < 8; i++) {
    await service.migrate('down');
    if (i === 0) assert.equal(requiredRow(await source.query("SELECT to_regclass('collect.batch_review') value")).value, null);
    if (i === 1) {
      assert.equal(requiredRow(await source.query("SELECT to_regclass('collect.source_discovery_policy') value")).value, null);
      assert.equal(await health.ready(true), false);
      assert.equal(await health.ready(false), true);
    }
    if (i === 2) {
      assert.equal(
        requiredRow(
          await source.query(
            "SELECT count(*) FROM information_schema.columns WHERE table_schema='collect' AND table_name='candidate' AND column_name='content_blocks'"
          )
        ).count,
        '0'
      );
      assert.equal(await health.ready(true), false);
      assert.equal(await health.ready(false), true);
    }
    if (i === 3)
      assert.equal(
        requiredRow(await source.query("SELECT to_regclass('collect.collector_receipt') value"))
          .value,
        null
      );
    if (i === 4) {
      assert.equal(
        requiredRow(await source.query("SELECT to_regnamespace('collect') value")).value,
        null
      );
      assert.equal(await health.ready(false), true);
      assert.equal(await health.ready(true), false);
    }
    if (i === 5)
      assert.equal(
        requiredRow(await source.query("SELECT to_regclass('ops.schedule_failure_alert') value"))
          .value,
        null
      );
    if (i === 6)
      assert.equal(
        requiredRow(await source.query("SELECT ops.is_schema_ready('V001') value")).value,
        true
      );
  }
  await service.migrate();
  assert.equal(
    requiredRow(await source.query('SELECT display_name FROM content.board')).display_name,
    '짤'
  );
  await db.connection(async (runner) => {
    await runner.startTransaction();
    try {
      const role = 'nest_app_' + randomBytes(6).toString('hex');
      await runner.query(`CREATE ROLE ${role} NOLOGIN`);
      await runner.query('CREATE TABLE collect.batch_queue(id uuid); CREATE TABLE collect.batch_confirmation(id uuid); CREATE TABLE collect.future_batch_table(id bigint GENERATED ALWAYS AS IDENTITY)');
      await repo.grantApplication(role);
      await runner.query(`SET LOCAL ROLE ${role}`);
      assert.equal(await health.ready(true), true);
      for (const table of ['batch_queue','batch_confirmation','future_batch_table']) {
        await runner.query('SAVEPOINT private_queue');
        await assert.rejects(runner.query(`SELECT * FROM collect.${table}`), {code:'42501'});
        await runner.query('ROLLBACK TO SAVEPOINT private_queue');
      }
      await runner.query('SAVEPOINT future_sequence');
      await assert.rejects(runner.query("SELECT nextval('collect.future_batch_table_id_seq')"), {code:'42501'});
      await runner.query('ROLLBACK TO SAVEPOINT future_sequence');
      await runner.query('RESET ROLE');
      await runner.query(`REVOKE INSERT ON collect.collector_receipt FROM ${role}`);
      await runner.query(`SET LOCAL ROLE ${role}`);
      assert.equal(await health.ready(true), false);
      await runner.query('RESET ROLE');
      await runner.query(`GRANT INSERT ON collect.collector_receipt TO ${role}`);
      await runner.query(`REVOKE INSERT ON collect.source FROM ${role}`);
      await runner.query(`SET LOCAL ROLE ${role}`);
      assert.equal(await health.ready(true), false);
      assert.equal(
        requiredRow(await runner.query("SELECT ops.is_schema_ready('V008') ready")).ready,
        true
      );
      await runner.query('SAVEPOINT ledger_denied');
      await assert.rejects(runner.query('SELECT * FROM ops.schema_migration'), { code: '42501' });
      await runner.query('ROLLBACK TO SAVEPOINT ledger_denied');
      assert.equal(
        requiredRow(await runner.query('SELECT count(*) FROM content.board')).count,
        '1'
      );
    } finally {
      await runner.rollbackTransaction();
    }
  });
  await source.query(
    "UPDATE ops.schema_migration SET checksum_sha256=decode(repeat('00',32),'hex') WHERE version='V002'"
  );
  await assert.rejects(service.migrate(), /checksum/);
});

await test('additive V009/V010 refuse destructive rollback and preserve exact ledgers', async () => {
  const source = await createDataSource(url).initialize();
  const db = new DatabaseContext(source), repo = new TypeOrmMigrationsRepository(db);
  const app = await migrationContext(url), service = app.get(MigrationsService);
  try {
    // Restore only the intentionally corrupted fixture checksum from the preceding assertion.
    await source.query("UPDATE ops.schema_migration SET checksum_sha256=$1 WHERE version='V002'",
      [await repo.checksum('V002__meme.sql')]);
    for (const version of ['V009', 'V010']) {
      const script = (await repo.scripts()).find(entry => entry.version === version);
      assert.ok(script);
      await source.transaction(async manager => {
        await manager.query(await readFile(new URL(`../migrations/${script.filename}`, import.meta.url), 'utf8'));
        await manager.query('INSERT INTO ops.schema_migration VALUES($1,$2,$3,now(),0)', [script.version,script.filename,script.checksum]);
      });
      const before: unknown = await source.query('SELECT * FROM ops.schema_migration ORDER BY version');
      await assert.rejects(service.migrate('down'), version === 'V009'
        ? /RETENTION_ROLLBACK_REQUIRES_READ_ONLY_HANDOFF/ : /DIRECT_MAILBOX_ROLLBACK_REQUIRES_READ_ONLY_HANDOFF/);
      assert.deepEqual(await source.query('SELECT * FROM ops.schema_migration ORDER BY version'), before);
    }
    // V012 remains reversible before the grouped data model is installed.
    for (const version of ['V011','V012']) {
      const script=(await repo.scripts()).find(entry=>entry.version===version);assert.ok(script);
      await source.transaction(async manager=>{
        await manager.query(await readFile(new URL(`../migrations/${script.filename}`,import.meta.url),'utf8'));
        await manager.query('INSERT INTO ops.schema_migration VALUES($1,$2,$3,now(),0)',[script.version,script.filename,script.checksum]);
      });
    }
    await service.migrate('down');
    assert.equal(requiredRow(await source.query("SELECT ops.is_schema_ready('V011') ready")).ready,true);
    await service.migrate();
    assert.equal(requiredRow(await source.query("SELECT ops.is_schema_ready('V014') ready")).ready,true);
    await service.migrate('down'); // Empty Discord transport state permits V014 rollback.
    assert.equal(requiredRow(await source.query("SELECT ops.is_schema_ready('V013') ready")).ready,true);
    const ledger:unknown=await source.query('SELECT * FROM ops.schema_migration ORDER BY version');
    await assert.rejects(service.migrate('down'),/COMMON_CODES_ROLLBACK_REQUIRES_HANDOFF/);
    await service.migrate();
    const stable = (value: unknown) => JSON.stringify(value, (key, entry: unknown) =>
      ['applied_at', 'duration_ms'].includes(key) ? undefined : entry);
    const restored: unknown = await source.query("SELECT * FROM ops.schema_migration WHERE version<>'V014' ORDER BY version");
    assert.equal(stable(restored), stable(ledger));
  } finally { await app.close(); await source.destroy(); }
});
