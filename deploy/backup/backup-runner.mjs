import { readFile, lstat, mkdir } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import * as sdk from '@aws-sdk/client-s3';
import { encryptedSnapshot } from './backup-dump.mjs';
import { DriveAuth } from './drive-auth.mjs';
import { DriveStore } from './drive-store.mjs';
import { R2Store } from './r2-store.mjs';
import { Incidents } from './incidents.mjs';
import { BackupJobs } from './backup-jobs.mjs';

const execute = promisify(execFile);
async function secret(path, json = true) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077)) throw Error('BACKUP_SECRET_PERMISSIONS');
  const value = await readFile(path, 'utf8'); return json ? JSON.parse(value) : value.trim();
}
async function main() {
  process.umask(0o077);
  const command = process.argv[2];
  if (!['backup', 'scheduled', 'maintain', 'alerts', 'check'].includes(command)) throw Error('BACKUP_COMMAND_INVALID');
  const versions = await Promise.all([execute('pg_dump', ['--version']), execute('age', ['--version'])]);
  if (process.versions.node !== '24.18.0' || !/^pg_dump \(PostgreSQL\) 18\./.test(versions[0].stdout) || versions[1].stdout.trim() !== 'v1.3.2')
    throw Error('BACKUP_RUNTIME_VERSION_INVALID');
  if (command === 'check') { console.log(JSON.stringify({ node: '24.18.0', postgresMajor: 18, age: '1.3.2', externalRequests: 0 })); return; }
  const root = '/state', config = await secret('/run/backup/config.json');
  await mkdir(root + '/spool', { recursive: true, mode: 0o700 });
  let webhook;
  try { webhook = await secret('/run/backup/discord-webhook', false); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const incidents = new Incidents({ path: root + '/incidents.json', webhook });
  if (command === 'alerts') { console.log(JSON.stringify(await incidents.flush())); return; }
  const r2Config = await secret('/run/backup/r2.json');
  const endpoint = new URL(r2Config.endpoint);
  if (endpoint.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.search)
    throw Error('BACKUP_R2_ENDPOINT_INVALID');
  const client = new sdk.S3Client({ region: 'auto', endpoint: endpoint.href,
    credentials: { accessKeyId: r2Config.accessKeyId, secretAccessKey: r2Config.secretAccessKey }, maxAttempts: 3 });
  try {
    const r2 = new R2Store({ client, sdk, bucket: r2Config.bucket }); let drive;
    // Keep Drive credentials in R2 mode to expire old Drive copies after fallback.
    try {
      const c = await secret('/run/backup/drive.json');
      drive = new DriveStore({ auth: new DriveAuth(c), folderId: c.folderId, driveId: c.driveId });
    } catch (error) {
      if (error.code !== 'ENOENT' || config.mode !== 'r2') {
        // Invalid/withdrawn Drive credentials must not disable the valid R2 backup path.
        const unavailable = async () => { throw Error('DRIVE_CONFIG_UNAVAILABLE'); };
        drive = { journal: unavailable, upload: unavailable, inventory: unavailable, expire: unavailable };
      }
    }
    const snapshot = async () => {
      const c = config.database;
      if (!c || c.user !== 'blariyo_backup' || typeof c.host !== 'string' || !c.host || !Number.isInteger(c.port) || c.port < 1 || c.port > 65535 ||
          !/^[a-z][a-z0-9_]*$/.test(c.database)) throw Error('BACKUP_DATABASE_CONFIG_INVALID');
      const password = await secret('/run/backup/db-password', false);
      const db = new pg.Client({ ...c, password, application_name: 'blariyo-selective-backup', connectionTimeoutMillis: 30000 });
      await db.connect();
      try {
        const recipient = await secret('/run/backup/recipient.txt', false);
        const dump = args => spawn('pg_dump', args, { stdio: ['ignore', 'pipe', 'pipe'], env: {
          ...process.env, PGHOST: c.host, PGPORT: String(c.port), PGUSER: c.user, PGDATABASE: c.database, PGPASSWORD: password,
        } });
        return await encryptedSnapshot({ db, dump, ageExecutable: 'age', recipient, spoolRoot: root + '/spool' });
      } finally { await db.end(); }
    };
    let transition;
    if (config.mode === 'drive') transition = await secret('/run/backup/transition.json');
    const jobs = new BackupJobs({ root, snapshot, r2, drive, incidents, mode: config.mode, transition });
    const maintenance = await jobs.maintain();
    if (command === 'backup' || command === 'scheduled') console.log(JSON.stringify(await jobs.backup({ scheduled: command === 'scheduled' })));
    console.log(JSON.stringify({ maintenanceFailures: maintenance.failures.length, latestSnapshotAt: maintenance.latestSnapshotAt }));
    if (maintenance.failures.length) process.exitCode = 1;
  } finally { client.destroy(); }
}
await main().catch(error => {
  console.error(/^(?:BACKUP|DRIVE|ALERT)_[A-Z0-9_]+$/.test(error.message) ? error.message : 'BACKUP_RUNTIME_FAILED'); process.exitCode = 1;
});
