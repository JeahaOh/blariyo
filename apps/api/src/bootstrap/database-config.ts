import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import type { Environment } from './config.js';

type DatabaseRole = 'app' | 'migration';
const prefixes = { app: 'APP_DB', migration: 'MIGRATION_DB' } as const;
const users = { app: 'blariyo_app', migration: 'blariyo_migrator' } as const;
const credentialPrefixes = ['APP_DB', 'MIGRATION_DB', 'BACKUP_DB'];
const fileSettings = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  ...credentialPrefixes.flatMap((prefix) => [`${prefix}_USER`, `${prefix}_PASSWORD_FILE`]),
];

function passwordFromFile(file: string): string {
  let fd: number | undefined;
  try {
    if (!isAbsolute(file)) throw new Error();
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = fstatSync(fd);
    if (!info.isFile() || (info.mode & 0o177) !== 0 || info.size > 1024) throw new Error();
    const password = readFileSync(fd, 'utf8').replace(/\r?\n$/, '');
    if (!/^[\x21-\x7e]{32,256}$/.test(password)) throw new Error();
    return password;
  } catch {
    // Native errors can contain private mount paths. Expose only a stable error code.
    throw new Error('DB_PASSWORD_FILE_INVALID');
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Build a connection URL in memory; never export its password to process.env. */
export function resolveDatabaseUrl(env: Environment, role: DatabaseRole): string {
  const production = env.NODE_ENV === 'production';
  const prefix = prefixes[role];
  if (
    production &&
    (env.DATABASE_URL !== undefined ||
      env.PGPASSWORD !== undefined ||
      credentialPrefixes.some((value) => env[`${value}_PASSWORD`] !== undefined))
  ) {
    throw new Error('PRODUCTION_DB_PASSWORD_FILE_REQUIRED');
  }
  if (env.DATABASE_URL !== undefined) {
    if (fileSettings.some((name) => env[name] !== undefined))
      throw new Error('DB_CONFIG_AMBIGUOUS');
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
    return env.DATABASE_URL;
  }
  if (
    credentialPrefixes.some(
      (value) =>
        value !== prefix &&
        (env[`${value}_USER`] !== undefined || env[`${value}_PASSWORD_FILE`] !== undefined)
    )
  ) {
    throw new Error('DB_CREDENTIAL_SCOPE_INVALID');
  }
  const host = env.DB_HOST;
  const port = env.DB_PORT ?? '5432';
  const database = env.DB_NAME;
  const user = env[`${prefix}_USER`];
  const file = env[`${prefix}_PASSWORD_FILE`];
  if (!host || !database || !user || !file) throw new Error('DB_FILE_CONFIG_REQUIRED');
  const identifier = /^[a-z_][a-z0-9_]{0,62}$/;
  if (
    (!isIP(host) && !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(host)) ||
    !/^[0-9]{1,5}$/.test(port) ||
    Number(port) < 1 ||
    Number(port) > 65535 ||
    !identifier.test(database) ||
    !identifier.test(user)
  )
    throw new Error('DB_FILE_CONFIG_INVALID');
  if (production && user !== users[role]) throw new Error('DB_ROLE_INVALID');
  const url = new URL(
    `postgresql://${isIP(host) === 6 ? `[${host}]` : host}:${Number(port)}/${database}`
  );
  url.username = user;
  url.password = encodeURIComponent(passwordFromFile(file));
  return url.href;
}
