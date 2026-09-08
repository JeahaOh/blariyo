import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPool, transaction } from './db.mjs';
const directory = new URL('../migrations/', import.meta.url);
export async function migrate(pool, direction = 'up') {
  return transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(72498131)');
    await db.query(`CREATE SCHEMA IF NOT EXISTS ops; CREATE TABLE IF NOT EXISTS ops.schema_migration (
   version VARCHAR(20) PRIMARY KEY CHECK(version ~ '^V[0-9]{3,}$'), filename VARCHAR(200) NOT NULL UNIQUE,
   checksum_sha256 BYTEA NOT NULL CHECK(octet_length(checksum_sha256)=32), applied_at TIMESTAMPTZ(3) NOT NULL,
   duration_ms INTEGER NOT NULL CHECK(duration_ms>=0)); REVOKE ALL ON ops.schema_migration FROM PUBLIC`);
    const files = (await readdir(directory))
      .filter((f) => /^V\d+__.*\.sql$/.test(f) && !f.endsWith('.down.sql'))
      .sort();
    const applied = (await db.query('SELECT * FROM ops.schema_migration ORDER BY version')).rows;
    for (const record of applied) {
      const content = await readFile(new URL(record.filename, directory));
      if (!createHash('sha256').update(content).digest().equals(record.checksum_sha256))
        throw new Error('Migration checksum mismatch');
    }
    if (direction === 'down') {
      const last = applied.at(-1);
      if (!last) return;
      await db.query(
        await readFile(new URL(last.filename.replace('.sql', '.down.sql'), directory), 'utf8')
      );
      await db.query('DELETE FROM ops.schema_migration WHERE version=$1', [last.version]);
      return;
    }
    if (direction !== 'up') throw new Error('Expected up or down');
    for (const filename of files) {
      const version = filename.split('__')[0];
      if (applied.some((r) => r.version === version)) continue;
      const sql = await readFile(new URL(filename, directory), 'utf8');
      const started = Date.now();
      await db.query(sql);
      await db.query('INSERT INTO ops.schema_migration VALUES($1,$2,$3,now(),$4)', [
        version,
        filename,
        createHash('sha256').update(sql).digest(),
        Date.now() - started,
      ]);
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  try {
    await migrate(pool, process.argv[2] || 'up');
    if (process.env.DB_APP_ROLE) await grantApplication(pool, process.env.DB_APP_ROLE);
    console.log('Migration complete');
  } finally {
    await pool.end();
  }
}
export async function grantApplication(pool, role) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(role)) throw new Error('Invalid application role');
  await pool.query(`GRANT USAGE ON SCHEMA content,legal,ops,collect TO ${role};
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA content,legal,collect TO ${role};
 GRANT SELECT,INSERT,UPDATE,DELETE ON ops.outbox_task,ops.idempotency_request,ops.schedule_failure_alert TO ${role};
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA content,legal,ops,collect TO ${role};
 REVOKE ALL ON ops.schema_migration FROM ${role};
 GRANT EXECUTE ON FUNCTION ops.is_schema_ready(TEXT) TO ${role}`);
}
