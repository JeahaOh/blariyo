// Stable, loopback-only Web + Core using the persistent development database.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import contacts from '../../deploy/application/prepare-public-config.cjs';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';

const origin = 'http://127.0.0.1:3000';
let app,
  child,
  stopped = false;
async function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(timer);
  }
  await app?.close();
  process.exitCode = code;
}
async function main() {
  if (process.argv.length !== 2) throw Error('No remote targets or extra arguments allowed');
  for (const port of [3000, 3100]) {
    const probe = createServer();
    probe.listen(port, '127.0.0.1');
    await once(probe, 'listening');
    await new Promise((resolve) => probe.close(resolve));
  }
  const { config } = contacts.prepare();
  await contacts.validate(config);
  const token = () => randomBytes(32).toString('hex');
  const serviceToken = token(),
    adminToken = token();
  const directory = resolve('.local-data/development');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Keep the running server and its assets together when another session rebuilds .output.
  const webOutput = await mkdtemp(resolve(directory, 'web-output-'));
  await cp(resolve('apps/web/.output'), webOutput, { recursive: true, dereference: true });
  await writeFile(resolve(directory, 'session.json'), JSON.stringify({ origin, adminToken }), {
    mode: 0o600,
  });
  app = await createNestApplication({
    databaseUrl: 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local',
    serviceToken,
    storage: localStorage(resolve('.local-data/media')),
    localMedia: true,
    siteOrigin: origin,
    imageOrigin: origin + '/media',
  });
  await app.listen(3100, '127.0.0.1');
  child = spawn(process.execPath, [resolve(webOutput, 'server/index.mjs')], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: '3000',
      NUXT_CORE_ORIGIN: 'http://127.0.0.1:3100',
      NUXT_PUBLIC_SITE_ORIGIN: origin,
      NUXT_PUBLIC_IMAGE_ORIGIN: origin + '/media',
      NUXT_PUBLIC_X_EMBEDS_ENABLED: 'true',
      NUXT_PUBLIC_SOCIAL_EMBEDS_ENABLED: 'true',
      NUXT_ADMIN_AUTH_MODE: 'local',
      NUXT_LOCAL_ADMIN_TOKEN: adminToken,
      NUXT_SERVICE_TOKEN: serviceToken,
      NUXT_ACTOR_SECRET: token(),
      NUXT_PUBLIC_RIGHTS_EMAIL: config.rightsEmail,
      NUXT_PUBLIC_CONTACT_EMAIL: config.contactEmail,
      NUXT_PUBLIC_PRIVACY_EMAIL: config.privacyEmail,
      NUXT_PUBLIC_PRIVACY_OFFICER: config.privacyOfficer,
      NUXT_PUBLIC_OPERATOR_DISPLAY_NAME: config.operatorDisplayName,
      NUXT_PUBLIC_GA4_ENABLED: 'false',
      NUXT_PUBLIC_ANALYTICS_APPROVED: 'false',
      NUXT_PUBLIC_KAKAO_ENABLED: 'false',
    },
  });
  child.once('error', () => void stop(1));
  child.once('exit', (code) => {
    if (!stopped) void stop(code ?? 1);
  });
  console.log(
    `Persistent local development: ${origin}/meme; Core loopback:3100; DB loopback:5439/blariyo_local`
  );
  console.log(
    'Policies and posts are read from the development DB. No automatic content publication.'
  );
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
main().catch(() => {
  console.error(
    'Local startup failed. Check fixed ports, PostgreSQL and contact config; values omitted.'
  );
  void stop(1);
});
