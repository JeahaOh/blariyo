import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { BackupJobs, validateTransition } from './backup-jobs.mjs';
import { R2Store } from './r2-store.mjs';
import { Incidents } from './incidents.mjs';
import { profileVersion, requiredExclusions } from './selective-profile.mjs';
import { legacyManifest } from './legacy-replacement.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const initial = Date.parse('2026-09-27T12:00:00Z');
function manifest(body, at = initial) { return { format: 2, backupId: randomUUID(), snapshotAt: new Date(at).toISOString(),
  expiresAt: new Date(at + 7 * 86400000).toISOString(), postgresMajor: 18, dumpProfileVersion: profileVersion,
  excludedTables: requiredExclusions, sha256: sha(body), bytes: body.length, apiLedgerHash: sha('api'), collectorLedgerHash: sha('batch'), recipientFingerprint: sha('key'),
  tableFingerprints: { 'content.board_post': { count: '1', sha256: sha('content') } } }; }

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-backup-jobs-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'spool')); const body = Buffer.from('synthetic-encrypted-archive'), m = manifest(body);
  const directory = join(root, 'spool', m.backupId); await mkdir(directory);
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(m)); await writeFile(join(directory, 'archive.age'), body);
  return { root, input: { directory, archivePath: join(directory, 'archive.age'), manifest: m } };
}
class Provider {
  count = 0; deleted = []; fail = false; inventoryFail = false;
  constructor(name) { this.name = name; }
  async journal() { if (this.failJournal) throw Error('DRIVE_REAUTH_REQUIRED'); return { journal: { archive: { id: 'archive' }, manifest: { id: 'manifest' } } }; }
  async upload(input) { this.count++; if (this.fail) throw Error('BACKUP_R2_UPLOAD_FAILED'); return { provider: this.name, backupId: input.manifest.backupId, verifiedAt: new Date(initial).toISOString() }; }
  async inventory() { if (this.inventoryFail) throw Error('BACKUP_R2_HEAD_FAILED'); return []; }
  async expire(m) { if (this.fail) throw Error('BACKUP_R2_DELETE_UNCONFIRMED'); this.deleted.push(m.backupId); return true; }
}
function accepted() { return { kind: 'OPS03_DRIVE_ACCEPTANCE', environment: 'production', ownerAccepted: true,
  fullSnapshotsReplaced: true, fullReplacementReceiptSha256: sha('replace'), restoreReceiptSha256: sha('restore'),
  acceptedAt: new Date(initial).toISOString(), restoredAt: new Date(initial - 3600000).toISOString(),
  scheduledDriveSuccesses: [initial - 12 * 3600000, initial].map(at => ({ backupId: randomUUID(), provider: 'drive', scheduled: true,
    snapshotAt: new Date(at).toISOString(), expiresAt: new Date(at + 7 * 86400000).toISOString(), receiptSha256: sha(String(at)) })) }; }

await test('dual keeps R2 when Drive credential/journal fails; Drive mode uses same snapshot for R2 fallback', async t => {
  const { root, input } = await fixture(t), r2 = new Provider('r2'), drive = new Provider('drive');
  let dumps = 0; const snapshot = async () => { dumps++; return input; };
  drive.failJournal = true;
  const result = await new BackupJobs({ root, snapshot, r2, drive, mode: 'dual', now: () => initial }).backup();
  assert.equal(result.status, 'VERIFIED'); assert.equal(result.r2, true); assert.equal(result.drive, false); assert.equal(dumps, 1);
  const second = await fixture(t), r2b = new Provider('r2'), driveb = new Provider('drive'); driveb.fail = true;
  const fallback = await new BackupJobs({ root: second.root, snapshot: async () => second.input, r2: r2b, drive: driveb,
    mode: 'drive', transition: accepted(), now: () => initial }).backup();
  assert.equal(fallback.fallback, true); assert.equal(r2b.count, 1); assert.equal(driveb.count, 1);
  const catalog = JSON.parse(await readFile(join(second.root, 'catalog.json'), 'utf8'));
  assert.equal(catalog.backups[0].driveManifest.archiveFileId, 'archive');
});

