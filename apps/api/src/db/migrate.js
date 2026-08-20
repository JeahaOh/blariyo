const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');
const MIGRATION_FILE_PATTERN = /^V([0-9]{3})__([a-z0-9_]+)\.sql$/;
const ADVISORY_LOCK_NAMESPACE = 1_836_427;
const ADVISORY_LOCK_KEY = 1;

function checksum(source) {
  return crypto.createHash('sha256').update(source).digest('hex');
}

function discoverMigrations(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = MIGRATION_FILE_PATTERN.exec(entry.name);
      if (!match) {
        throw new Error(`Invalid migration filename: ${entry.name}`);
      }

      const filePath = path.join(migrationsDir, entry.name);
      const source = fs.readFileSync(filePath, 'utf8');

      return {
        version: Number(match[1]),
        name: match[2],
        filename: entry.name,
        source,
        checksum: checksum(source),
      };
    })
    .sort((left, right) => left.version - right.version);

  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion) {
      throw new Error(
        `Migration versions must start at V001 and be consecutive: expected V${String(expectedVersion).padStart(3, '0')}, found ${migration.filename}`
      );
    }
  });

  return migrations;
}

function createMigrationClient() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const common = {
    application_name: 'blariyo-migrator',
    connectionTimeoutMillis: 5000,
  };

  if (connectionString) {
    return new Client({ ...common, connectionString });
  }

  return new Client({
    ...common,
    host: process.env.MIGRATION_DB_HOST || process.env.DB_HOST,
    port: Number(process.env.MIGRATION_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.MIGRATION_DB_NAME || process.env.DB_NAME,
    user: process.env.MIGRATION_DB_USER || process.env.DB_USER,
    password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD,
  });
}

async function ensureMigrationLedger(client) {
  await client.query('BEGIN');
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS ops');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ops.schema_migration (
        version INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        filename VARCHAR(160) NOT NULL UNIQUE,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ck_schema_migration__version CHECK (version > 0),
        CONSTRAINT ck_schema_migration__checksum CHECK (checksum ~ '^[0-9a-f]{64}$')
      )
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function readAppliedMigrations(client) {
  const result = await client.query(`
    SELECT version, name, filename, checksum, applied_at
    FROM ops.schema_migration
    ORDER BY version
  `);
  return result.rows;
}

function verifyAppliedMigrations(migrations, appliedMigrations) {
  const migrationByVersion = new Map(migrations.map((migration) => [migration.version, migration]));

  for (const applied of appliedMigrations) {
    const migration = migrationByVersion.get(applied.version);
    if (!migration) {
      throw new Error(`Applied migration file is missing: V${String(applied.version).padStart(3, '0')}`);
    }
    if (migration.filename !== applied.filename || migration.checksum !== applied.checksum) {
      throw new Error(`Applied migration was modified: ${applied.filename}`);
    }
  }
}

async function applyMigration(client, migration) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    await client.query(migration.source);
    await client.query(
      `INSERT INTO ops.schema_migration (version, name, filename, checksum)
       VALUES ($1, $2, $3, $4)`,
      [migration.version, migration.name, migration.filename, migration.checksum]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration failed: ${migration.filename}`, { cause: error });
  }
}

async function migrate({ migrationsDir = DEFAULT_MIGRATIONS_DIR } = {}) {
  const migrations = discoverMigrations(migrationsDir);
  const client = createMigrationClient();
  const appliedVersions = [];

  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [
      ADVISORY_LOCK_NAMESPACE,
      ADVISORY_LOCK_KEY,
    ]);
    await ensureMigrationLedger(client);

    const appliedMigrations = await readAppliedMigrations(client);
    verifyAppliedMigrations(migrations, appliedMigrations);
    const appliedVersionSet = new Set(appliedMigrations.map((migration) => migration.version));

    for (const migration of migrations) {
      if (appliedVersionSet.has(migration.version)) continue;
      await applyMigration(client, migration);
      appliedVersions.push(migration.version);
    }

    return {
      appliedVersions,
      currentVersion: migrations.at(-1)?.version || 0,
    };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [
        ADVISORY_LOCK_NAMESPACE,
        ADVISORY_LOCK_KEY,
      ]);
    } finally {
      await client.end();
    }
  }
}

if (require.main === module) {
  migrate()
    .then(({ appliedVersions, currentVersion }) => {
      const applied = appliedVersions.length ? appliedVersions.join(', ') : 'none';
      console.log(`Migrations applied: ${applied}; current version: ${currentVersion}`);
    })
    .catch((error) => {
      console.error(error.message);
      if (error.cause) console.error(error.cause.message);
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_MIGRATIONS_DIR,
  checksum,
  discoverMigrations,
  migrate,
  verifyAppliedMigrations,
};
