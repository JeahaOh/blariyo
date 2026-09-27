import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID, generateKeyPairSync, createVerify } from 'node:crypto';
import { DriveAuth } from './drive-auth.mjs';
import { DriveStore, validateManifest } from './drive-store.mjs';
import { expireLocalSpool } from './backup-dump.mjs';
import { profileVersion, requiredExclusions } from './selective-profile.mjs';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { once } from 'node:events';

const sha = value => createHash('sha256').update(value).digest('hex');
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const auth = { identity: 'synthetic', token: async () => 'synthetic-token' };
const baseTime = Date.parse('2026-09-27T00:00:00Z');
const fixtureManifest = (body, at = baseTime) => ({ format: 2, backupId: randomUUID(),
  snapshotAt: new Date(at).toISOString(), expiresAt: new Date(at + 7 * 86400000).toISOString(),
  postgresMajor: 18, dumpProfileVersion: profileVersion, excludedTables: requiredExclusions,
  sha256: sha(body), bytes: body.length, apiLedgerHash: sha('api'), collectorLedgerHash: sha('collector'), recipientFingerprint: sha('age'),
  tableFingerprints: { 'content.board_post': { count: '1', sha256: sha('content') } },
});

class FakeDrive {
  files = new Map(); sessions = new Map(); requests = []; generated = 0; serial = 0;
  lostFinal = false; lostChunk = false; pauseAtChunk = false; corrupt = false; expireSession = false;
  constructor(driveId) {
    this.driveId = driveId;
    this.files.set('folder', { metadata: { id: 'folder', mimeType: 'application/vnd.google-apps.folder',
      driveId, isAppAuthorized: true, capabilities: { canAddChildren: true, canDelete: true } } });
  }
  fetch = async (input, options = {}) => {
    const url = new URL(input), method = options.method || 'GET';
    this.requests.push({ url, method, range: options.headers?.['Content-Range'] });
    assert.equal(url.origin, 'https://www.googleapis.com');
    assert.equal(options.redirect, 'manual');
    assert.match(options.headers.Authorization, /^Bearer /);
    if (this.inject) { const response = this.inject(url, options); if (response) return response; }
    if (url.pathname.endsWith('/generateIds')) { this.generated++; return json({ ids: ['archive-' + this.generated, 'manifest-' + this.generated] }); }
    if (url.pathname.endsWith('/permissions')) return json({ permissions: [{ type: this.public ? 'anyone' : 'user' }] });
    if (url.pathname.startsWith('/upload/')) {
      if (method === 'POST') {
        const metadata = JSON.parse(options.body), session = String(++this.serial);
        this.sessions.set(session, { metadata, body: Buffer.alloc(0), size: Number(options.headers['X-Upload-Content-Length']) });
        return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=' + session } });
      }
      const sessionId = url.searchParams.get('upload_id'), session = this.sessions.get(sessionId);
      if (!session || this.expireSession) { this.expireSession = false; this.sessions.delete(sessionId); return json({}, 404); }
      const range = options.headers['Content-Range'];
      if (!range.startsWith('bytes */')) {
        const [, start, end, total] = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
        assert.equal(Number(start), session.body.length); assert.equal(Number(total), session.size);
        assert.equal(Number(end) + 1, Number(start) + options.body.length);
        if (this.pauseAtChunk && session.body.length) throw Error('simulated-network-outage');
        session.body = Buffer.concat([session.body, options.body]);
        if (session.body.length < session.size && this.lostChunk) { this.lostChunk = false; throw Error('response-lost'); }
      }
      if (session.body.length === session.size) {
        this.files.set(session.metadata.id, { metadata: { ...session.metadata, mimeType: 'application/octet-stream',
          driveId: this.driveId, capabilities: { canDelete: true, canDownload: true } }, body: session.body });
        if (this.lostFinal) { this.lostFinal = false; this.sessions.delete(sessionId); throw Error('completion-response-lost'); }
        return json({ id: session.metadata.id });
      }
      return new Response(null, { status: 308, headers: session.body.length ? { range: 'bytes=0-' + (session.body.length - 1) } : {} });
    }
    const id = url.pathname.split('/').at(-1), file = this.files.get(id);
    if (!file) return json({}, 404);
    if (method === 'DELETE') { this.files.delete(id); return new Response(null, { status: 204 }); }
    if (url.searchParams.get('alt') === 'media') return new Response(this.corrupt ? Buffer.from('corrupt') : file.body);
    return json(file.metadata);
  };
}