await test('Drive transition requires owner evidence, two scheduled snapshots and fresh independent restore at acceptance', () => {
  assert.equal(validateTransition(accepted(), initial + 10 * 86400000), true);
  for (const changed of [{ ownerAccepted: false }, { fullSnapshotsReplaced: false }, { restoreReceiptSha256: '' },
    { restoredAt: new Date(initial - 18 * 3600000).toISOString() }, { scheduledDriveSuccesses: [] }])
    assert.throws(() => validateTransition({ ...accepted(), ...changed }, initial), /BACKUP_DRIVE_TRANSITION_NOT_ACCEPTED/);
});

await test('maintenance deletes expired backups even when inventory and new dump fail; alerts overdue deletion and RPO', async t => {
  const { root, input } = await fixture(t), r2 = new Provider('r2'), reports = [];
  const incidents = { observe: async event => reports.push(event), flush: async () => {} };
  const jobs = new BackupJobs({ root, snapshot: async () => input, r2, incidents, now: () => initial }); await jobs.backup();
  jobs.now = () => initial + 7 * 86400000; r2.inventoryFail = true; r2.fail = true;
  assert((await jobs.maintain()).failures.some(f => f.stage === 'R2_EXPIRY'));
  r2.fail = false;
  await jobs.maintain(); assert.deepEqual(r2.deleted, [input.manifest.backupId]);
  assert(reports.some(e => e.errorCode === 'BACKUP_LAST_SUCCESS_OVER_18H'));
  assert(reports.some(e => e.stage === 'R2_EXPIRY' && e.errorCode === null));
  jobs.snapshot = async () => { throw Error('BACKUP_DUMP_FAILED'); };
  await assert.rejects(jobs.backup(), /BACKUP_DUMP_FAILED/);
  assert.equal(r2.count, 1);
});

await test('notification failure does not change backup success or cause a second dump', async t => {
  const { root, input } = await fixture(t), r2 = new Provider('r2'); let dumps = 0;
  const jobs = new BackupJobs({ root, snapshot: async () => { dumps++; return input; }, r2,
    incidents: { observe: async () => { throw Error('disk-failed'); }, flush: async () => { throw Error('disk-failed'); } }, now: () => initial });
  assert.equal((await jobs.backup()).status, 'VERIFIED'); await jobs.maintain(); assert.equal(dumps, 1);
  assert.equal((await jobs.catalog()).notificationError, 'ALERT_STATE_FAILED');
});

await test('Discord incidents first/6h/recovery and durable 1/5/30-minute retry, safe fields only', async t => {
  const { root } = await fixture(t); let now = initial, good = false; const sent = [];
  const alerts = new Incidents({ path: join(root, 'alerts.json'), webhook: 'https://discord.com/api/webhooks/123/synthetic', now: () => now,
    fetcher: async (url, options) => { sent.push(JSON.parse(options.body)); return good ? new Response('{"id":"receipt"}') : new Response('{}', { status: 503 }); } });
  const event = { job: 'DB_BACKUP', stage: 'UPLOAD', errorCode: 'DRIVE_STORAGE_FULL', backupId: randomUUID(), lastSuccessAt: new Date(initial).toISOString() };
  await alerts.observe(event); assert.equal(sent.length, 1); await alerts.observe(event); assert.equal(sent.length, 1);
  for (const delay of [60000, 300000, 1800000]) { now += delay; await alerts.flush(); }
  assert.equal(sent.length, 4); good = true; now += 3600000; await alerts.flush(); assert.equal((await alerts.load()).pending.length, 0);
  now = initial + 6 * 3600000; await alerts.observe(event); assert.equal(sent.length, 6);
  await alerts.observe({ ...event, errorCode: null }); assert.equal(sent.length, 7);
  await alerts.observe({ ...event, errorCode: null }); assert.equal(sent.length, 7);
  assert.equal(JSON.parse(sent.at(-1).content).state, 'RECOVERED'); assert.deepEqual(sent.at(-1).allowed_mentions, { parse: [] });
  assert(!JSON.stringify(sent).includes('webhooks'));
  await assert.rejects(alerts.observe({ ...event, errorCode: 'https://secret.invalid' }), /ALERT_FIELDS_INVALID/);
});

