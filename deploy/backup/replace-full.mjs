// Owner recovery-machine command. Source and verification DBs are explicit isolated local databases.
import { readFile, lstat, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import * as sdk from '@aws-sdk/client-s3';
import { migrationContext } from '../../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../../apps/api/dist/commands/migrations.service.js';
import { R2Store } from './r2-store.mjs';
import { privateJson } from './drive-store.mjs';
import { replaceLegacySnapshot, removeLegacySpool } from './legacy-replacement.mjs';

const execute = promisify(execFile);
async function load(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077)) throw Error('BACKUP_RECOVERY_CONFIG_PERMISSIONS');
  return JSON.parse(await readFile(path, 'utf8'));
}
function target(value) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/restore_[a-z0-9_]+$/.test(url.pathname)) throw Error('BACKUP_RESTORE_TARGET_REJECTED');
  return { url, env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: url.pathname.slice(1),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) } };
}
async function main() {
  process.umask(0o077);
  if (process.argv.length !== 3) throw Error('BACKUP_REPLACEMENT_CONFIG_REQUIRED');
  const config = await load(process.argv[2]);
  if (config.isolated !== true || config.authorizeOriginalRemoval !== true) throw Error('BACKUP_REPLACEMENT_REMOVAL_NOT_AUTHORIZED');
  const source = target(config.sourceDatabaseUrl), verification = target(config.verificationDatabaseUrl);
  if (source.url.href === verification.url.href) throw Error('BACKUP_INDEPENDENT_DATABASE_REQUIRED');
  const c = await load(config.r2ConfigPath), endpoint = new URL(c.endpoint);
  if (endpoint.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname)) throw Error('BACKUP_R2_ENDPOINT_INVALID');
  const client = new sdk.S3Client({ region: 'auto', endpoint: c.endpoint, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
  const provider = new R2Store({ client, sdk, bucket: c.bucket }), databases = [];
  const root = await mkdtemp(resolve(tmpdir(), 'blariyo-full-replacement-'));
  try {
    for (const folder of ['download', 'spool', 'verify']) await mkdir(resolve(root, folder), { mode: 0o700 });
    const original = await provider.retrieveLegacy({ key: config.originalKey, directory: resolve(root, 'download') });
    for (const t of [source, verification]) { t.db = new pg.Client({ connectionString: t.url.href }); await t.db.connect(); databases.push(t.db); }
    const restore = t => args => spawn(config.pgRestoreExecutable || 'pg_restore', args, { env: t.env, stdio: ['pipe', 'ignore', 'pipe'] });
    const common = { ageExecutable: config.ageExecutable || 'age', identityPath: config.identityPath, isolated: true };
    const receipt = await replaceLegacySnapshot({ original: original.manifest, archivePath: original.archivePath,
      source: { ...common, db: source.db, restore: restore(source) }, verification: { ...common, db: verification.db, restore: restore(verification) },
      migrate: async () => {
        const context = await migrationContext(source.url.href);
        try { await context.get(MigrationsService).migrate(); } finally { await context.close(); }
        const classpath = (await readFile(config.collectorClasspathFile, 'utf8')).trim();
        await execute(config.javaExecutable, ['-cp', classpath, 'com.blariyo.collector.ops.MigrationMain'], { env: { ...process.env,
          COLLECTOR_DB_URL: `jdbc:postgresql://${source.url.hostname}:${source.url.port || '5432'}${source.url.pathname}`,
          COLLECTOR_DB_USER: decodeURIComponent(source.url.username), COLLECTOR_DB_PASSWORD: decodeURIComponent(source.url.password) }, timeout: 300000 });
      },
      snapshot: { ageExecutable: common.ageExecutable, recipient: config.recipient, spoolRoot: resolve(root, 'spool'),
        dump: args => spawn(config.pgDumpExecutable || 'pg_dump', args, { env: source.env, stdio: ['ignore', 'pipe', 'pipe'] }) },
      provider, downloadDirectory: resolve(root, 'verify') });
    await privateJson(config.receiptPath, receipt);
    if (config.originalLocalSpool) await removeLegacySpool(config.originalLocalSpool, receipt);
    console.log(JSON.stringify({ state: 'FULL_REPLACED', backupId: receipt.backupId, rawRestored: 0, expiryPreserved: true }));
  } finally {
    for (const db of databases) await db.end(); client.destroy(); await rm(root, { recursive: true, force: true });
  }
}
await main().catch(error => {
  console.error(/^(?:BACKUP|DRIVE)_[A-Z0-9_]+$/.test(error.message) ? error.message : 'BACKUP_REPLACEMENT_FAILED'); process.exitCode = 1;
});
