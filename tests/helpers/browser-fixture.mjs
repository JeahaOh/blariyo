import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool } from '../../apps/api/src/db.mjs';
import { migrate } from '../../apps/api/src/migrate.mjs';
import { createApp } from '../../apps/api/src/app.mjs';
import { localStorage, localCache } from '../../apps/api/src/storage.mjs';
import { postService } from '../../apps/api/src/posts.mjs';
import { publishPolicy, artifactChecksum } from '../../apps/api/src/policies.mjs';
import { runOutbox } from '../../apps/api/src/outbox.mjs';

export async function browserFixture(t, { analytics = false, collection = false } = {}) {
  const base = process.env.TEST_DATABASE_ADMIN_URL;
  if (!base) throw new Error('TEST_DATABASE_ADMIN_URL must point to isolated local PostgreSQL');
  const name = `m0_browser_${randomBytes(6).toString('hex')}`;
  const admin = createPool(base);
  let pool,
    core,
    child,
    directory,
    created = false;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(timer);
    }
    if (core) {
      core.closeAllConnections();
      await new Promise((r) => core.close(r));
    }
    await pool?.end();
    try {
      if (created) await admin.query(`DROP DATABASE ${name}`);
    } finally {
      await admin.end();
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });
  await admin.query(`CREATE DATABASE ${name}`);
  created = true;
  const database = new URL(base);
  database.pathname = '/' + name;
  pool = createPool(database.href);
  await migrate(pool);
  directory = await mkdtemp(join(tmpdir(), 'blariyo-browser-'));
  const storage = localStorage(directory);
  let failStorage = false;
  const adapter = {
    ...storage,
    put: (...args) => {
      if (failStorage) throw new Error('injected local storage failure');
      return storage.put(...args);
    },
  };
  const collectorToken = randomBytes(32).toString('hex');
  const serviceToken = randomBytes(32).toString('hex');
  const adminToken = randomBytes(32).toString('hex');
  const reservation = createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const webPort = reservation.address().port;
  const origin = `http://127.0.0.1:${webPort}`;
  await new Promise((r) => reservation.close(r));
  core = createApp(pool, {
    storage: adapter,
    collectManualUrlEnabled: collection,
    collectDiscordCommandEnabled: collection,
    collectorTokens: [
      {
        collectorId: 'fixture',
        tokenSha256: createHash('sha256').update(collectorToken).digest('hex'),
        scopes: ['collect'],
      },
    ],
    serviceToken,
    localMedia: true,
    siteOrigin: origin,
    imageOrigin: origin + '/media',
  }).listen(0, '127.0.0.1');
  await once(core, 'listening');
  child = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(webPort),
      NUXT_PUBLIC_SITE_ORIGIN: origin,
      NUXT_CORE_ORIGIN: `http://127.0.0.1:${core.address().port}`,
      NUXT_ADMIN_AUTH_MODE: 'local',
      NUXT_LOCAL_ADMIN_TOKEN: adminToken,
      NUXT_SERVICE_TOKEN: serviceToken,
      NUXT_ACTOR_SECRET: randomBytes(32).toString('hex'),
      NUXT_PUBLIC_GA4_ENABLED: String(analytics),
      NUXT_PUBLIC_ANALYTICS_APPROVED: String(analytics),
      NUXT_PUBLIC_GA4_MEASUREMENT_ID: analytics ? 'G-TESTONLY' : 'G-MUSTNOTLEAK',
      NUXT_PUBLIC_ANALYTICS_CONNECT_ORIGINS: analytics ? 'https://www.google-analytics.com' : '',
      NUXT_PUBLIC_KAKAO_ENABLED: 'false',
      NUXT_COLLECT_MANUAL_URL_ENABLED: String(collection),
      NUXT_COLLECT_DISCORD_COMMAND_ENABLED: String(collection),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '',
    launchError;
  child.stdout.on('data', (data) => (output += data));
  child.stderr.on('data', (data) => (output += data));
  child.on('error', (error) => (launchError = error));
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (output.includes('Listening on')) {
      ready = true;
      break;
    }
    if (launchError || child.exitCode !== null)
      throw new Error('Browser fixture web startup failed');
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error('Browser fixture web startup timed out');
  const posts = postService(pool, storage, { siteOrigin: origin, imageOrigin: origin + '/media' });
  for (const type of ['terms', 'privacy']) {
    for (const [index, version] of ['fixture-old', 'fixture-current'].entries()) {
      const artifact = {
        type,
        version,
        title: `${type} 로컬 테스트 정책`,
        body: `<p>${version}: 출시용이 아닌 로컬 테스트 본문</p>`,
        effectiveAt: new Date(Date.now() - (2 - index) * 60000).toISOString(),
      };
      artifact.checksum = artifactChecksum(artifact);
      await publishPolicy(pool, artifact);
    }
  }
  return {
    origin,
    pool,
    storage,
    posts,
    adminToken,
    collectorToken,
    failStorage(value) {
      failStorage = value;
    },
    flush: () => runOutbox(pool, storage, localCache()),
  };
}
