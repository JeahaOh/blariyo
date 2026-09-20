import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { adapters } from '../dist/bootstrap/config.js';
import { r2Storage } from '../dist/adapters/remote-adapters.js';

const credentials = {
  private: { accessKeyId: 'fixture-private-key', secretAccessKey: 'fixture-private-secret' },
  public: { accessKeyId: 'fixture-public-key', secretAccessKey: 'fixture-public-secret' },
};

await test('R2 startup requires separate media credentials and never falls back to a shared key', () => {
  const env: Record<string, string | undefined> = {
    STORAGE_MODE: 'r2', R2_ENDPOINT: 'http://127.0.0.1:1',
    R2_PRIVATE_BUCKET: 'fixture-private', R2_PUBLIC_BUCKET: 'fixture-public',
    R2_PRIVATE_ACCESS_KEY_ID: credentials.private.accessKeyId,
    R2_PRIVATE_SECRET_ACCESS_KEY: credentials.private.secretAccessKey,
    R2_PUBLIC_ACCESS_KEY_ID: credentials.public.accessKeyId,
    R2_PUBLIC_SECRET_ACCESS_KEY: credentials.public.secretAccessKey,
    CACHE_ZONE_ID: 'fixture-zone', CACHE_PURGE_TOKEN: 'fixture-cache-token',
    R2_ACCESS_KEY_ID: 'legacy-shared-key', R2_SECRET_ACCESS_KEY: 'legacy-shared-secret',
  };
  assert.doesNotThrow(() => adapters(env));
  for (const key of ['R2_PRIVATE_ACCESS_KEY_ID', 'R2_PRIVATE_SECRET_ACCESS_KEY', 'R2_PUBLIC_ACCESS_KEY_ID', 'R2_PUBLIC_SECRET_ACCESS_KEY']) {
    assert.throws(() => adapters({ ...env, [key]: undefined }), /R2_CONFIG_REQUIRED/);
  }
  assert.throws(() => adapters({ ...env, R2_PUBLIC_ACCESS_KEY_ID: env.R2_PRIVATE_ACCESS_KEY_ID }), /R2_CREDENTIALS_MUST_DIFFER/);
  assert.throws(() => adapters({ ...env, R2_PUBLIC_BUCKET: env.R2_PRIVATE_BUCKET }), /R2_BUCKETS_MUST_DIFFER/);
});

