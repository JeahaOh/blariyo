import { createHash, randomUUID } from 'node:crypto';
import { open, readFile, rename, writeFile, lstat, chmod, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { fileDigest } from './backup-dump.mjs';
import { profileVersion, validateExcludedTables } from './selective-profile.mjs';

const origin = 'https://www.googleapis.com';
const chunkSize = 8 * 1024 * 1024;
const idPattern = /^[A-Za-z0-9_-]{1,200}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fields = 'id,parents,driveId,trashed,mimeType,size,appProperties,isAppAuthorized,capabilities(canAddChildren,canDelete,canDownload)';
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const failure = (code, transient = false, after = null) => Object.assign(Error(code), { transient, after });

export async function privateJson(path, value) {
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temp, path); await chmod(path, 0o600);
}

export function validateManifest(m, now = Date.now(), allowExpired = false) {
  const snapshot = Date.parse(m.snapshotAt), expires = Date.parse(m.expiresAt);
  if (m.format !== 2 || !uuidPattern.test(m.backupId) || !Number.isFinite(snapshot) || snapshot > now ||
      expires !== snapshot + 7 * 86400000 || (!allowExpired && now >= expires) || m.postgresMajor !== 18 ||
      m.dumpProfileVersion !== profileVersion || !/^[a-f0-9]{64}$/.test(m.sha256) ||
      !Number.isSafeInteger(m.bytes) || m.bytes < 1 || !/^[a-f0-9]{64}$/.test(m.apiLedgerHash) ||
      !/^[a-f0-9]{64}$/.test(m.collectorLedgerHash) || !/^[a-f0-9]{64}$/.test(m.recipientFingerprint))
    throw Error('BACKUP_MANIFEST_INVALID');
  validateExcludedTables(m.excludedTables);
  if (!m.tableFingerprints || typeof m.tableFingerprints !== 'object' || Array.isArray(m.tableFingerprints) ||
      !Object.keys(m.tableFingerprints).length || Object.entries(m.tableFingerprints).some(([table, value]) =>
        !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(table) || m.excludedTables.includes(table) ||
        !value || !/^[0-9]+$/.test(value.count) || !/^[a-f0-9]{64}$/.test(value.sha256))) throw Error('BACKUP_FINGERPRINT_INVALID');
  return m;
}

export class DriveStore {
  constructor({ auth, folderId, driveId, fetcher = fetch, now = Date.now,
    sleep = ms => new Promise(yes => setTimeout(yes, ms)), jitter = () => Math.floor(Math.random() * 1000) }) {
    if (!idPattern.test(folderId) || (driveId && !idPattern.test(driveId))) throw Error('DRIVE_FOLDER_INVALID');
    this.auth = auth; this.folderId = folderId; this.driveId = driveId;
    this.fetcher = fetcher; this.now = now; this.sleep = sleep; this.jitter = jitter;
    this.started = now(); this.retries = 0; this.refreshed = false;
  }

  url(path, params = {}) {
    const url = new URL(path, origin);
    if (url.origin !== origin || url.username || url.password || url.hash ||
        !/^\/(?:upload\/)?drive\/v3\//.test(url.pathname)) throw Error('DRIVE_URL_REJECTED');
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);
    return url;
  }

  async retry(error) {
    if (!error.transient) throw error;
    if (this.retries >= 6 || this.now() - this.started >= 30 * 60000) throw Error('DRIVE_RETRY_EXHAUSTED');
    const delay = error.after ?? (2 ** this.retries * 1000 + this.jitter());
    this.retries++;
    if (delay < 0 || this.now() + delay - this.started >= 30 * 60000) throw Error('DRIVE_RETRY_EXHAUSTED');
    await this.sleep(delay);
  }

