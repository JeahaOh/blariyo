// Run on the owner's recovery machine. Never install the identity on the backup server.
import { readFile, lstat, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import * as sdk from '@aws-sdk/client-s3';
import { DriveAuth } from './drive-auth.mjs';
import { DriveStore, privateJson } from './drive-store.mjs';
import { R2Store } from './r2-store.mjs';
import { restoreSnapshot } from './restore-snapshot.mjs';

async function load(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077)) throw Error('BACKUP_RECOVERY_CONFIG_PERMISSIONS');
  return JSON.parse(await readFile(path, 'utf8'));
}
async function main() {
  process.umask(0o077);
  if (process.argv.length !== 3) throw Error('BACKUP_RECOVERY_CONFIG_REQUIRED');
  const config = await load(resolve(process.argv[2]));
  if (config.isolated !== true || !['r2', 'drive'].includes(config.provider)) throw Error('BACKUP_ISOLATED_RESTORE_REQUIRED');
  const database = new URL(config.isolatedDatabaseUrl);
  if (!['127.0.0.1', '[::1]', 'localhost'].includes(database.hostname) || !/^\/restore_[a-z0-9_]+$/.test(database.pathname))
    throw Error('BACKUP_RESTORE_TARGET_REJECTED');
  const directory = await mkdtemp(resolve(tmpdir(), 'blariyo-independent-restore-'));
  let client, db;
  try {
    let provider, selection;
    if (config.provider === 'drive') {
      const c = await load(config.providerConfigPath);
      provider = new DriveStore({ auth: new DriveAuth(c), folderId: c.folderId, driveId: c.driveId });
      selection = { manifestFileId: config.manifestFileId, directory };
    } else {
      const c = await load(config.providerConfigPath), url = new URL(c.endpoint);
      if (url.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname)) throw Error('BACKUP_R2_ENDPOINT_INVALID');
      client = new sdk.S3Client({ region: 'auto', endpoint: c.endpoint, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
      provider = new R2Store({ client, sdk, bucket: c.bucket }); selection = { backupId: config.backupId, directory };
    }
    const downloaded = await provider.retrieve(selection);
    db = new pg.Client({ connectionString: database.href, connectionTimeoutMillis: 30000 }); await db.connect();
    const restore = args => spawn(config.pgRestoreExecutable || 'pg_restore', args, { stdio: ['pipe', 'ignore', 'pipe'], env: {
      ...process.env, PGHOST: database.hostname, PGPORT: database.port || '5432', PGDATABASE: database.pathname.slice(1),
      PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password),
    } });
    const receipt = await restoreSnapshot({ ...downloaded, db, restore, ageExecutable: config.ageExecutable || 'age',
      identityPath: config.identityPath, isolated: true });
    receipt.provider = config.provider;
    await privateJson(config.receiptPath, receipt);
    console.log(JSON.stringify({ state: 'RESTORED_VERIFIED', backupId: receipt.backupId, rawRestored: 0, collectionResumeAllowed: false }));
  } finally { await db?.end(); client?.destroy(); await rm(directory, { recursive: true, force: true }); }
}
await main().catch(error => {
  console.error(/^(?:BACKUP|DRIVE)_[A-Z0-9_]+$/.test(error.message) ? error.message : 'BACKUP_RECOVERY_FAILED'); process.exitCode = 1;
});
