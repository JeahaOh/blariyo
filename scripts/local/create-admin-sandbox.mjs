import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';
import { migrationContext } from '../../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../../apps/api/dist/commands/migrations.service.js';

// Only create a new random database; never migrate or seed the persistent development DB.
if (process.argv.length !== 2) throw new Error('No arguments allowed');
const target = new URL(
  process.env.TEST_DATABASE_ADMIN_URL || 'postgresql://postgres@127.0.0.1:55449/postgres'
);
if (
  !['127.0.0.1', 'localhost'].includes(target.hostname) ||
  !['55449', '5439'].includes(target.port) ||
  target.pathname !== '/postgres' ||
  target.search
)
  throw new Error('Use a loopback test PostgreSQL admin URL with /postgres');
const id = randomBytes(6).toString('hex');
const directory = resolve('.local-data', `admin-sandbox-${id}`);
const name = `blariyo_sandbox_${id}`;
const admin = await createDataSource(target.href).initialize();
try {
  await admin.query(`CREATE DATABASE ${name}`);
} finally {
  await admin.destroy();
}
target.pathname = '/' + name;
await mkdir(directory, { recursive: true, mode: 0o700 });
await writeFile(
  resolve(directory, 'sandbox.json'),
  JSON.stringify({ version: 1, databaseUrl: target.href }),
  { mode: 0o600 }
);
const migration = await migrationContext(target.href);
try {
  await migration.get(MigrationsService).migrate();
} finally {
  await migration.close();
}
console.log(`Created isolated admin sandbox: ${directory}`);
console.log(`node scripts/local/start-development.mjs --sandbox=${directory} --workers`);
