// Refresh only the observed 59689 preview. Never seed, publish, or delete data.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { cp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import pg from 'pg';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';

assert.deepEqual(process.argv.slice(2), ['--replace-web-pid', '31429']);
const execute = promisify(execFile);
const origin = 'http://127.0.0.1:59689';
const databaseUrl = 'postgresql://postgres@127.0.0.1:55449/m0_browser_f3351c5d9ee9';
const root = await realpath(
  '/private/var/folders/b1/5z_mft5s4z951slpv9q20nfc0000gq/T/blariyo-browser-jYgXTU'
);
const directory = resolve(
  '.local-data/content-preview',
  new Date().toISOString().replace(/[:.]/g, '-')
);
await mkdir(directory, { recursive: true, mode: 0o700 });
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
let fingerprint;
try {
  await client.query('BEGIN READ ONLY');
  const posts = (
    await client.query('SELECT id,source_url,status FROM content.board_post ORDER BY id')
  ).rows;
  const bundle = JSON.parse(
    await readFile(new URL('./community-hot-20260920.json', import.meta.url), 'utf8')
  );
  assert.equal(posts.length, 25);
  assert.ok(posts.every((post) => post.status === 'PUBLISHED'));
  assert.deepEqual(
    new Set(posts.map((post) => post.source_url)),
    new Set(bundle.items.map((post) => post.sourceUrl))
  );
  const blocks = (
    await client.query('SELECT * FROM content.board_post_block ORDER BY post_id,position')
  ).rows;
  const images = (await client.query('SELECT * FROM content.board_post_image ORDER BY id')).rows;
  assert.equal(blocks.length, 186);
  assert.equal(images.length, 105);
  fingerprint = createHash('sha256')
    .update(JSON.stringify({ posts, blocks, images }))
    .digest('hex');
  await client.query('ROLLBACK');
} finally {
  await client.end();
}
const output = resolve(directory, 'web-output');
await cp(resolve('apps/web/.output'), output, { recursive: true, dereference: true });
const listeners = (
  await execute('/usr/sbin/lsof', ['-t', '-nP', '-iTCP:59689', '-sTCP:LISTEN'])
).stdout.trim();
assert.equal(listeners, '31429', 'Preview process changed; preserve the new owner');

const token = () => randomBytes(32).toString('hex');
const serviceToken = token();
const app = await createNestApplication({
  databaseUrl,
  storage: localStorage(root),
  localMedia: true,
  serviceToken,
  siteOrigin: origin,
  imageOrigin: origin + '/media',
});
await app.listen(0, '127.0.0.1');
const apiOrigin = await app.getUrl();
const env = {
  ...process.env,
  NODE_ENV: 'test',
  NITRO_HOST: '127.0.0.1',
  NUXT_CORE_ORIGIN: apiOrigin,
  NUXT_PUBLIC_SITE_ORIGIN: origin,
  NUXT_PUBLIC_IMAGE_ORIGIN: origin + '/media',
  NUXT_ADMIN_AUTH_MODE: 'local',
  NUXT_LOCAL_ADMIN_TOKEN: token(),
  NUXT_SERVICE_TOKEN: serviceToken,
  NUXT_ACTOR_SECRET: token(),
  NUXT_PUBLIC_GA4_ENABLED: 'false',
  NUXT_PUBLIC_ANALYTICS_APPROVED: 'false',
  NUXT_PUBLIC_KAKAO_ENABLED: 'false',
};
let child,
  stopped = false;
async function stopChild(process) {
  if (!process || process.exitCode !== null) return;
  const exited = once(process, 'exit');
  process.kill('SIGTERM');
  const timer = setTimeout(() => process.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timer);
}
async function stop() {
  if (stopped) return;
  stopped = true;
  await stopChild(child);
  await app.close();
}
async function start(port) {
  const process = spawn(globalThis.process.execPath, [resolve(output, 'server/index.mjs')], {
    env: { ...env, NITRO_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  process.stdout.on('data', (chunk) => {
    if (String(chunk).includes('Listening on')) ready = true;
  });
  process.stderr.on('data', () => {}); // Never print runtime configuration or credentials.
  for (let i = 0; i < 150; i++) {
    if (ready) return process;
    if (process.exitCode !== null) throw new Error('Preview startup failed');
    await new Promise((done) => setTimeout(done, 100));
  }
  await stopChild(process);
  throw new Error('Preview startup timed out');
}
async function smoke(port) {
  const base = `http://127.0.0.1:${port}`;
  const response = await fetch(base + '/meme/posts/9', { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map(
    (match) => /href="([^"]+)"/.exec(match[0])[1]
  );
  assert.ok(css.length);
  for (const url of css) assert.equal((await fetch(new URL(url, base))).status, 200);
  const api = await fetch(base + '/api/v1/boards/meme/posts/9');
  const post = (await api.json()).data.post;
  assert.equal(post.source.url, 'https://theqoo.net/hot/4350517965');
  assert.equal(post.blocks.length, 7);
  return css;
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
try {
  const reservation = createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const probePort = reservation.address().port;
  await new Promise((done) => reservation.close(done));
  child = await start(probePort);
  await smoke(probePort);
  await stopChild(child);
  // The old fixture parent and its DB/media stay alive. Only its stale web child exits.
  process.kill(31429, 'SIGTERM');
  for (let i = 0; i < 100; i++) {
    try {
      process.kill(31429, 0);
    } catch (error) {
      if (error.code === 'ESRCH') break;
      throw error;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  child = await start(59689);
  const stylesheets = await smoke(59689);
  await writeFile(
    resolve(directory, 'runtime.json'),
    JSON.stringify(
      {
        origin,
        apiOrigin,
        pid: process.pid,
        webPid: child.pid,
        output,
        storage: root,
        database: 'loopback:55449/m0_browser_f3351c5d9ee9',
        dataFingerprint: fingerprint,
        stylesheets,
        startedAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  );
  console.log(
    JSON.stringify({
      origin,
      webPid: child.pid,
      stylesheets,
      posts: 25,
      images: 105,
      buildSnapshot: output,
      result: 'READY',
    })
  );
  child.once('exit', () => {
    if (!stopped) void stop();
  });
} catch (error) {
  await stop();
  throw error;
}
