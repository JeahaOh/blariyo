import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { createDataSource } from '../apps/api/dist/persistence/database.js';

const base = process.env.TEST_DATABASE_ADMIN_URL;
if (!base) throw new Error('TEST_DATABASE_ADMIN_URL must point to isolated PostgreSQL');
const target = new URL(base);
if (
  !['127.0.0.1', 'localhost'].includes(target.hostname) ||
  !['55449', '5439'].includes(target.port) ||
  target.pathname !== '/postgres'
)
  throw new Error(
    'Use loopback 55449 or development 5439 with /postgres; tests create and remove only random fixture databases'
  );
const admin = await createDataSource(base).initialize();
try {
  const files = (await readdir('apps/api/dist-test'))
    .filter((file) => file.endsWith('.integration.test.js'))
    .map((file) => `apps/api/dist-test/${file}`)
    .sort();
  const requested = process.argv.slice(2);
  const skipSchemaRestore = requested.includes('--exclude-schema-restore');
  const requestedFiles = requested.filter((file) => file !== '--exclude-schema-restore');
  if (requestedFiles.some((file) => !files.includes(file)))
    throw new Error('Requested test is outside the Nest integration inventory');
  const selected = requestedFiles.length
    ? requestedFiles
    : skipSchemaRestore
      ? files.filter((file) => file !== 'apps/api/dist-test/schema-restore.integration.test.js')
      : files;
  if (!selected.length) throw new Error('No Nest integration tests found');
  for (const file of selected) {
    // Only identifiers generated here may be interpolated. Preserved baseline/user databases are never selected.
    const name = `nest_${randomBytes(6).toString('hex')}`;
    let created = false;
    try {
      await admin.query(`CREATE DATABASE ${name}`);
      created = true;
      const url = new URL(base);
      url.pathname = '/' + name;
      const child = spawn(process.execPath, ['--test', file], {
        stdio: 'inherit',
        env: { ...process.env, TEST_NEST_DATABASE_URL: url.href },
      });
      await new Promise<void>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) =>
          code === 0 ? resolve() : reject(new Error(`Nest ${file} failed: ${signal ?? code}`))
        );
      });
    } finally {
      if (created) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    }
  }
} finally {
  await admin.destroy();
}
