import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expireLocalSpool } from './backup-dump.mjs';
import { privateJson, validateManifest } from './drive-store.mjs';

const safeCode = error => /^(?:BACKUP|DRIVE|ALERT)_[A-Z0-9_]{1,70}$/.test(error?.message) ? error.message : 'BACKUP_DEPENDENCY_FAILED';

export function validateTransition(receipt, now) {
  const successes = receipt?.scheduledDriveSuccesses;
  const acceptedAt = Date.parse(receipt?.acceptedAt);
  if (receipt?.kind !== 'OPS03_DRIVE_ACCEPTANCE' || receipt?.environment !== 'production' || receipt?.ownerAccepted !== true ||
      receipt?.fullSnapshotsReplaced !== true || !/^[a-f0-9]{64}$/.test(receipt?.fullReplacementReceiptSha256) ||
      !/^[a-f0-9]{64}$/.test(receipt?.restoreReceiptSha256) || !Number.isFinite(Date.parse(receipt?.restoredAt)) ||
      !Number.isFinite(acceptedAt) || acceptedAt > now || Date.parse(receipt.restoredAt) > acceptedAt ||
      acceptedAt - Date.parse(receipt.restoredAt) >= 18 * 3600000 ||
      !Array.isArray(successes) || successes.length !== 2 || successes.some(r => r.provider !== 'drive' || r.scheduled !== true ||
        !/^[a-f0-9-]{36}$/.test(r.backupId) || !Number.isFinite(Date.parse(r.snapshotAt)) || !Number.isFinite(Date.parse(r.expiresAt)) || Date.parse(r.expiresAt) <= acceptedAt ||
        Date.parse(r.snapshotAt) > acceptedAt || !/^[a-f0-9]{64}$/.test(r.receiptSha256)) ||
      successes[0].backupId === successes[1].backupId || Date.parse(successes[1].snapshotAt) - Date.parse(successes[0].snapshotAt) < 11 * 3600000)
    throw Error('BACKUP_DRIVE_TRANSITION_NOT_ACCEPTED');
  return true;
}

