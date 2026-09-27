import { readFile, lstat, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encryptedSnapshot, fileDigest } from './backup-dump.mjs';
import { decryptIntoEmpty, restoreSnapshot } from './restore-snapshot.mjs';
import { privateJson } from './drive-store.mjs';

export const legacyKeyPattern = /^db\/daily\/(\d{8}T\d{6}Z)-[a-f0-9]{12}\.dump\.age$/;
export function legacyManifest(value, now = Date.now(), allowExpired = false) {
  const at = Date.parse(value.createdAt), match = legacyKeyPattern.exec(value.key);
  if (value.format !== 1 || !Number.isFinite(at) || at > now || !match ||
      new Date(at).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z') !== match[1] ||
      (!allowExpired && now >= at + 7 * 86400000) || value.postgresMajor !== 18 || value.retentionDays !== 7 ||
      !/^[a-f0-9]{64}$/.test(value.sha256) || !Number.isSafeInteger(value.bytes) || value.bytes < 1)
    throw Error('BACKUP_LEGACY_MANIFEST_INVALID');
  return { ...value, snapshotAt: new Date(at).toISOString(), expiresAt: new Date(at + 7 * 86400000).toISOString() };
}

export function validateReplacement(receipt, original) {
  if (receipt?.kind !== 'OPS03_FULL_REPLACEMENT' || receipt?.originalKey !== original.key || receipt?.originalSha256 !== original.sha256 ||
      receipt?.snapshotAt !== original.snapshotAt || receipt?.expiresAt !== original.expiresAt || receipt?.provider !== 'r2' ||
      receipt?.rawRestored !== 0 || receipt?.fingerprintsMatched !== true || !/^[a-f0-9]{64}$/.test(receipt?.replacementSha256))
    throw Error('BACKUP_LEGACY_REPLACEMENT_UNVERIFIED');
}

/** Both source and verification DBs must be isolated and empty. Migration callback targets source only. */
export async function replaceLegacySnapshot({ original, archivePath, source, verification, migrate, snapshot, provider, downloadDirectory, now = Date.now }) {
  const legacy = legacyManifest(original, now());
  await decryptIntoEmpty({ ...source, archivePath, manifest: legacy });
  await migrate();
  const replacement = await encryptedSnapshot({ ...snapshot, db: source.db, snapshotAt: legacy.snapshotAt });
  replacement.manifest.replacesLegacyKey = legacy.key;
  replacement.manifest.replacesLegacySha256 = legacy.sha256;
  await privateJson(resolve(replacement.directory, 'manifest.json'), replacement.manifest);
  await provider.upload(replacement);
  const downloaded = await provider.retrieve({ backupId: replacement.manifest.backupId, directory: downloadDirectory });
  if (downloaded.manifest.snapshotAt !== legacy.snapshotAt || downloaded.manifest.expiresAt !== legacy.expiresAt)
    throw Error('BACKUP_REPLACEMENT_DEADLINE_CHANGED');
  const verified = await restoreSnapshot({ ...verification, ...downloaded, now });
  const receipt = { kind: 'OPS03_FULL_REPLACEMENT', originalKey: legacy.key, originalSha256: legacy.sha256,
    backupId: replacement.manifest.backupId, replacementSha256: replacement.manifest.sha256, snapshotAt: legacy.snapshotAt,
    expiresAt: legacy.expiresAt, provider: 'r2', restoredAt: verified.restoredAt, rawRestored: verified.rawRestored,
    fingerprintsMatched: verified.fingerprintsMatched };
  await privateJson(resolve(replacement.directory, 'replacement-receipt.json'), receipt);
  await provider.removeLegacy(legacy, receipt);
  return receipt;
}

/** Local old spools are removed only by exact known filename, matching manifest and archive hash. */
export async function removeLegacySpool(directory, receipt, now = Date.now()) {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error('BACKUP_LEGACY_SPOOL_INVALID');
  const manifest = legacyManifest(JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')), now, true);
  if (resolve(directory).split('/').at(-1) !== manifest.key.slice('db/daily/'.length, -'.dump.age'.length)) throw Error('BACKUP_LEGACY_SPOOL_INVALID');
  if (now < Date.parse(manifest.expiresAt)) validateReplacement(receipt, manifest);
  const actual = await fileDigest(resolve(directory, 'archive.age'));
  if (actual.sha256 !== manifest.sha256 || actual.bytes !== manifest.bytes) throw Error('BACKUP_LEGACY_SPOOL_MISMATCH');
  await rm(directory, { recursive: true });
}
