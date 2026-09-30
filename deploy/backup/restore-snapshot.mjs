import { spawn } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileDigest, snapshotMetadata } from './backup-dump.mjs';
import { validateManifest } from './drive-store.mjs';

function finished(child, code) {
  child.stderr.resume();
  return new Promise((yes, no) => { child.once('error', () => no(Error(code))); child.once('close', status => status === 0 ? yes() : no(Error(code))); });
}

/** Called only on an explicitly isolated, empty PostgreSQL18 database with no writers/fetchers. */
export async function decryptIntoEmpty({ db, restore, archivePath, manifest, ageExecutable, identityPath, isolated }) {
  if (isolated !== true) throw Error('BACKUP_ISOLATED_RESTORE_REQUIRED');
  const identity = await lstat(identityPath);
  if (!identity.isFile() || identity.isSymbolicLink() || (identity.mode & 0o077)) throw Error('BACKUP_IDENTITY_PERMISSIONS');
  const environment = (await db.query("SELECT current_setting('server_version_num')::int AS version, current_database() AS name")).rows[0];
  const occupied = (await db.query("SELECT count(*)::int AS n FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")).rows[0].n;
  if (Math.floor(environment.version / 10000) !== 18 || occupied !== 0 || !/^(?:restore|backup)_[a-z0-9_]+$/.test(environment.name))
    throw Error('BACKUP_RESTORE_TARGET_REJECTED');
  const actual = await fileDigest(archivePath);
  if (actual.bytes !== manifest.bytes || actual.sha256 !== manifest.sha256) throw Error('BACKUP_RESTORE_ARCHIVE_MISMATCH');
  const decrypt = spawn(ageExecutable, ['--decrypt', '--identity', identityPath, archivePath], { stdio: ['ignore', 'pipe', 'pipe'] });
  const target = restore(['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl']);
  const timeout = setTimeout(() => { decrypt.kill('SIGKILL'); target.kill('SIGKILL'); }, 30 * 60000);
  try { await Promise.all([finished(decrypt, 'BACKUP_DECRYPT_FAILED'), finished(target, 'BACKUP_RESTORE_FAILED'), pipeline(decrypt.stdout, target.stdin)]); }
  catch (error) { decrypt.kill('SIGKILL'); target.kill('SIGKILL'); throw error; }
  finally { clearTimeout(timeout); }
}

export async function restoreSnapshot(options) {
  const { db, manifest, now = Date.now } = options;
  validateManifest(manifest, now());
  await decryptIntoEmpty(options);
  const metadata = await snapshotMetadata(db);
  if (metadata.apiLedgerHash !== manifest.apiLedgerHash || metadata.collectorLedgerHash !== manifest.collectorLedgerHash ||
      !isDeepStrictEqual(metadata.excludedTables, manifest.excludedTables) || !isDeepStrictEqual(metadata.fingerprints, manifest.tableFingerprints))
    throw Error('BACKUP_RESTORE_FINGERPRINT_MISMATCH');
  for (const table of manifest.excludedTables) {
    // Exact identifiers were validated by the closed classification profile.
    if (Number((await db.query('SELECT count(*) AS n FROM ' + table)).rows[0].n) !== 0) throw Error('BACKUP_RAW_RESTORED');
  }
  // Re-enabling this gate requires the subsequent quiesced D01 orphan/object inventory receipt.
  await db.query('UPDATE collect.batch_retention_control SET selective_backup_verified=false,backup_receipt_hash=NULL');
  await db.query('UPDATE collector.restore_gate SET reconcile_required=true');
  // A snapshot may predate requests already sent today. Do not reuse that lost quota.
  const directGate = (await db.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='collector' AND table_name='restore_gate' AND column_name='direct_resume_not_before') AS present")).rows[0].present;
  if (directGate) await db.query("UPDATE collector.restore_gate SET direct_resume_not_before=((clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date+1)::timestamp AT TIME ZONE 'Asia/Seoul'");
  return { kind: 'OPS03_SELECTIVE_RESTORE', backupId: manifest.backupId, restoredAt: new Date(now()).toISOString(),
    snapshotAt: manifest.snapshotAt, expiresAt: manifest.expiresAt, postgresMajor: 18, dumpProfileVersion: manifest.dumpProfileVersion,
    archiveSha256: manifest.sha256, rawRestored: 0, fingerprintsMatched: true, apiLedgerHash: metadata.apiLedgerHash,
    collectorLedgerHash: metadata.collectorLedgerHash, collectionResumeAllowed: false, retentionGate: 'CLOSED' };
}
