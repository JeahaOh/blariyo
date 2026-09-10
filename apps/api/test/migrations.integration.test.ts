import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { requiredRow } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource, DatabaseContext } from '../dist/persistence/database.js';
import { TypeOrmMigrationsRepository } from '../dist/persistence/migrations.repository.js';
import { TypeOrmHealthRepository } from '../dist/persistence/health.repository.js';
const url = process.env.TEST_NEST_DATABASE_URL;
if (!url) throw new Error('TEST_NEST_DATABASE_URL required');
await test('TypeORM migration preserves SQL ledger, all down/up scripts and restricted application readiness', async (t) => {
  const app = await migrationContext(url),
    service = app.get(MigrationsService);
  const source = await createDataSource(url).initialize(),
    db = new DatabaseContext(source),
    health = new TypeOrmHealthRepository(db),
    repo = new TypeOrmMigrationsRepository(db);
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
    requiredRow(await source.query("SELECT ops.is_schema_ready('V005') AS ready")).ready,
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
  for (let i = 0; i < 5; i++) {
    await service.migrate('down');
    if (i === 0)
      assert.equal(
        requiredRow(await source.query("SELECT to_regclass('collect.collector_receipt') value"))
          .value,
        null
      );
    if (i === 1) {
      assert.equal(
        requiredRow(await source.query("SELECT to_regnamespace('collect') value")).value,
        null
      );
      assert.equal(await health.ready(false), true);
      assert.equal(await health.ready(true), false);
    }
    if (i === 2)
      assert.equal(
        requiredRow(await source.query("SELECT to_regclass('ops.schedule_failure_alert') value"))
          .value,
        null
      );
    if (i === 3)
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
      await repo.grantApplication(role);
      await runner.query(`SET LOCAL ROLE ${role}`);
      assert.equal(await health.ready(true), true);
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
        requiredRow(await runner.query("SELECT ops.is_schema_ready('V005') ready")).ready,
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