/** The outer runner holds the same OS lock for scheduled, manual, expiry and retry jobs. */
export class BackupJobs {
  constructor({ root, snapshot, r2, drive, incidents, mode = 'r2', transition, now = Date.now }) {
    if (!['r2', 'dual', 'drive'].includes(mode) || !r2 || (mode !== 'r2' && !drive)) throw Error('BACKUP_MODE_INVALID');
    if (mode === 'drive') validateTransition(transition, now());
    this.root = root; this.snapshot = snapshot; this.r2 = r2; this.drive = drive;
    this.incidents = incidents; this.mode = mode; this.now = now;
  }
  async catalog() {
    try {
      const value = JSON.parse(await readFile(resolve(this.root, 'catalog.json'), 'utf8'));
      if (!Array.isArray(value.backups)) throw Error('BACKUP_CATALOG_INVALID');
      return value;
    } catch (error) { if (error.code === 'ENOENT') return { backups: [], lastSuccessAt: null }; throw error; }
  }
  save(catalog) { return privateJson(resolve(this.root, 'catalog.json'), catalog); }
  async report(stage, errorCode, backupId, catalog) {
    try { await this.incidents?.observe({ job: 'DB_BACKUP', stage, errorCode, backupId, lastSuccessAt: catalog.lastSuccessAt }); }
    catch { /* Backup result does not change when persisting/sending a notification fails. */
      catalog.notificationError = 'ALERT_STATE_FAILED'; await this.save(catalog);
    }
  }
  async transfer(input, catalog, entry) {
    validateManifest(input.manifest, this.now());
    let r2Error, driveError;
    if (this.drive && this.mode !== 'r2' && !entry.driveManifest) {
      try {
        const { journal } = await this.drive.journal(input.directory, input.manifest);
        entry.driveManifest = { ...input.manifest, archiveFileId: journal.archive.id, manifestFileId: journal.manifest.id };
        await this.save(catalog); // File IDs survive a failed process and the 24-hour local-spool expiry.
      } catch (error) { driveError = safeCode(error); await this.report('DRIVE_UPLOAD', driveError, input.manifest.backupId, catalog); }
    }
    if (this.mode !== 'drive' && !entry.r2Receipt) {
      try { entry.r2Receipt = await this.r2.upload(input); await this.report('R2_UPLOAD', null, input.manifest.backupId, catalog); }
      catch (error) { r2Error = safeCode(error); await this.report('R2_UPLOAD', r2Error, input.manifest.backupId, catalog); }
      await this.save(catalog);
    }
    if (this.mode !== 'r2' && !entry.driveReceipt && !driveError) {
      try { entry.driveReceipt = await this.drive.upload(input); await this.report('DRIVE_UPLOAD', null, input.manifest.backupId, catalog); }
      catch (error) { driveError = safeCode(error); await this.report('DRIVE_UPLOAD', driveError, input.manifest.backupId, catalog); }
      await this.save(catalog);
    }
    if (this.mode === 'drive' && driveError && !entry.r2Receipt) {
      try { entry.r2Receipt = await this.r2.upload(input); }
      catch (error) { r2Error = safeCode(error); await this.report('R2_FALLBACK', r2Error, input.manifest.backupId, catalog); }
    }
    entry.lastAttemptAt = new Date(this.now()).toISOString(); entry.r2Error = r2Error; entry.driveError = driveError;
    entry.status = entry.r2Receipt || entry.driveReceipt ? 'VERIFIED' : 'FAILED';
    if (entry.status === 'VERIFIED') {
      // RPO is measured from the snapshot, never from a late retransmission.
      if (!catalog.lastSuccessAt || Date.parse(input.manifest.snapshotAt) > Date.parse(catalog.lastSuccessAt)) catalog.lastSuccessAt = input.manifest.snapshotAt;
      await this.report('DUMP', null, input.manifest.backupId, catalog);
    }
    await this.save(catalog);
    return { backupId: input.manifest.backupId, status: entry.status, r2: Boolean(entry.r2Receipt), drive: Boolean(entry.driveReceipt),
      fallback: this.mode === 'drive' && Boolean(entry.r2Receipt) && !entry.driveReceipt };
  }
  async backup({ scheduled = false } = {}) {
    const catalog = await this.catalog(); let input;
    try { input = await this.snapshot(); }
    catch (error) { await this.report('DUMP', safeCode(error), undefined, catalog); throw Error(safeCode(error)); }
    const entry = { manifest: input.manifest, scheduled, status: 'PENDING' }; catalog.backups.push(entry); await this.save(catalog);
    const result = await this.transfer(input, catalog, entry);
    if (result.status !== 'VERIFIED') throw Error('BACKUP_ALL_PROVIDERS_FAILED');
    return result;
  }
  async maintain() {
    const catalog = await this.catalog(), failures = [];
    if (this.r2.legacyInventory) {
      try {
        const legacy = await this.r2.legacyInventory();
        catalog.unreplacedFullSnapshots = legacy.filter(m => Date.parse(m.expiresAt) > this.now()).map(m => ({ key: m.key, sha256: m.sha256, expiresAt: m.expiresAt }));
        for (const manifest of legacy) if (Date.parse(manifest.expiresAt) <= this.now()) await this.r2.removeLegacy(manifest);
      } catch (error) { failures.push({ stage: 'LEGACY_EXPIRY', code: safeCode(error) }); }
    }
    // Remote manifests rebuild complete entries even if the local catalog was lost. Partial IDs are retained in catalog until deleted.
    for (const [name, store] of [['r2', this.r2], ['drive', this.drive]]) {
      if (!store) continue;
      try {
        for (const manifest of await store.inventory()) {
          let entry = catalog.backups.find(e => e.manifest.backupId === manifest.backupId);
          if (!entry) { entry = { manifest, status: 'DISCOVERED' }; catalog.backups.push(entry); }
          if (name === 'drive') entry.driveManifest = manifest;
        }
      } catch (error) { failures.push({ stage: name.toUpperCase() + '_INVENTORY', code: safeCode(error) }); }
    }
    await this.save(catalog);
    for (const entry of catalog.backups) {
      const m = validateManifest(entry.manifest, this.now(), true);
      if (Date.parse(m.expiresAt) <= this.now()) {
        for (const [name, store, manifest] of [['r2', this.r2, m], ['drive', this.drive, entry.driveManifest]]) {
          if (!store || !manifest || entry[name + 'Deleted']) continue;
          try { await store.expire(manifest); entry[name + 'Deleted'] = true; }
          catch (error) { failures.push({ stage: name.toUpperCase() + '_EXPIRY', code: safeCode(error), backupId: m.backupId }); }
        }
        await this.save(catalog);
      } else if (this.now() - Date.parse(m.snapshotAt) < 86400000 && (!entry.r2Receipt || (this.drive && !entry.driveReceipt))) {
        const directory = resolve(this.root, 'spool', m.backupId);
        const exists = await lstat(directory).then(s => s.isDirectory() && !s.isSymbolicLink(), () => false);
        if (exists) {
          try { await this.transfer({ directory, archivePath: resolve(directory, 'archive.age'), manifest: m }, catalog, entry); }
          catch (error) { failures.push({ stage: 'UPLOAD_RETRY', code: safeCode(error), backupId: m.backupId }); }
        }
      }
    }
    try { await expireLocalSpool(resolve(this.root, 'spool'), new Date(this.now())); }
    catch (error) { failures.push({ stage: 'LOCAL_EXPIRY', code: safeCode(error) }); }
    for (const f of failures) await this.report(f.stage, f.code, f.backupId, catalog);
    for (const stage of ['R2_INVENTORY', 'DRIVE_INVENTORY', 'R2_EXPIRY', 'DRIVE_EXPIRY', 'UPLOAD_RETRY', 'LOCAL_EXPIRY', 'LEGACY_EXPIRY']) {
      if (!failures.some(f => f.stage === stage)) await this.report(stage, null, undefined, catalog);
    }
    await this.report('FRESHNESS', !catalog.lastSuccessAt || this.now() - Date.parse(catalog.lastSuccessAt) > 18 * 3600000 ? 'BACKUP_LAST_SUCCESS_OVER_18H' : null, undefined, catalog);
    try { await this.incidents?.flush(); } catch { catalog.notificationError = 'ALERT_STATE_FAILED'; await this.save(catalog); }
    return { failures, latestSnapshotAt: catalog.lastSuccessAt };
  }
}
