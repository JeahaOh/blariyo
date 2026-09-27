import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm, open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { fileDigest } from './backup-dump.mjs';
import { privateJson, validateManifest } from './drive-store.mjs';
import { legacyManifest, legacyKeyPattern, validateReplacement } from './legacy-replacement.mjs';

const keyOf = id => 'db/selective/' + id + '.dump.age';
const notFound = e => e?.$metadata?.httpStatusCode === 404 || ['NoSuchKey', 'NotFound'].includes(e?.name);
const collision = e => e?.$metadata?.httpStatusCode === 412 || e?.name === 'PreconditionFailed';

/** Only the backup bucket is accepted; no media credential fallback. */
export class R2Store {
  constructor({ client, sdk, bucket, now = Date.now }) {
    if (bucket !== 'blariyo-backup') throw Error('BACKUP_R2_BUCKET_INVALID');
    this.client = client; this.sdk = sdk; this.bucket = bucket; this.now = now;
  }
  async send(command, args) {
    return this.client.send(new this.sdk[command]({ Bucket: this.bucket, ...args }), { abortSignal: AbortSignal.timeout(180000) });
  }
  async read(key, limit) {
    const response = await this.send('GetObjectCommand', { Key: key });
    const chunks = []; let bytes = 0;
    for await (const chunk of response.Body) {
      bytes += chunk.length; if (bytes > limit) throw Error('BACKUP_R2_READ_LIMIT'); chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async download(key, expected) {
    if (key !== keyOf(expected.backupId)) throw Error('BACKUP_R2_KEY_INVALID');
    const response = await this.send('GetObjectCommand', { Key: key }), hash = createHash('sha256'); let bytes = 0;
    for await (const chunk of response.Body) {
      bytes += chunk.length; if (bytes > expected.bytes) throw Error('BACKUP_R2_HASH_MISMATCH'); hash.update(chunk);
    }
    if (bytes !== expected.bytes || hash.digest('hex') !== expected.sha256) throw Error('BACKUP_R2_HASH_MISMATCH');
  }
  async put(key, body, manifest, kind, bytes) {
    try {
      await this.send('PutObjectCommand', { Key: key, Body: body, ContentLength: bytes, IfNoneMatch: '*',
        ContentType: kind === 'archive' ? 'application/octet-stream' : 'application/json',
        Metadata: { backupid: manifest.backupId, artifactkind: kind, snapshotat: manifest.snapshotAt,
          expiresat: manifest.expiresAt, profile: manifest.dumpProfileVersion } });
    } catch (error) { if (!collision(error)) throw Error('BACKUP_R2_UPLOAD_FAILED'); }
    finally { body.destroy?.(); }
  }
  async owned(key, manifest, kind) {
    let head;
    try { head = await this.send('HeadObjectCommand', { Key: key }); } catch (error) { if (notFound(error)) return false; throw Error('BACKUP_R2_HEAD_FAILED'); }
    const m = head.Metadata;
    if (m?.backupid !== manifest.backupId || m?.artifactkind !== kind || m?.snapshotat !== manifest.snapshotAt ||
        m?.expiresat !== manifest.expiresAt || m?.profile !== manifest.dumpProfileVersion) throw Error('BACKUP_R2_OWNERSHIP_CONFLICT');
    return true;
  }
  async upload({ directory, archivePath, manifest }) {
    validateManifest(manifest, this.now()); const local = await fileDigest(archivePath);
    if (local.sha256 !== manifest.sha256 || local.bytes !== manifest.bytes) throw Error('BACKUP_R2_LOCAL_HASH_MISMATCH');
    const key = keyOf(manifest.backupId);
    await this.put(key, createReadStream(archivePath), manifest, 'archive', manifest.bytes);
    await this.owned(key, manifest, 'archive'); await this.download(key, manifest);
    const body = Buffer.from(JSON.stringify({ ...manifest, key }) + '\n');
    await this.put(key + '.json', body, manifest, 'manifest', body.length);
    await this.owned(key + '.json', manifest, 'manifest');
    const remote = await this.read(key + '.json', 512 * 1024);
    if (!remote.equals(body)) throw Error('BACKUP_R2_MANIFEST_MISMATCH');
    const receipt = { backupId: manifest.backupId, provider: 'r2', verifiedAt: new Date(this.now()).toISOString(),
      key, sha256: manifest.sha256, bytes: manifest.bytes, snapshotAt: manifest.snapshotAt, expiresAt: manifest.expiresAt };
    await privateJson(resolve(directory, 'upload-receipt.json'), receipt); return receipt;
  }
  async expire(manifest) {
    validateManifest(manifest, this.now(), true);
    if (this.now() < Date.parse(manifest.expiresAt)) return false;
    for (const [kind, key] of [['archive', keyOf(manifest.backupId)], ['manifest', keyOf(manifest.backupId) + '.json']]) {
      if (!await this.owned(key, manifest, kind)) continue;
      await this.send('DeleteObjectCommand', { Key: key });
      if (await this.owned(key, manifest, kind)) throw Error('BACKUP_R2_DELETE_UNCONFIRMED');
    }
    return true;
  }
  async inventory() {
    const manifests = []; let token; const seen = new Set();
    do {
      const page = await this.send('ListObjectsV2Command', { Prefix: 'db/selective/', ContinuationToken: token });
      for (const object of page.Contents || []) {
        if (!/^db\/selective\/[a-f0-9-]{36}\.dump\.age\.json$/.test(object.Key)) continue;
        const manifest = validateManifest(JSON.parse(await this.read(object.Key, 512 * 1024)), this.now(), true);
        if (object.Key !== keyOf(manifest.backupId) + '.json' || manifest.key !== keyOf(manifest.backupId)) throw Error('BACKUP_R2_KEY_INVALID');
        await this.owned(object.Key, manifest, 'manifest'); manifests.push(manifest);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
      if ((page.IsTruncated && !token) || (token && seen.has(token))) throw Error('BACKUP_R2_PAGINATION_LOOP');
      seen.add(token);
    } while (token);
    return manifests;
  }
  async retrieve({ backupId, directory }) {
    if (!/^[a-f0-9-]{36}$/.test(backupId)) throw Error('BACKUP_R2_KEY_INVALID');
    const key = keyOf(backupId), manifest = validateManifest(JSON.parse(await this.read(key + '.json', 512 * 1024)), this.now());
    if (manifest.backupId !== backupId || manifest.key !== key) throw Error('BACKUP_R2_KEY_INVALID');
    await this.owned(key + '.json', manifest, 'manifest'); await this.owned(key, manifest, 'archive');
    const archivePath = resolve(directory, 'restore.age');
    const output = await open(archivePath, 'wx', 0o600);
    try {
      const response = await this.send('GetObjectCommand', { Key: key }); let size = 0;
      const bounded = async function* (source) { for await (const chunk of source) {
        size += chunk.length; if (size > manifest.bytes) throw Error('BACKUP_R2_HASH_MISMATCH'); yield chunk;
      } };
      await pipeline(response.Body, bounded, output.createWriteStream());
      const actual = await fileDigest(archivePath);
      if (actual.bytes !== manifest.bytes || actual.sha256 !== manifest.sha256) throw Error('BACKUP_R2_HASH_MISMATCH');
      return { archivePath, manifest };
    } catch (error) { await output.close(); await rm(archivePath, { force: true }); throw error; }
  }
  async retrieveLegacy({ key, directory }) {
    if (!legacyKeyPattern.test(key)) throw Error('BACKUP_LEGACY_KEY_MISMATCH');
    const manifest = legacyManifest(JSON.parse(await this.read(key + '.json', 512 * 1024)), this.now());
    if (manifest.key !== key) throw Error('BACKUP_LEGACY_KEY_MISMATCH');
    const archivePath = resolve(directory, 'full.age'), output = await open(archivePath, 'wx', 0o600);
    try {
      const response = await this.send('GetObjectCommand', { Key: key }); let size = 0;
      const bounded = async function* (source) { for await (const chunk of source) {
        size += chunk.length; if (size > manifest.bytes) throw Error('BACKUP_LEGACY_HASH_MISMATCH'); yield chunk;
      } };
      await pipeline(response.Body, bounded, output.createWriteStream());
      const actual = await fileDigest(archivePath);
      if (actual.bytes !== manifest.bytes || actual.sha256 !== manifest.sha256) throw Error('BACKUP_LEGACY_HASH_MISMATCH');
      return { archivePath, manifest };
    } catch (error) { await output.close(); await rm(archivePath, { force: true }); throw error; }
  }
  async legacyInventory() {
    const result = []; let token; const seen = new Set();
    do {
      const page = await this.send('ListObjectsV2Command', { Prefix: 'db/daily/', ContinuationToken: token });
      for (const object of page.Contents || []) {
        if (!object.Key.endsWith('.json') || !legacyKeyPattern.test(object.Key.slice(0, -5))) continue;
        const manifest = legacyManifest(JSON.parse(await this.read(object.Key, 512 * 1024)), this.now(), true);
        if (manifest.key + '.json' !== object.Key) throw Error('BACKUP_LEGACY_KEY_MISMATCH'); result.push(manifest);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
      if ((page.IsTruncated && !token) || (token && seen.has(token))) throw Error('BACKUP_R2_PAGINATION_LOOP'); seen.add(token);
    } while (token);
    return result;
  }
  async removeLegacy(original, receipt) {
    const expected = legacyManifest(original, this.now(), true);
    if (this.now() < Date.parse(expected.expiresAt)) validateReplacement(receipt, expected);
    let current;
    try { current = legacyManifest(JSON.parse(await this.read(expected.key + '.json', 512 * 1024)), this.now(), true); }
    catch (error) { if (notFound(error)) return false; throw error; }
    if (current.key !== expected.key || current.sha256 !== expected.sha256 || current.bytes !== expected.bytes || current.snapshotAt !== expected.snapshotAt)
      throw Error('BACKUP_LEGACY_SNAPSHOT_CHANGED');
    // The manifest is deleted last; a partial archive delete remains discoverable on the next hourly pass.
    for (const key of [expected.key, expected.key + '.json']) {
      await this.send('DeleteObjectCommand', { Key: key });
      try { await this.send('HeadObjectCommand', { Key: key }); throw Error('BACKUP_LEGACY_DELETE_UNCONFIRMED'); }
      catch (error) { if (!notFound(error)) throw error; }
    }
    return true;
  }
}