await test('R2 operations use signed requests with bucket-scoped keys against an isolated S3 fixture', async t => {
  interface Stored { bytes: Buffer; headers: Record<string, string> }
  const objects = new Map<string, Stored>();
  const requests: { method: string; bucket: string; keyId: string; key: string; copy: boolean }[] = [];
  let failRead = false;
  let failWrite: 'before' | 'after' | undefined;
  const header = (req: IncomingMessage, name: string) => {
    const value = req.headers[name];
    return typeof value === 'string' ? value : '';
  };
  const xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  function error(res: ServerResponse, status: number, code: string) {
    res.writeHead(status, { 'Content-Type': 'application/xml' });
    res.end(`<Error><Code>${code}</Code></Error>`);
  }
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', 'http://localhost');
    const [bucket = '', ...parts] = url.pathname.slice(1).split('/');
    const key = decodeURIComponent(parts.join('/'));
    const keyId = /Credential=([^/]+)/.exec(header(req, 'authorization'))?.[1] || '';
    const copy = Boolean(header(req, 'x-amz-copy-source'));
    requests.push({ method: req.method || '', bucket, keyId, key, copy });
    const expected = bucket === 'fixture-private' ? credentials.private.accessKeyId : bucket === 'fixture-public' ? credentials.public.accessKeyId : undefined;
    if (keyId !== expected || copy) return error(res, 403, 'AccessDenied');
    const name = `${bucket}/${key}`;
    if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const keys = [...objects.keys()].filter(value => value.startsWith(`${bucket}/`)).sort();
      const index = Number(url.searchParams.get('continuation-token') || 0);
      const selected = keys[index];
      const next = index + 1 < keys.length;
      res.setHeader('Content-Type', 'application/xml');
      res.end(`<ListBucketResult><IsTruncated>${next}</IsTruncated>${next ? `<NextContinuationToken>${index + 1}</NextContinuationToken>` : ''}${selected ? `<Contents><Key>${xml(selected.slice(bucket.length + 1))}</Key><LastModified>2026-09-20T00:00:00.000Z</LastModified></Contents>` : ''}</ListBucketResult>`);
      return;
    }
    if (req.method === 'PUT') {
      const mode = bucket === 'fixture-public' ? failWrite : undefined;
      if (mode) failWrite = undefined;
      const chunks: Buffer[] = [];
      for await (const value of req) {
        if (!Buffer.isBuffer(value)) throw new Error('Fixture expected binary request data');
        chunks.push(value);
      }
      if (mode === 'before') return error(res, 503, 'ServiceUnavailable');
      const headers: Record<string, string> = {};
      for (const name of ['content-type', 'cache-control', 'content-disposition', 'content-language', 'x-amz-meta-fixture']) {
        if (header(req, name)) headers[name] = header(req, name);
      }
      objects.set(name, { bytes: Buffer.concat(chunks), headers });
      if (mode === 'after') return error(res, 503, 'ServiceUnavailable');
      res.setHeader('ETag', '"fixture-etag"');
      res.end();
      return;
    }
    if (req.method === 'GET') {
      if (bucket === 'fixture-private' && failRead) return error(res, 403, 'AccessDenied');
      const object = objects.get(name);
      if (!object) return error(res, 404, 'NoSuchKey');
      res.writeHead(200, { ...object.headers, 'Content-Length': object.bytes.length });
      res.end(object.bytes);
      return;
    }
    if (req.method === 'DELETE') {
      objects.delete(name);
      res.writeHead(204);
      res.end();
      return;
    }
    error(res, 405, 'MethodNotAllowed');
  }
  const server = createServer((req, res) => { void handle(req, res).catch(() => error(res, 500, 'FixtureError')); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const storage = r2Storage({
    endpoint: `http://127.0.0.1:${address.port}`,
    privateBucket: 'fixture-private', publicBucket: 'fixture-public',
    privateCredentials: credentials.private, publicCredentials: credentials.public,
  });
  const source = 'staging/한글 +/source.png', target = 'posts/1/public.png';
  const bytes = Buffer.from([0, 255, 13, 10, 42, 128]);

  await t.test('put, get and paginated inventory stay in the matching bucket', async () => {
    await storage.put('private', source, bytes);
    await storage.put('private', 'staging/second.png', bytes);
    await storage.put('public', 'posts/seed.png', bytes);
    assert.deepEqual(await storage.get('private', source), bytes);
    assert.deepEqual(await storage.get('public', 'posts/seed.png'), bytes);
    assert.deepEqual((await storage.inventory('private')).map(item => item.key).sort(), [source, 'staging/second.png'].sort());
    assert.deepEqual((await storage.inventory('public')).map(item => item.key), ['posts/seed.png']);
  });
  await t.test('promotion preserves bytes, metadata and the private original with separate keys', async () => {
    const original = objects.get(`fixture-private/${source}`);
    assert.ok(original);
    Object.assign(original.headers, { 'cache-control': 'public, max-age=60', 'content-disposition': 'inline', 'content-language': 'ko', 'x-amz-meta-fixture': 'preserve' });
    const start = requests.length;
    await storage.promote(source, target);
    assert.deepEqual(requests.slice(start).map(({ method, keyId }) => [method, keyId]), [
      ['GET', credentials.private.accessKeyId], ['PUT', credentials.public.accessKeyId],
    ]);
    assert.deepEqual(objects.get(`fixture-public/${target}`), original);
    assert.ok(objects.has(`fixture-private/${source}`));
  });
  await t.test('a private read failure cannot publish a public object', async () => {
    const start = requests.length;
    failRead = true;
    try { await assert.rejects(storage.promote(source, 'posts/denied.png'), /AccessDenied/); }
    finally { failRead = false; }
    assert.equal(requests.length, start + 1);
    assert.equal(objects.has('fixture-public/posts/denied.png'), false);
  });
  await t.test('public write failures propagate and retry retains a single destination and the original', async () => {
    for (const mode of ['before', 'after'] as const) {
      const target = `posts/retry-${mode}.png`;
      failWrite = mode;
      await assert.rejects(storage.promote(source, target), /ServiceUnavailable/);
      assert.equal(objects.has(`fixture-public/${target}`), mode === 'after');
      await storage.promote(source, target);
      await storage.promote(source, target);
      assert.deepEqual(objects.get(`fixture-public/${target}`)?.bytes, bytes);
      assert.ok(objects.has(`fixture-private/${source}`));
      await storage.delete('public', target);
    }
  });
  await t.test('delete uses the correct bucket credential and never removes the other copy', async () => {
    await storage.delete('public', target);
    assert.ok(objects.has(`fixture-private/${source}`));
    assert.equal(objects.has(`fixture-public/${target}`), false);
    await storage.delete('private', source);
    assert.equal(objects.has(`fixture-private/${source}`), false);
  });
  assert.ok(requests.every(request => !request.copy));
  assert.ok(requests.every(request => request.keyId === (request.bucket === 'fixture-private' ? credentials.private.accessKeyId : credentials.public.accessKeyId)));
});