  async request(path, options = {}, accepted = [200], retry = true) {
    const url = this.url(path);
    for (;;) {
      if (this.now() - this.started >= 30 * 60000) throw Error('DRIVE_RETRY_EXHAUSTED');
      let response;
      try {
        response = await this.fetcher(url, { ...options, headers: { ...options.headers,
          Authorization: 'Bearer ' + await this.auth.token() }, redirect: 'manual', signal: AbortSignal.timeout(60000) });
      } catch (error) {
        if (error.message?.startsWith('DRIVE_')) throw error;
        const problem = failure('DRIVE_NETWORK_FAILED', true);
        if (!retry) throw problem;
        await this.retry(problem); continue;
      }
      if (accepted.includes(response.status)) return response;
      if (response.status === 401 && !this.refreshed) {
        this.refreshed = true; await response.body?.cancel(); await this.auth.token(true); continue;
      }
      const data = await response.json().catch(() => ({}));
      const reason = data.error?.errors?.[0]?.reason;
      const transient = response.status === 429 || response.status >= 500 ||
        (response.status === 403 && ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason));
      const retryAfter = response.headers.get('retry-after');
      const after = retryAfter === null ? null : /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - this.now());
      const code = response.status === 401 ? 'DRIVE_REAUTH_REQUIRED' : reason === 'storageQuotaExceeded' ? 'DRIVE_STORAGE_FULL' :
        response.status === 403 ? (transient ? 'DRIVE_RATE_LIMIT' : 'DRIVE_PERMISSION_DENIED') : 'DRIVE_HTTP_' + response.status;
      const problem = failure(code, transient, Number.isFinite(after) ? after : null);
      if (!retry || !transient) throw problem;
      await this.retry(problem);
    }
  }

  async json(path, options, accepted) { return (await this.request(path, options, accepted)).json(); }
  async metadata(id) {
    if (!idPattern.test(id)) throw Error('DRIVE_FILE_ID_INVALID');
    const response = await this.request(this.url('/drive/v3/files/' + id, { fields, supportsAllDrives: 'true' }), {}, [200, 404]);
    return response.status === 404 ? null : response.json();
  }
  own(file, id, backupId, kind) {
    if (!file || file.id !== id || file.trashed || file.parents?.length !== 1 || file.parents[0] !== this.folderId ||
        (file.driveId || undefined) !== (this.driveId || undefined) || file.appProperties?.backupId !== backupId ||
        file.appProperties?.artifactKind !== kind || file.appProperties?.schemaVersion !== '2' ||
        file.mimeType === 'application/vnd.google-apps.folder' || file.mimeType?.startsWith('application/vnd.google-apps.'))
      throw Error('DRIVE_OWNERSHIP_CONFLICT');
  }
  async checkFolder() {
    const folder = await this.metadata(this.folderId);
    if (!folder || folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder' ||
        (folder.driveId || undefined) !== (this.driveId || undefined) || !folder.capabilities?.canAddChildren ||
        !folder.capabilities?.canDelete || (!this.driveId && !folder.isAppAuthorized)) throw Error('DRIVE_FOLDER_PERMISSION_REQUIRED');
    await this.checkPrivate(this.folderId);
  }
  async checkPrivate(id) {
    let pageToken;
    const seen = new Set();
    do {
      const page = await this.json(this.url('/drive/v3/files/' + id + '/permissions', {
        fields: 'nextPageToken,permissions(type)', supportsAllDrives: 'true', pageSize: '100', pageToken,
      }));
      if (!Array.isArray(page.permissions) || page.permissions.some(p => !['user', 'group'].includes(p.type)))
        throw Error('DRIVE_PUBLIC_ACCESS_REJECTED');
      pageToken = page.nextPageToken;
      if (pageToken && seen.has(pageToken)) throw Error('DRIVE_PAGINATION_LOOP');
      seen.add(pageToken);
    } while (pageToken);
  }
  async download(id, expected, limit = expected.bytes) {
    const response = await this.request(this.url('/drive/v3/files/' + id, { alt: 'media', supportsAllDrives: 'true' }));
    const hash = createHash('sha256'); let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length; if (bytes > limit) throw Error('DRIVE_DOWNLOAD_SIZE_MISMATCH'); hash.update(chunk);
    }
    if (bytes !== expected.bytes || hash.digest('hex') !== expected.sha256) throw Error('DRIVE_DOWNLOAD_HASH_MISMATCH');
  }

  async journal(directory, manifest) {
    const path = resolve(directory, 'drive-journal.json');
    let journal;
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077)) throw Error('DRIVE_JOURNAL_PERMISSIONS');
      journal = JSON.parse(await readFile(path, 'utf8'));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!journal) {
      const reserved = await this.json(this.url('/drive/v3/files/generateIds', { count: '2', space: 'drive', type: 'files' }));
      if (reserved.ids?.length !== 2 || new Set(reserved.ids).size !== 2 || !reserved.ids.every(id => idPattern.test(id)))
        throw Error('DRIVE_RESERVED_IDS_INVALID');
      journal = { backupId: manifest.backupId, folderId: this.folderId, driveId: this.driveId, identity: this.auth.identity,
        sha256: manifest.sha256, archive: { id: reserved.ids[0] }, manifest: { id: reserved.ids[1] } };
      await privateJson(path, journal);
    }
    if (journal.backupId !== manifest.backupId || journal.folderId !== this.folderId || journal.driveId !== this.driveId ||
        journal.identity !== this.auth.identity || journal.sha256 !== manifest.sha256 || !idPattern.test(journal.archive?.id) || !idPattern.test(journal.manifest?.id) ||
        journal.archive.id === journal.manifest.id) throw Error('DRIVE_JOURNAL_CONFLICT');
    return { journal, save: () => privateJson(path, journal) };
  }

  async uploadArtifact({ journal, save, kind, bytes, sha256, read }) {
    const artifact = journal[kind];
    const existing = await this.metadata(artifact.id);
    if (existing) {
      this.own(existing, artifact.id, journal.backupId, kind);
      await this.checkPrivate(artifact.id);
      await this.download(artifact.id, { bytes, sha256 }); return;
    }
    let offset = 0, query = Boolean(artifact.session);
    for (;;) {
      if (!artifact.session) {
        const response = await this.request(this.url('/upload/drive/v3/files', { uploadType: 'resumable', supportsAllDrives: 'true' }), {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Length': String(bytes),
            'X-Upload-Content-Type': kind === 'archive' ? 'application/octet-stream' : 'application/json' },
          body: JSON.stringify({ id: artifact.id, name: journal.backupId + (kind === 'archive' ? '.age' : '.json'),
            parents: [this.folderId], appProperties: { backupId: journal.backupId, artifactKind: kind, schemaVersion: '2' } }),
        }, [200, 201]);
        artifact.session = this.url(response.headers.get('location')).href;
        if (!new URL(artifact.session).pathname.startsWith('/upload/drive/v3/files')) throw Error('DRIVE_SESSION_INVALID');
        await save(); offset = 0; query = false;
      }
      let response;
      try {
        const body = query ? Buffer.alloc(0) : await read(offset, Math.min(chunkSize, bytes - offset));
        if (!query && body.length !== Math.min(chunkSize, bytes - offset)) throw Error('DRIVE_LOCAL_FILE_CHANGED');
        response = await this.request(artifact.session, { method: 'PUT',
          headers: { 'Content-Length': String(body.length), 'Content-Range': query ? 'bytes */' + bytes :
            `bytes ${offset}-${offset + body.length - 1}/${bytes}` }, body }, [200, 201, 308, 404], false);
      } catch (error) { await this.retry(error); query = true; continue; }
      if (response.status === 404) {
        const complete = await this.metadata(artifact.id);
        if (complete) { this.own(complete, artifact.id, journal.backupId, kind); break; }
        await this.retry(failure('DRIVE_SESSION_EXPIRED', true));
        delete artifact.session; await save(); continue;
      }
      if (response.status === 200 || response.status === 201) { await response.body?.cancel(); break; }
      const range = response.headers.get('range'); await response.body?.cancel();
      if (range !== null && !/^bytes=0-\d+$/.test(range)) throw Error('DRIVE_OFFSET_INVALID');
      const next = range ? Number(range.slice(8)) + 1 : 0;
      if (!Number.isSafeInteger(next) || next < offset || next > bytes) throw Error('DRIVE_OFFSET_INVALID');
      if (next === offset || next === bytes) {
        await this.retry(failure('DRIVE_UPLOAD_NOT_COMPLETE', true)); query = true;
      } else query = false;
      offset = next;
    }
    const complete = await this.metadata(artifact.id); this.own(complete, artifact.id, journal.backupId, kind);
    await this.checkPrivate(artifact.id);
    await this.download(artifact.id, { bytes, sha256 });
    delete artifact.session; artifact.verified = true; await save();
  }

  async upload({ directory, archivePath, manifest }) {
    validateManifest(manifest, this.now()); await this.checkFolder();
    const local = await fileDigest(archivePath);
    if (local.sha256 !== manifest.sha256 || local.bytes !== manifest.bytes) throw Error('DRIVE_LOCAL_HASH_MISMATCH');
    const state = await this.journal(directory, manifest);
    const handle = await open(archivePath, 'r');
    try {
      await this.uploadArtifact({ ...state, kind: 'archive', ...local, read: async (offset, length) => {
        const buffer = Buffer.alloc(length); const { bytesRead } = await handle.read(buffer, 0, length, offset);
        return buffer.subarray(0, bytesRead);
      } });
    } finally { await handle.close(); }
    const remoteManifest = { ...manifest, archiveFileId: state.journal.archive.id, manifestFileId: state.journal.manifest.id };
    const body = Buffer.from(JSON.stringify(remoteManifest) + '\n');
    await this.uploadArtifact({ ...state, kind: 'manifest', bytes: body.length, sha256: digest(body),
      read: async (offset, length) => body.subarray(offset, offset + length) });
    const receipt = { backupId: manifest.backupId, provider: 'drive', verifiedAt: new Date(this.now()).toISOString(),
      archiveFileId: remoteManifest.archiveFileId, manifestFileId: remoteManifest.manifestFileId,
      sha256: manifest.sha256, bytes: manifest.bytes, snapshotAt: manifest.snapshotAt, expiresAt: manifest.expiresAt };
    await privateJson(resolve(directory, 'upload-receipt.json'), receipt); return receipt;
  }

  async expire(manifest) {
    validateManifest(manifest, this.now(), true);
    if (this.now() < Date.parse(manifest.expiresAt)) return false;
    for (const [kind, id] of [['archive', manifest.archiveFileId], ['manifest', manifest.manifestFileId]]) {
      if (!idPattern.test(id)) throw Error('DRIVE_FILE_ID_INVALID');
      const file = await this.metadata(id); if (!file) continue;
      this.own(file, id, manifest.backupId, kind);
      if (!file.capabilities?.canDelete) throw Error('DRIVE_DELETE_PERMISSION_REQUIRED');
      await this.request(this.url('/drive/v3/files/' + id, { supportsAllDrives: 'true' }), { method: 'DELETE' }, [204, 404]);
      if (await this.metadata(id)) throw Error('DRIVE_DELETE_UNCONFIRMED');
    }
    return true;
  }

  async readManifest(id, allowExpired = false) {
    const metadata = await this.metadata(id);
    if (!metadata) throw Error('DRIVE_MANIFEST_MISSING');
    const response = await this.request(this.url('/drive/v3/files/' + id, { alt: 'media', supportsAllDrives: 'true' }));
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > 512 * 1024) throw Error('DRIVE_MANIFEST_SIZE'); chunks.push(chunk); }
    const manifest = validateManifest(JSON.parse(Buffer.concat(chunks)), this.now(), allowExpired);
    if (manifest.manifestFileId !== id || !idPattern.test(manifest.archiveFileId) || manifest.archiveFileId === id)
      throw Error('DRIVE_MANIFEST_RELATION_INVALID');
    this.own(metadata, id, manifest.backupId, 'manifest'); await this.checkPrivate(id); return manifest;
  }

  async retrieve({ manifestFileId, directory }) {
    // This always re-downloads both artifacts; upload cache and metadata checksum are never accepted as readback.
    const manifest = await this.readManifest(manifestFileId);
    this.own(await this.metadata(manifest.archiveFileId), manifest.archiveFileId, manifest.backupId, 'archive');
    await this.checkPrivate(manifest.archiveFileId);
    const archivePath = resolve(directory, 'restore.age');
    const output = await open(archivePath, 'wx', 0o600);
    try {
      const response = await this.request(this.url('/drive/v3/files/' + manifest.archiveFileId, { alt: 'media', supportsAllDrives: 'true' }));
      let size = 0;
      const bounded = async function* (source) { for await (const chunk of source) {
        size += chunk.length; if (size > manifest.bytes) throw Error('DRIVE_DOWNLOAD_SIZE_MISMATCH'); yield chunk;
      } };
      await pipeline(response.body, bounded, output.createWriteStream());
      const actual = await fileDigest(archivePath);
      if (actual.bytes !== manifest.bytes || actual.sha256 !== manifest.sha256) throw Error('DRIVE_DOWNLOAD_HASH_MISMATCH');
      return { archivePath, manifest };
    } catch (error) { await output.close(); await rm(archivePath, { force: true }); throw error; }
  }

  async inventory() {
    const manifests = [], seen = new Set(); let pageToken;
    do {
      const page = await this.json(this.url('/drive/v3/files', { q: `'${this.folderId}' in parents and trashed=false and appProperties has { key='artifactKind' and value='manifest' }`,
        fields: 'nextPageToken,files(id)', spaces: 'drive', pageSize: '100', pageToken, supportsAllDrives: 'true',
        includeItemsFromAllDrives: this.driveId ? 'true' : 'false', corpora: this.driveId ? 'drive' : 'user', driveId: this.driveId }));
      if (!Array.isArray(page.files)) throw Error('DRIVE_INVENTORY_INVALID');
      for (const file of page.files) manifests.push(await this.readManifest(file.id, true));
      pageToken = page.nextPageToken;
      if (pageToken && seen.has(pageToken)) throw Error('DRIVE_PAGINATION_LOOP'); seen.add(pageToken);
    } while (pageToken);
    return manifests;
  }
}
