import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveDatabaseUrl } from '../dist/bootstrap/database-config.js';
import { start } from '../dist/main.js';
import { runCommand } from '../dist/commands/command.js';

await test('DB file settings encode passwords and isolate app/migration credentials', t => {
  const directory = mkdtempSync(join(tmpdir(), 'blariyo-db-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'password');
  const password = 'fixture:' + 'a@/:%?#[]!$'.repeat(4);
  writeFileSync(file, `${password}\n`, { mode: 0o600 });
  const common = { NODE_ENV: 'production', DB_HOST: 'postgresql', DB_NAME: 'blariyo' };
  const appEnv = { ...common, APP_DB_USER: 'blariyo_app', APP_DB_PASSWORD_FILE: file };
  const before = JSON.stringify(appEnv);
  const appUrl = new URL(resolveDatabaseUrl(appEnv, 'app'));
  assert.equal(appUrl.username, 'blariyo_app');
  assert.equal(appUrl.hostname, 'postgresql');
  assert.equal(appUrl.port, '5432');
  assert.equal(appUrl.pathname, '/blariyo');
  assert.equal(decodeURIComponent(appUrl.password), password);
  assert.equal(JSON.stringify(appEnv), before);
  const migrationEnv = { ...common, MIGRATION_DB_USER: 'blariyo_migrator', MIGRATION_DB_PASSWORD_FILE: file };
  const migrationUrl = new URL(resolveDatabaseUrl(migrationEnv, 'migration'));
  assert.equal(migrationUrl.username, 'blariyo_migrator');
  assert.equal(decodeURIComponent(migrationUrl.password), password);
  assert.throws(() => resolveDatabaseUrl(migrationEnv, 'app'), /DB_CREDENTIAL_SCOPE_INVALID/);
  assert.throws(() => resolveDatabaseUrl(appEnv, 'migration'), /DB_CREDENTIAL_SCOPE_INVALID/);
  assert.throws(() => resolveDatabaseUrl({ ...appEnv, BACKUP_DB_PASSWORD_FILE: file }, 'app'), /DB_CREDENTIAL_SCOPE_INVALID/);
  assert.throws(() => resolveDatabaseUrl({ ...appEnv, APP_DB_USER: 'postgres' }, 'app'), /DB_ROLE_INVALID/);
  assert.equal(new URL(resolveDatabaseUrl({ ...appEnv, DB_HOST: '::1', DB_PORT: '5433' }, 'app')).hostname, '[::1]');
});

await test('production rejects direct passwords; local DATABASE_URL stays supported without fallback', async () => {
  const url = 'postgresql://fixture@127.0.0.1/fixture';
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: url }, 'app'), url);
  assert.equal(resolveDatabaseUrl({ NODE_ENV: 'test', DATABASE_URL: url }, 'migration'), url);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: url, DB_HOST: 'postgresql' }, 'app'), /DB_CONFIG_AMBIGUOUS/);
  assert.throws(() => resolveDatabaseUrl({ APP_DB_USER: 'blariyo_app' }, 'app'), /DB_FILE_CONFIG_REQUIRED/);
  for (const name of ['DATABASE_URL', 'PGPASSWORD', 'APP_DB_PASSWORD', 'MIGRATION_DB_PASSWORD', 'BACKUP_DB_PASSWORD']) {
    assert.throws(() => resolveDatabaseUrl({ NODE_ENV: 'production', [name]: 'fixture' }, 'app'), /PRODUCTION_DB_PASSWORD_FILE_REQUIRED/);
  }
  const production = { NODE_ENV: 'production', DATABASE_URL: url };
  await assert.rejects(start(production), /PRODUCTION_DB_PASSWORD_FILE_REQUIRED/);
  await assert.rejects(runCommand('outbox:run', [], production), /PRODUCTION_DB_PASSWORD_FILE_REQUIRED/);
});

await test('invalid password files and malformed connection settings fail before connecting', t => {
  const directory = mkdtempSync(join(tmpdir(), 'blariyo-db-invalid-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'password');
  const env = { NODE_ENV: 'production', DB_HOST: 'postgresql', DB_NAME: 'blariyo', APP_DB_USER: 'blariyo_app', APP_DB_PASSWORD_FILE: file };
  const check = () => resolveDatabaseUrl(env, 'app');
  assert.throws(check, /^Error: DB_PASSWORD_FILE_INVALID$/);
  writeFileSync(file, 'a'.repeat(64), { mode: 0o644 });
  assert.throws(check, /^Error: DB_PASSWORD_FILE_INVALID$/);
  chmodSync(file, 0o600);
  assert.doesNotThrow(check);
  for (const invalid of ['', 'short', 'a'.repeat(257), 'a'.repeat(2048), 'a'.repeat(40) + '\n\n', 'a'.repeat(40) + ' ', '한'.repeat(40)]) {
    writeFileSync(file, invalid);
    assert.throws(check, /^Error: DB_PASSWORD_FILE_INVALID$/);
  }
  writeFileSync(file, 'b'.repeat(64) + '\r\n');
  assert.doesNotThrow(check);
  chmodSync(file, 0o700);
  assert.throws(check, /^Error: DB_PASSWORD_FILE_INVALID$/);
  chmodSync(file, 0o400);
  assert.doesNotThrow(check);
  const alias = join(directory, 'alias');
  symlinkSync(file, alias);
  for (const invalid of [alias, directory, './relative-password']) {
    assert.throws(() => resolveDatabaseUrl({ ...env, APP_DB_PASSWORD_FILE: invalid }, 'app'), /^Error: DB_PASSWORD_FILE_INVALID$/);
  }
  for (const patch of [{ DB_HOST: 'postgresql:5432/other' }, { DB_PORT: '0' }, { DB_PORT: '65536' }, { DB_PORT: 'bad' }, { DB_NAME: '../other' }, { APP_DB_USER: 'bad@user' }]) {
    assert.throws(() => resolveDatabaseUrl({ ...env, ...patch }, 'app'), /DB_FILE_CONFIG_INVALID/);
  }
});

await test('migration CLI reports a safe configuration error without exposing a password', () => {
  const sensitiveFixture = 'fixture-do-not-print-this-password';
  const result = spawnSync(process.execPath, ['apps/api/dist/commands/migrate.js', 'up'], {
    cwd: new URL('../../../', import.meta.url),
    env: { NODE_ENV: 'production', DATABASE_URL: `postgresql://fixture:${sensitiveFixture}@127.0.0.1/fixture` },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), 'PRODUCTION_DB_PASSWORD_FILE_REQUIRED');
  assert.ok(!`${result.stdout}${result.stderr}`.includes(sensitiveFixture));
});
