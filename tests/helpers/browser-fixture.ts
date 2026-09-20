import { CollectionOperationsService } from '../../apps/api/dist/features/collection/collection-operations.service.js';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import type { Storage } from '../../apps/api/dist/shared/storage.js';
import type { DataSource } from 'typeorm';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';
import { migrationContext } from '../../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../../apps/api/dist/commands/migrations.service.js';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { localStorage } from '../../apps/api/dist/adapters/storage.js';
import { PostsService } from '../../apps/api/dist/features/posts/posts.service.js';
import { PoliciesService } from '../../apps/api/dist/features/policies/policies.service.js';
import { artifactChecksum } from '../../apps/api/dist/features/policies/policy-artifact.js';
import { OutboxService } from '../../apps/api/dist/operations/outbox.service.js';

export async function browserFixture(
  t: TestContext,
  {
    analytics = false,
    collection = false,
    spring = false,
    rightsEmail = '',
  }: {
    analytics?: boolean;
    collection?: boolean;
    spring?: boolean;
    rightsEmail?: string;
  } = {}
) {
  const base = process.env.TEST_DATABASE_ADMIN_URL;
  if (!base) throw new Error('TEST_DATABASE_ADMIN_URL must point to isolated local PostgreSQL');
  const target = new URL(base);
  if (
    !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    target.port !== '55449' ||
    target.pathname !== '/postgres'
  )
    throw new Error('Use the verified migration PostgreSQL on loopback 55449/postgres');
  const name = `m0_browser_${randomBytes(6).toString('hex')}`;
  const admin = await createDataSource(base).initialize();
  let databaseSource: DataSource | undefined = undefined;
  let app: INestApplication | undefined = undefined;
  let child: ChildProcessByStdio<null, Readable, Readable> | undefined = undefined;
  let directory: string | undefined = undefined;
  let created = false;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child?.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(timer);
    }
    await app?.close();
    if (databaseSource?.isInitialized) await databaseSource.destroy();
    try {
      if (created) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    } finally {
      await admin.destroy();
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });
  await admin.query(`CREATE DATABASE ${name}`);
  created = true;
  const database = new URL(base);
  database.pathname = '/' + name;
  databaseSource = await createDataSource(database.href).initialize();
  const source = databaseSource;
  // Test-only SQL assertions use a TypeORM connection; no legacy API pool is imported.
  const pool = {
    async query(sql: string, parameters: unknown[] = []) {
      const runner = source.createQueryRunner();
      try {
        const result: unknown = await runner.query(sql, parameters, true);
        assert.ok(typeof result === 'object' && result !== null && 'records' in result);
        const records: unknown = result.records;
        assert.ok(Array.isArray(records));
        const rows = records.map((row: unknown): Record<string, unknown> => {
          assert.ok(typeof row === 'object' && row !== null && !Array.isArray(row));
          return Object.fromEntries(Object.entries(row));
        });
        return {
          rows,
          rowCount:
            'affected' in result && typeof result.affected === 'number'
              ? result.affected
              : rows.length,
        };
      } finally {
        await runner.release();
      }
    },
  };
  const migration = await migrationContext(database.href);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  directory = await mkdtemp(join(tmpdir(), 'blariyo-browser-'));
  const storage = localStorage(directory);
  let failStorage = false;
  const adapter: Storage = {
    get: (bucket, key) => storage.get(bucket, key),
    promote: (source, target) => storage.promote(source, target),
    delete: (bucket, key) => storage.delete(bucket, key),
    inventory: (bucket) => storage.inventory(bucket),
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
  const address = reservation.address();
  assert.ok(address && typeof address !== 'string');
  const webPort = address.port;
  const origin = `http://127.0.0.1:${webPort}`;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve()))
  );
  app = await createNestApplication({
    databaseUrl: database.href,
    storage: adapter,
    collectManualUrlEnabled: collection,
    collectDiscordCommandEnabled: collection,
    collectContractMode: spring ? 'SPRING_V2' : 'LEGACY_V1',
    ...(spring ? { collectorKeySecret: randomBytes(32).toString('hex') } : {}),
    collectorTokens: [
      {
        collectorId: spring ? 'collector-aaaaaaaaaaaaaaaa' : 'fixture',
        contractVersion: spring ? 'SPRING_V2' : 'LEGACY_V1',
        tokenSha256: createHash('sha256').update(collectorToken).digest('hex'),
        scopes: spring ? ['collector:run', 'collector:read', 'collector:event'] : ['collect'],
      },
    ],
    serviceToken,
    localMedia: true,
    siteOrigin: origin,
    imageOrigin: origin + '/media',
  });
  if (spring) await app.get(CollectionOperationsService).applyTransition();
  await app.listen(0, '127.0.0.1');
  child = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(webPort),
      NUXT_PUBLIC_SITE_ORIGIN: origin,
      NUXT_CORE_ORIGIN: await app.getUrl(),
      NUXT_ADMIN_AUTH_MODE: 'local',
      NUXT_LOCAL_ADMIN_TOKEN: adminToken,
      NUXT_SERVICE_TOKEN: serviceToken,
      NUXT_ACTOR_SECRET: randomBytes(32).toString('hex'),
      NUXT_PUBLIC_GA4_ENABLED: String(analytics),
      NUXT_PUBLIC_ANALYTICS_APPROVED: String(analytics),
      NUXT_PUBLIC_GA4_MEASUREMENT_ID: analytics ? 'G-TESTONLY' : 'G-MUSTNOTLEAK',
      NUXT_PUBLIC_ANALYTICS_CONNECT_ORIGINS: analytics ? 'https://www.google-analytics.com' : '',
      NUXT_PUBLIC_KAKAO_ENABLED: 'false',
      NUXT_PUBLIC_RIGHTS_EMAIL: rightsEmail,
      NUXT_COLLECT_MANUAL_URL_ENABLED: String(collection),
      NUXT_COLLECT_DISCORD_COMMAND_ENABLED: String(collection),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let launchError: Error | undefined = undefined;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (data: string) => (output += data));
  child.stderr.on('data', (data: string) => (output += data));
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
  const posts = app.get(PostsService);
  for (const type of ['terms', 'privacy']) {
    for (const [index, version] of ['fixture-old', 'fixture-current'].entries()) {
      const artifact = {
        type,
        version,
        title: `${type} 로컬 테스트 정책`,
        body: `<p>${version}: 출시용이 아닌 로컬 테스트 본문</p>`,
        effectiveAt: new Date(Date.now() - (2 - index) * 60000).toISOString(),
      };
      await app.get(PoliciesService).publish({ ...artifact, checksum: artifactChecksum(artifact) });
    }
  }
  const runningApp = app;
  return {
    origin,
    pool,
    storage,
    posts,
    adminToken,
    collectorToken,
    failStorage(value: boolean) {
      failStorage = value;
    },
    flush: () => runningApp.get(OutboxService).run(),
  };
}
