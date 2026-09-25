import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { artifactChecksum } from '../dist/features/policies/policy-artifact.js';
import { CleanupService } from '../dist/operations/cleanup.service.js';
import { CleanupRepository } from '../dist/operations/cleanup.repository.js';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { localStorage } from '../dist/adapters/storage.js';

await test('Nest cleanup and built operating commands preserve ownership, failures and server lifecycle', async (t) => {
  const database = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(database);
  const migration = await migrationContext(database);
  try {
    await migration.get(MigrationsService).migrate('up');
  } finally {
    await migration.close();
  }
  const fixture = await createDataSource(database).initialize();
  t.after(() => fixture.destroy());
  const root = await mkdtemp('/private/tmp/blariyo-nest-operations-');
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = localStorage(root);
  const oldStorage = {
    put: storage.put.bind(storage),
    get: storage.get.bind(storage),
    promote: storage.promote.bind(storage),
    delete: storage.delete.bind(storage),
    async inventory(bucket: 'private' | 'public') {
      return (await storage.inventory(bucket)).map((item) => ({
        ...item,
        createdAt: new Date(Date.now() - 172800000),
      }));
    },
  };
  const app = await createNestApplication({ databaseUrl: database, storage: oldStorage });
  t.after(() => app.close());
  const cleanup = app.get(CleanupService);
  await t.test(
    'staged expiry and orphan cleanup preserve live image and retry-task references',
    async () => {
      const image = requiredRow(
        await fixture.query(
          "INSERT INTO content.board_post_image(private_storage_key,content_sha256,mime_type,byte_size,width,height,status,created_by,created_at,updated_by,updated_at) VALUES('staging/expired',$1,'image/png',1,1,1,'STAGED','system:migration',now()-interval '26 hours','system:migration',now()-interval '25 hours') RETURNING id",
          [randomBytes(32)]
        )
      );
      await fixture.query(
        "INSERT INTO ops.outbox_task(type,aggregate_type,payload,status,created_by,created_at,updated_by,updated_at,next_attempt_at) VALUES('OBJECT_DELETE_PRIVATE','STORAGE_OBJECT',$1,'DEAD','system:migration',now(),'system:migration',now(),now())",
        [JSON.stringify({ privateStorageKey: 'staging/dead-reference' })]
      );
      for (const key of [
        'staging/expired',
        'staging/orphan',
        'staging/dead-reference',
        'content/private/staging/orphan',
        'collect-preview/orphan',
        'unmanaged/keep',
      ])
        await storage.put('private', key, Buffer.from('fixture'));
      await cleanup.run();
      assert.equal(
        requiredRow(
          await fixture.query('SELECT status FROM content.board_post_image WHERE id=$1', [image.id])
        ).status,
        'PRIVATE_DELETE_PENDING'
      );
      const keys = (await storage.inventory('private')).map((item) => item.key).sort();
      assert.deepEqual(keys, ['staging/dead-reference', 'staging/expired', 'unmanaged/keep']);
      assert.equal(
        requiredRow(
          await fixture.query(
            "SELECT count(*)::int AS count FROM ops.outbox_task WHERE aggregate_id=$1 AND type='OBJECT_DELETE_PRIVATE'",
            [image.id]
          )
        ).count,
        1
      );
    }
  );
  await t.test(
    'collection reference failure preserves private previews and reports failure',
    async () => {
      await storage.put('private', 'collect-preview/check-failed', Buffer.from('fixture'));
      const repository = app.get(CleanupRepository);
      const original = repository.collectionAvailable.bind(repository);
      repository.collectionAvailable = async () => {
        throw new Error('fixture schema lookup failure');
      };
      try {
        await assert.rejects(cleanup.run(), /COLLECTION_SCHEMA_CHECK_FAILED/);
      } finally {
        repository.collectionAvailable = original;
      }
      assert.ok(
        (await storage.inventory('private')).some(
          (item) => item.key === 'collect-preview/check-failed'
        )
      );
    }
  );

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: database,
    STORAGE_ROOT: root,
    STORAGE_MODE: 'local',
    SCHEDULE_ALERT_WEBHOOK_URL: '',
    COLLECT_MANUAL_URL_ENABLED: 'false',
    COLLECT_DISCORD_COMMAND_ENABLED: 'false',
    MAINTENANCE_READ_ONLY: 'false',
  };
  const cwd = new URL('../../../', import.meta.url);
  const command = (name: string, args: string[] = [], extra: Record<string, string> = {}) =>
    spawnSync(process.execPath, ['apps/api/dist/commands/command.js', name, ...args], {
      cwd,
      env: { ...env, ...extra },
      encoding: 'utf8',
      timeout: 15000,
    });
  await t.test(
    'built CLI closes DB context, preserves policy publication and exits nonzero on rejected operations',
    async () => {
      const artifact = {
        type: 'terms',
        version: 'nest-cli-v1',
        title: 'Fixture terms',
        body: '<p>Local synthetic terms.</p>',
        effectiveAt: new Date().toISOString(),
      };
      const path = root + '/policy.json';
      await writeFile(path, JSON.stringify({ ...artifact, checksum: artifactChecksum(artifact) }));
      for (const [name, args] of [
        ['policies:publish', ['--artifact=' + path]],
        ['posts:publish-due', []],
        ['outbox:run', []],
        ['cleanup:run', []],
      ] as const) {
        const result = command(name, [...args]);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /COMMAND_COMPLETE/);
      }
      assert.equal(
        requiredRow(
          await fixture.query(
            "SELECT status FROM legal.policy_version WHERE policy_type='TERMS' AND version_label='nest-cli-v1'"
          )
        ).status,
        'EFFECTIVE'
      );
      const unknown = command('unknown');
      assert.equal(unknown.status, 1);
      assert.match(unknown.stderr, /UNKNOWN_COMMAND/);
      const maintenance = command('cleanup:run', [], { MAINTENANCE_READ_ONLY: 'true' });
      assert.equal(maintenance.status, 1);
      assert.match(maintenance.stderr, /MAINTENANCE_READ_ONLY/);
      const missing = command('policies:publish');
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /ARTIFACT_REQUIRED/);
    }
  );

  await t.test(
    'built main serves live, ready, public and local binary routes then closes on SIGTERM',
    async () => {
      const reservation = createServer();
      await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
      const address = reservation.address();
      assert.ok(address && typeof address !== 'string');
      const port = address.port;
      await new Promise<void>((resolve, reject) =>
        reservation.close((error) => (error ? reject(error) : resolve()))
      );
      const key = 'posts/1/1-' + 'a'.repeat(64) + '.png';
      await storage.put('public', key, Buffer.from('local binary fixture'));
      const child = spawn(process.execPath, ['apps/api/dist/main.js'], {
        cwd,
        env: { ...env, PORT: String(port), HOST: '127.0.0.1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let diagnostic = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        diagnostic += chunk;
      });
      const terminal = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve, reject) => {
          child.once('error', reject);
          child.once('exit', (code, signal) => resolve({ code, signal }));
        }
      );
      try {
        const base = `http://127.0.0.1:${port}`;
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          if (child.exitCode !== null || child.signalCode !== null)
            assert.fail(diagnostic || 'server terminated');
          try {
            const response = await fetch(base + '/internal/health/ready');
            ready = response.status === 200;
            await response.body?.cancel();
          } catch {
            /* Startup not listening yet. */
          }
          if (ready) break;
          await delay(50);
        }
        assert.ok(ready, diagnostic);
        assert.deepEqual(await (await fetch(base + '/internal/health/live')).json(), {
          status: 'UP',
        });
        const boards = await fetch(base + '/api/v1/boards');
        assert.equal(boards.status, 200);
        assert.equal(boards.headers.get('x-powered-by'), null);
        await boards.body?.cancel();
        const binary = await fetch(base + '/internal/local-media/' + key);
        assert.equal(binary.status, 200);
        assert.match(binary.headers.get('content-type') ?? '', /image\/png/);
        assert.equal(await binary.text(), 'local binary fixture');
        const head = await fetch(base + '/internal/health/live', { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), '');
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        const result = await terminal;
        assert.ok(result.code === 0 || result.signal === 'SIGTERM', diagnostic);
      }
    }
  );
});
