// Stable, loopback-only Web + Core using the persistent development database.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import contacts from '../../deploy/application/prepare-public-config.cjs';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';
import { LocalCollectReader } from '../../apps/api/dist/adapters/collect-reader.js';
import { localActorSecret } from './local-identity.mjs';
import { startCoreWorkers } from './core-workers.mjs';

const origin = 'http://localhost:3000';
let app,
  child,
  stopWorkers,
  stopped = false;
async function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  try {
    await stopWorkers?.();
  } catch {
    code = 1;
    console.error('Local worker shutdown failed; values omitted.');
  }
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
  const args = process.argv.slice(2);
  const sandboxArg = args.find((arg) => arg.startsWith('--sandbox='));
  const intervalArg = args.find((arg) => arg.startsWith('--worker-interval-ms='));
  const workers = args.includes('--workers');
  if (
    new Set(args).size !== args.length ||
    args.some((arg) => arg !== sandboxArg && arg !== intervalArg && arg !== '--workers') ||
    args.filter((arg) => arg.startsWith('--sandbox=')).length > 1 ||
    args.filter((arg) => arg.startsWith('--worker-interval-ms=')).length > 1
  )
    throw Error('Unknown or duplicate local arguments');
  if ((workers && !sandboxArg) || (intervalArg && !workers))
    throw Error('Workers require an isolated sandbox');
  const intervalMs = intervalArg
    ? Number(intervalArg.slice('--worker-interval-ms='.length))
    : 60000;
  if (!Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60000)
    throw Error('Worker interval must be 1000..60000ms');
  for (const port of [3000, 3100]) {
    const probe = createServer();
    probe.listen(port, '127.0.0.1');
    await once(probe, 'listening');
    await new Promise((resolve) => probe.close(resolve));
  }
  const config = sandboxArg
    ? {
        rightsEmail: 'rights@example.test',
        contactEmail: 'contact@example.test',
        privacyEmail: 'privacy@example.test',
        privacyOfficer: '격리 검증',
        operatorDisplayName: '격리 검증',
      }
    : contacts.prepare().config;
  if (!sandboxArg) await contacts.validate(config);
  const token = () => randomBytes(32).toString('hex');
  const serviceToken = token(),
    adminToken = token();
  const directory = sandboxArg
    ? await realpath(resolve(sandboxArg.slice('--sandbox='.length)))
    : resolve('.local-data/development');
  let sandbox;
  if (sandboxArg) {
    sandbox = JSON.parse(await readFile(resolve(directory, 'sandbox.json'), 'utf8'));
    const target = new URL(sandbox.databaseUrl);
    if (
      sandbox.version !== 1 ||
      target.protocol !== 'postgresql:' ||
      !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      !['55449', '5439'].includes(target.port) ||
      !/^\/blariyo_sandbox_[a-f0-9]{12}$/.test(target.pathname) ||
      target.search ||
      target.hash
    )
      throw Error('LOCAL_SANDBOX_INVALID');
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const actorSecret = await localActorSecret(directory);
  let batch;
  try {
    if (!sandbox)
      batch = JSON.parse(await readFile(resolve(directory, 'batch-config.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const database = new URL(
    sandbox ? sandbox.databaseUrl : 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local'
  );
  const storageRoot = sandbox ? resolve(directory, 'media') : resolve('.local-data/media');
  if (batch) {
    if (
      batch.version !== 1 ||
      batch.apiRole !== 'blariyo_api_local' ||
      !/^[a-f0-9]{64}$/.test(batch.apiPassword) ||
      batch.objectRoot !== resolve('.local-data/collector-objects')
    )
      throw Error('LOCAL_CONFIG_MISMATCH');
    database.username = batch.apiRole;
    database.password = batch.apiPassword;
  }
  // Keep the running server and its assets together when another session rebuilds .output.
  const webOutput = await mkdtemp(resolve(directory, 'web-output-'));
  await cp(resolve('apps/web/.output'), webOutput, { recursive: true, dereference: true });
  await writeFile(resolve(directory, 'session.json'), JSON.stringify({ origin, adminToken }), {
    mode: 0o600,
  });
  app = await createNestApplication({
    databaseUrl: database.href,
    collectBatchReviewEnabled: Boolean(batch),
    ...(batch ? { collectReader: new LocalCollectReader(batch.objectRoot) } : {}),
    serviceToken,
    storage: localStorage(storageRoot),
    localMedia: true,
    siteOrigin: origin,
    imageOrigin: origin + '/media',
  });
  await app.listen(3100, '127.0.0.1');
  if (workers)
    stopWorkers = await startCoreWorkers({
      databaseUrl: database.href,
      storageRoot,
      origin,
      intervalMs,
      fatal: () => void stop(1),
    });
  child = spawn(process.execPath, [resolve(webOutput, 'server/index.mjs')], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: '3000',
      NUXT_CORE_ORIGIN: 'http://127.0.0.1:3100',
      NUXT_COLLECT_BATCH_REVIEW_ENABLED: String(Boolean(batch)),
      NUXT_PUBLIC_SITE_ORIGIN: origin,
      NUXT_PUBLIC_IMAGE_ORIGIN: origin + '/media',
      NUXT_PUBLIC_X_EMBEDS_ENABLED: 'true',
      NUXT_PUBLIC_SOCIAL_EMBEDS_ENABLED: 'true',
      NUXT_ADMIN_AUTH_MODE: 'local',
      NUXT_LOCAL_ADMIN_LOGIN_ENABLED: 'true',
      NUXT_LOCAL_ADMIN_TOKEN: adminToken,
      NUXT_SERVICE_TOKEN: serviceToken,
      NUXT_ACTOR_SECRET: actorSecret,
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
    `Local development: ${origin}/meme; Core loopback:3100; ${sandbox ? 'isolated sandbox' : 'persistent development DB'}; workers=${workers}`
  );
  console.log(
    workers
      ? 'Explicitly scheduled sandbox posts and sandbox outbox only; collection remains disabled.'
      : 'Workers disabled. No scheduled publication or outbox processing.'
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