async function fixture(t, bytes = 9 * 1024 * 1024) {
  const directory = await mkdtemp(join(tmpdir(), 'blariyo-drive-fixture-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const body = Buffer.alloc(bytes, 23), archivePath = join(directory, 'archive.age'); await writeFile(archivePath, body);
  return { directory, archivePath, body, manifest: fixtureManifest(body) };
}
function store(fake, extra = {}) { return new DriveStore({ auth, folderId: 'folder', driveId: fake.driveId,
  now: () => baseTime, fetcher: fake.fetch, sleep: async () => {}, jitter: () => 0, ...extra }); }

await test('Drive chunk response loss and final response loss resume same IDs; manifest uploaded last', async t => {
  const input = await fixture(t), fake = new FakeDrive(); fake.lostChunk = true; fake.lostFinal = true;
  const result = await store(fake).upload(input);
  assert.equal(result.sha256, input.manifest.sha256); assert.equal(fake.generated, 1);
  assert.equal(fake.files.size, 3);
  assert(fake.requests.some(r => r.range === 'bytes */' + input.body.length));
  const archiveRead = fake.requests.findIndex(r => r.url.searchParams.get('alt') === 'media');
  const starts = fake.requests.map((r, i) => ({ ...r, i })).filter(r => r.method === 'POST');
  assert(starts[1].i > archiveRead);
  assert.equal((await stat(join(input.directory, 'drive-journal.json'))).mode & 0o777, 0o600);
  const replay = await store(fake).upload(input); assert.deepEqual(replay, result); assert.equal(fake.serial, 2);
});

await test('Drive restart uses durable session offset; exhausted budget does not create another backup', async t => {
  const input = await fixture(t), fake = new FakeDrive(); fake.pauseAtChunk = true;
  await assert.rejects(store(fake).upload(input), /DRIVE_RETRY_EXHAUSTED/);
  assert.equal(fake.serial, 1); assert.equal(fake.generated, 1);
  assert.equal(fake.files.size, 1);
  fake.pauseAtChunk = false;
  await store(fake).upload(input);
  assert.equal(fake.generated, 1); assert.equal(fake.serial, 2); assert.equal(fake.files.size, 3);
});

await test('Drive missing expired session starts a new session with original file ID', async t => {
  const input = await fixture(t, 32), fake = new FakeDrive(); fake.expireSession = true;
  await store(fake).upload(input); assert.equal(fake.generated, 1); assert.equal(fake.serial, 3);
});

await test('Drive refuses public folder, foreign parent, wrong account, corrupted download and unexpected redirects', async t => {
  const input = await fixture(t, 32), fake = new FakeDrive(); fake.public = true;
  await assert.rejects(store(fake).upload(input), /DRIVE_PUBLIC_ACCESS_REJECTED/); assert.equal(fake.generated, 0);
  fake.public = false; fake.corrupt = true;
  await assert.rejects(store(fake).upload(input), /DRIVE_DOWNLOAD_HASH_MISMATCH/);
  assert.equal(fake.files.size, 2); // Archive only; manifest must not precede readback.
  fake.corrupt = false;
  fake.files.get('archive-1').metadata.parents = ['foreign'];
  await assert.rejects(store(fake).upload(input), /DRIVE_OWNERSHIP_CONFLICT/);
  await assert.rejects(store(fake, { auth: { ...auth, identity: 'different' } }).upload(input), /DRIVE_JOURNAL_CONFLICT/);
  assert.throws(() => store(fake).url('https://example.invalid/upload/drive/v3/files'), /DRIVE_URL_REJECTED/);
  const redirect = store(fake, { fetcher: async () => new Response(null, { status: 302, headers: { location: 'https://example.invalid' } }) });
  await assert.rejects(redirect.metadata('folder'), /DRIVE_HTTP_302/);
});

await test('Drive 401 refresh once, Retry-After, quota and permission stop, six retry execution budget', async () => {
  const fake = new FakeDrive(); let tokens = 0, refresh = 0, status = 401;
  fake.inject = () => status ? json({ error: { errors: [{ reason: status === 403 ? 'storageQuotaExceeded' : 'temporary' }] } }, status, { 'retry-after': '2' }) : null;
  const delays = [], client = store(fake, { auth: { identity: 'fixture', token: async forced => { tokens++; if (forced) { refresh++; status = 0; } return 't'; } }, sleep: async ms => delays.push(ms) });
  await client.metadata('folder'); assert.equal(refresh, 1); assert.equal(tokens, 3);
  status = 401; await assert.rejects(client.metadata('folder'), /DRIVE_REAUTH_REQUIRED/); assert.equal(refresh, 1);
  status = 403; await assert.rejects(client.metadata('folder'), /DRIVE_STORAGE_FULL/); assert.deepEqual(delays, []);
  status = 429; await assert.rejects(client.metadata('folder'), /DRIVE_RETRY_EXHAUSTED/); assert.deepEqual(delays, Array(6).fill(2000));
  const denied = store(fake, { fetcher: async () => json({ error: { errors: [{ reason: 'insufficientFilePermissions' }] } }, 403) });
  await assert.rejects(denied.metadata('folder'), /DRIVE_PERMISSION_DENIED/);
});

await test('Drive exact seven-day permanent deletion independent of upload; other files and parents protected', async t => {
  const input = await fixture(t, 32), fake = new FakeDrive('dedicated-drive');
  const receipt = await store(fake).upload(input), manifest = { ...input.manifest, ...receipt };
  fake.files.set('unrelated', { metadata: { id: 'unrelated' }, body: Buffer.from('protected') });
  assert.equal(await store(fake, { now: () => baseTime + 7 * 86400000 - 1 }).expire(manifest), false);
  fake.files.get(receipt.archiveFileId).metadata.parents = ['foreign'];
  await assert.rejects(store(fake, { now: () => baseTime + 7 * 86400000 }).expire(manifest), /DRIVE_OWNERSHIP_CONFLICT/);
  fake.files.get(receipt.archiveFileId).metadata.parents = ['folder'];
  assert.equal(await store(fake, { now: () => baseTime + 7 * 86400000 }).expire(manifest), true);
  assert(fake.files.has('unrelated')); assert.equal(fake.files.size, 2);
  assert.equal(fake.requests.filter(r => r.method === 'DELETE').length, 2);
  assert(fake.requests.filter(r => r.method === 'DELETE').every(r => r.url.searchParams.get('supportsAllDrives') === 'true'));
  assert.throws(() => validateManifest(manifest, baseTime + 7 * 86400000), /BACKUP_MANIFEST_INVALID/);
});

await test('OAuth offline refresh cached, invalid_grant ends retry; Shared Drive JWT has restricted scope and no delegated subject', async () => {
  let count = 0;
  const oauth = new DriveAuth({ mode: 'oauth', clientId: 'fixture', clientSecret: 'fixture', refreshToken: 'fixture' }, {
    now: () => baseTime, fetcher: async (url, options) => {
      assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(options.body.get('grant_type'), 'refresh_token');
      count++; return json({ access_token: 'synthetic', expires_in: 3600 });
    },
  });
  await oauth.token(); await oauth.token(); assert.equal(count, 1); await oauth.token(true); assert.equal(count, 2);
  oauth.fetcher = async () => json({ error: 'invalid_grant' }, 400);
  await assert.rejects(oauth.token(true), /DRIVE_REAUTH_REQUIRED/);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const service = new DriveAuth({ mode: 'shared-service-account', clientEmail: 'fixture@example.invalid', privateKey, driveId: 'dedicated' }, {
    now: () => baseTime, fetcher: async (url, options) => {
      const [header, payload, signature] = options.body.get('assertion').split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url'));
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/drive.file'); assert.equal(claims.sub, undefined);
      assert.equal(claims.exp - claims.iat, 3600);
      assert(createVerify('RSA-SHA256').update(header + '.' + payload).verify(publicKey, Buffer.from(signature, 'base64url')));
      return json({ access_token: 'synthetic-service', expires_in: 3600 });
    },
  });
  await service.token();
  assert.throws(() => new DriveAuth({ mode: 'shared-service-account', clientEmail: 'f', privateKey }), /DRIVE_SHARED_ACCOUNT_CONFIG_INVALID/);
  assert.throws(() => new DriveAuth({ mode: 'oauth', clientId: 'f', clientSecret: 'f', refreshToken: 'f', driveId: 'unexpected' }), /DRIVE_OAUTH_CONFIG_INVALID/);
});

await test('local unfinished spool expires at 24h and completed at seven days without a new successful backup', async t => {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-spool-fixture-')); t.after(() => rm(root, { recursive: true, force: true }));
  const { mkdir } = await import('node:fs/promises');
  const unfinished = fixtureManifest(Buffer.from('one')), complete = fixtureManifest(Buffer.from('two'));
  for (const manifest of [unfinished, complete]) {
    const directory = join(root, manifest.backupId); await mkdir(directory);
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  }
  await writeFile(join(root, complete.backupId, 'upload-receipt.json'), '{}');
  await mkdir(join(root, 'unrelated')); await writeFile(join(root, 'unrelated', 'keep'), 'untouched');
  assert.deepEqual(await expireLocalSpool(root, new Date(baseTime + 86400000 - 1)), []);
  assert.deepEqual(await expireLocalSpool(root, new Date(baseTime + 86400000)), [unfinished.backupId]);
  assert.deepEqual(await expireLocalSpool(root, new Date(baseTime + 7 * 86400000)), [complete.backupId]);
  assert.equal(await readFile(join(root, 'unrelated', 'keep'), 'utf8'), 'untouched');
});

await test('loopback HTTP server: socket loss, resumed range and independent download use actual fetch streams', async t => {
  const input = await fixture(t), fake = new FakeDrive(); fake.lostChunk = true; fake.lostFinal = true;
  const server = createServer(async (request, response) => {
    try {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const raw = Buffer.concat(chunks);
      const result = await fake.fetch('https://www.googleapis.com' + request.url, { method: request.method, redirect: 'manual',
        body: request.method === 'POST' ? raw.toString('utf8') : raw,
        headers: { Authorization: request.headers.authorization, 'Content-Range': request.headers['content-range'],
          'X-Upload-Content-Length': request.headers['x-upload-content-length'] } });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      if (result.body) Readable.fromWeb(result.body).pipe(response); else response.end();
    } catch { request.socket.destroy(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(yes => { server.closeAllConnections(); server.close(yes); }));
  const bridge = async (url, options) => {
    const remote = new URL(url); assert.equal(remote.origin, 'https://www.googleapis.com');
    return fetch(`http://127.0.0.1:${server.address().port}${remote.pathname}${remote.search}`, options);
  };
  const receipt = await store(fake, { fetcher: bridge }).upload(input);
  const restored = await store(fake, { fetcher: bridge }).retrieve({ manifestFileId: receipt.manifestFileId, directory: input.directory });
  assert.equal(sha(await readFile(restored.archivePath)), input.manifest.sha256);
  await assert.rejects(store(fake, { fetcher: bridge }).retrieve({ manifestFileId: receipt.manifestFileId, directory: input.directory }), /EEXIST/);
  assert.equal(sha(await readFile(restored.archivePath)), input.manifest.sha256);
  assert.equal(fake.generated, 1); assert.equal(fake.files.size, 3);
});