class FakeS3 {
  objects = new Map();
  sdk = Object.fromEntries(['PutObjectCommand', 'GetObjectCommand', 'HeadObjectCommand', 'DeleteObjectCommand', 'ListObjectsV2Command']
    .map(name => [name, class { constructor(input) { this.input = input; this.kind = name; } }]));
  send = async command => {
    const { input: p, kind } = command; assert.equal(p.Bucket, 'blariyo-backup'); const old = this.objects.get(p.Key);
    if (kind === 'ListObjectsV2Command') return { Contents: [...this.objects.keys()].filter(key => key.startsWith(p.Prefix)).map(Key => ({ Key })) };
    if (kind === 'PutObjectCommand') {
      assert.equal(p.IfNoneMatch, '*'); if (old) throw Object.assign(Error('exists'), { name: 'PreconditionFailed' });
      let body; if (Buffer.isBuffer(p.Body)) body = p.Body; else { const chunks = []; for await (const c of p.Body) chunks.push(c); body = Buffer.concat(chunks); }
      this.objects.set(p.Key, { body, metadata: p.Metadata }); return {};
    }
    if (kind === 'DeleteObjectCommand') { this.objects.delete(p.Key); return {}; }
    if (!old) throw Object.assign(Error('missing'), { name: 'NoSuchKey' });
    if (kind === 'GetObjectCommand') return { Body: Readable.from([old.body]) };
    if (kind === 'HeadObjectCommand') return { Metadata: old.metadata };
    throw Error('unexpected');
  };
}
await test('R2 selective upload is idempotent, independently downloaded, hash checked and expired by snapshot; foreign object protected', async t => {
  const { root, input } = await fixture(t), fake = new FakeS3(); let now = initial;
  const r2 = new R2Store({ client: fake, sdk: fake.sdk, bucket: 'blariyo-backup', now: () => now });
  await r2.upload(input); await r2.upload(input); assert.equal(fake.objects.size, 2);
  const remote = await r2.inventory(); assert.equal(remote.length, 1);
  const restore = join(root, 'restore'); await mkdir(restore);
  const retrieved = await r2.retrieve({ backupId: input.manifest.backupId, directory: restore });
  assert.equal(sha(await readFile(retrieved.archivePath)), input.manifest.sha256);
  await assert.rejects(r2.retrieve({ backupId: input.manifest.backupId, directory: restore }), /EEXIST/);
  assert.equal(sha(await readFile(retrieved.archivePath)), input.manifest.sha256);
  const key = remote[0].key; fake.objects.get(key).body = Buffer.from('corrupted');
  await assert.rejects(r2.download(key, input.manifest), /BACKUP_R2_HASH_MISMATCH/);
  assert.equal(await r2.expire(remote[0]), false); now += 7 * 86400000;
  fake.objects.get(key).metadata.backupid = randomUUID();
  await assert.rejects(r2.expire(remote[0]), /BACKUP_R2_OWNERSHIP_CONFLICT/);
  fake.objects.get(key).metadata.backupid = input.manifest.backupId;
  fake.objects.set('private/untouched', { body: Buffer.from('protected') });
  await r2.expire(remote[0]); assert.deepEqual([...fake.objects.keys()], ['private/untouched']);
});

await test('legacy full R2 snapshot requires verified replacement before day seven; expired original removed despite new backup failure', async () => {
  const fake = new FakeS3(); let now = initial;
  const r2 = new R2Store({ client: fake, sdk: fake.sdk, bucket: 'blariyo-backup', now: () => now });
  const original = { format: 1, key: 'db/daily/20260927T120000Z-abcdef123456.dump.age', createdAt: new Date(initial).toISOString(),
    postgresMajor: 18, retentionDays: 7, sha256: sha('full'), bytes: 4 };
  fake.objects.set(original.key, { body: Buffer.from('full') });
  fake.objects.set(original.key + '.json', { body: Buffer.from(JSON.stringify(original)) });
  assert.equal((await r2.legacyInventory()).length, 1);
  await assert.rejects(r2.removeLegacy(original), /BACKUP_LEGACY_REPLACEMENT_UNVERIFIED/);
  now += 7 * 86400000;
  assert.throws(() => legacyManifest(original, now), /BACKUP_LEGACY_MANIFEST_INVALID/);
  await r2.removeLegacy(original); assert.equal(fake.objects.size, 0);
});
