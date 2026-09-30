import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, rename, writeFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { classifyCollect, profileVersion } from './selective-profile.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const identifier = value => {
  if (!/^[a-z][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(value)) throw Error('BACKUP_TABLE_ID_INVALID');
  return value.split('.').map(v => '"' + v + '"').join('.');
};
export async function fileDigest(path) {
  const digest = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path)) { digest.update(chunk); bytes += chunk.length; }
  return { sha256: digest.digest('hex'), bytes };
}
function exit(child, code) {
  // Never report raw stderr: pg_dump/age can quote connection details or input paths.
  child.stderr.resume();
  return new Promise((yes, no) => {
    child.once('error', () => no(Error(code)));
    child.once('close', status => status === 0 ? yes() : no(Error(code)));
  });
}
export async function snapshotMetadata(db) {
  const tables = (await db.query(`SELECT schemaname||'.'||tablename AS name FROM pg_catalog.pg_tables
    WHERE schemaname IN ('content','legal','ops','collect','collector','batch','quartz') ORDER BY 1`)).rows.map(r => r.name);
  const excludedTables = classifyCollect(tables.filter(t => t.startsWith('collect.')));
  if (!tables.includes('collect.batch_dedup_key') || !tables.includes('content.post_collection_origin'))
    throw Error('BACKUP_RETENTION_SCHEMA_REQUIRED');
  const fingerprints = {};
  for (const table of tables.filter(t => !excludedTables.includes(t))) {
    const { rows } = await db.query(`SELECT count(*)::text AS count,
      encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS sha256
      FROM ${identifier(table)} t`);
    fingerprints[table] = rows[0];
  }
  const api = (await db.query('SELECT version,filename,encode(checksum_sha256,\'hex\') checksum FROM ops.schema_migration ORDER BY version')).rows;
  const collector = (await db.query('SELECT version,checksum FROM collector.schema_migration ORDER BY version')).rows;
  return { excludedTables, tables, fingerprints, apiLedgerHash: hash(JSON.stringify(api)), collectorLedgerHash: hash(JSON.stringify(collector)) };
}

/** db is a dedicated connected pg Client. dump(command) must attach stdout/stderr pipes. */
export async function encryptedSnapshot({ db, dump, ageExecutable, recipient, spoolRoot, snapshotAt }) {
  if (!/^age1[0-9a-z]{50,100}$/.test(recipient)) throw Error('BACKUP_RECIPIENT_INVALID');
  const backupId = randomUUID(), directory = resolve(spoolRoot, backupId);
  await mkdir(directory, { recursive: false, mode: 0o700 });
  const archivePath = resolve(directory, 'archive.age');
  let dumping, encrypting, committed = false;
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const version = Number((await db.query("SELECT current_setting('server_version_num') version")).rows[0].version);
    if (Math.floor(version / 10000) !== 18) throw Error('BACKUP_POSTGRES_18_REQUIRED');
    const snapshot = (await db.query('SELECT pg_export_snapshot() id, clock_timestamp() at')).rows[0];
    const created = snapshotAt ? new Date(snapshotAt) : snapshot.at;
    // Original snapshotAt is preserved only for explicit replacement of an older full backup.
    if (!Number.isFinite(created.getTime()) || created > snapshot.at || snapshot.at - created >= 7 * 86400000)
      throw Error('BACKUP_SNAPSHOT_TIME_INVALID');
    const metadata = await snapshotMetadata(db);
    const args = ['--format=custom', '--no-owner', '--no-acl', '--snapshot=' + snapshot.id,
      ...metadata.excludedTables.map(t => '--exclude-table-data=' + t)];
    dumping = dump(args);
    encrypting = spawn(ageExecutable, ['--encrypt', '--recipient', recipient], { stdio: ['pipe', 'pipe', 'pipe'] });
    const digest = createHash('sha256'); let bytes = 0;
    const counter = new Transform({ transform(chunk, encoding, next) { digest.update(chunk); bytes += chunk.length; next(null, chunk); } });
    const timeout = setTimeout(() => { dumping.kill('SIGKILL'); encrypting.kill('SIGKILL'); }, 30 * 60000);
    try {
      await Promise.all([
        exit(dumping, 'BACKUP_DUMP_FAILED'), exit(encrypting, 'BACKUP_ENCRYPT_FAILED'),
        pipeline(dumping.stdout, encrypting.stdin),
        pipeline(encrypting.stdout, counter, createWriteStream(archivePath + '.partial', { flags: 'wx', mode: 0o600 })),
      ]);
    } finally { clearTimeout(timeout); }
    if (bytes < 1) throw Error('BACKUP_ARCHIVE_EMPTY');
    await rename(archivePath + '.partial', archivePath);
    await db.query('COMMIT'); committed = true;
    const manifest = {
      format: 2, backupId, snapshotAt: created.toISOString(), expiresAt: new Date(created.getTime() + 7 * 86400000).toISOString(),
      postgresMajor: 18, dumpProfileVersion: profileVersion, excludedTables: metadata.excludedTables,
      apiLedgerHash: metadata.apiLedgerHash, collectorLedgerHash: metadata.collectorLedgerHash,
      tableFingerprints: metadata.fingerprints,
      recipientFingerprint: hash(recipient), sha256: digest.digest('hex'), bytes,
    };
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await writeFile(resolve(directory, 'snapshot-receipt.json'), JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { directory, archivePath, manifest, metadata };
  } catch (error) {
    dumping?.kill('SIGKILL'); encrypting?.kill('SIGKILL');
    if (!committed) await db.query('ROLLBACK').catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function expireLocalSpool(root, now = new Date()) {
  const { readdir, lstat, readFile } = await import('node:fs/promises');
  const removed = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue;
    const directory = resolve(root, entry.name), info = await lstat(directory);
    if (info.isSymbolicLink()) continue;
    let deadline = info.birthtimeMs + 86400000;
    try {
      const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
      const snapshot = Date.parse(manifest.snapshotAt), expires = Date.parse(manifest.expiresAt);
      if (manifest.backupId !== entry.name || !Number.isFinite(snapshot) || expires !== snapshot + 7 * 86400000)
        throw Error('BACKUP_LOCAL_MANIFEST_INVALID');
      const uploaded = await stat(resolve(directory, 'upload-receipt.json')).then(() => true, () => false);
      deadline = uploaded ? expires : Math.min(expires, snapshot + 86400000);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (now.getTime() >= deadline) { await rm(directory, { recursive: true }); removed.push(entry.name); }
  }
  return removed;
}
