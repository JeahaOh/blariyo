import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../apps/api/src/db.mjs';
import { randomBytes } from 'node:crypto';
import { migrate, grantApplication } from '../apps/api/src/migrate.mjs';
const database = process.env.TEST_CONSTRAINT_DATABASE_URL;
test(
  'migration up/down, checksum ledger, constraints and isolated schema readiness',
  { skip: !database },
  async (t) => {
    const pool = createPool(database);
    t.after(() => pool.end());
    await migrate(pool);
    await migrate(pool);
    assert.equal(
      (await pool.query("SELECT ops.is_schema_ready('V003') AS ready")).rows[0].ready,
      true
    );
    assert.equal(
      (await pool.query("SELECT ops.is_schema_ready('V999') AS ready")).rows[0].ready,
      false
    );
    await assert.rejects(
      pool.query("UPDATE content.board SET slug='renamed'"),
      (e) => e.code === '23514'
    );
    await assert.rejects(
      pool.query("UPDATE content.board SET updated_by='raw-email@example.invalid'"),
      (e) => e.code === '23514'
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO content.board_post(board_id,title,status,scheduled_at,created_by,created_at,updated_by,updated_at) VALUES(1,'broken','DRAFT',now(),'system:migration',now(),'system:migration',now())"
      ),
      (e) => e.code === '23514'
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO ops.outbox_task(type,status,aggregate_type,aggregate_id,payload,next_attempt_at,created_by,created_at,updated_by,updated_at) VALUES('OBJECT_DELETE_PRIVATE','PENDING','STORAGE_OBJECT',999,'{}',now(),'system:migration',now(),'system:migration',now())"
      ),
      (e) => e.code === '23514'
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*) FROM information_schema.schemata WHERE schema_name IN ('collect','identity','community')"
        )
      ).rows[0].count,
      '0'
    );
    await migrate(pool, 'down');
    assert.equal(
      (await pool.query("SELECT to_regclass('ops.schedule_failure_alert') AS table_name")).rows[0]
        .table_name,
      null
    );
    await migrate(pool, 'down');
    assert.equal(
      (await pool.query("SELECT ops.is_schema_ready('V001') AS ready")).rows[0].ready,
      true
    );
    await migrate(pool, 'down');
    await migrate(pool);
    assert.equal(
      (await pool.query('SELECT display_name FROM content.board')).rows[0].display_name,
      '짤'
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const role = 'm0_app_' + randomBytes(6).toString('hex');
      await client.query(`CREATE ROLE ${role} NOLOGIN`);
      await grantApplication(client, role);
      await client.query(`SET LOCAL ROLE ${role}`);
      assert.equal(
        (await client.query("SELECT ops.is_schema_ready('V003') AS ready")).rows[0].ready,
        true
      );
      await client.query('SAVEPOINT ledger_denied');
      await assert.rejects(
        client.query('SELECT * FROM ops.schema_migration'),
        (e) => e.code === '42501'
      );
      await client.query('ROLLBACK TO SAVEPOINT ledger_denied');
      assert.equal((await client.query('SELECT count(*) FROM content.board')).rows[0].count, '1');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    await pool.query(
      "UPDATE ops.schema_migration SET checksum_sha256=decode(repeat('00',32),'hex') WHERE version='V002'"
    );
    await assert.rejects(migrate(pool), /checksum/);
  }
);
