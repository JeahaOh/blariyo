import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { CollectionOperationsService } from '../dist/features/collection/collection-operations.service.js';
import { TypeOrmCollectionOperationsRepository } from '../dist/persistence/collection-operations.repository.js';
import { createDataSource, DatabaseContext } from '../dist/persistence/database.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { CollectCollectorOperationalEventEntity } from '../dist/persistence/entities.js';

function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
function databaseUrl() {
  const url = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(url);
  return url;
}

await test('Nest collection transition, administrator events and built CLI preserve the existing contracts', async (t) => {
  const database = databaseUrl();
  const migration = await migrationContext(database);
  try {
    await migration.get(MigrationsService).migrate('up');
  } finally {
    await migration.close();
  }
  const fixture = await createDataSource(database).initialize();
  t.after(() => fixture.destroy());
  const token = randomBytes(32).toString('hex');
  const options = { databaseUrl: database, collectManualUrlEnabled: true, serviceToken: token };
  const app = await createNestApplication(options);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const service = app.get(CollectionOperationsService);
  const work = app.get(UnitOfWork);
  const root = await app.getUrl();
  const headers = {
    'X-Blariyo-Service-Token': token,
    'X-Blariyo-Admin-Actor': 'admin:v1:' + randomBytes(32).toString('base64url'),
    'Idempotency-Key': randomUUID(),
    'Content-Type': 'application/json',
  };
  const route = '/api/v1/admin/collect/operational-events';
  async function request(path = '', method = 'GET', body?: unknown) {
    const response = await fetch(root + route + path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, body: object(await response.json()) };
  }
  const cli = (mode: string) =>
    spawnSync(process.execPath, ['apps/api/dist/commands/collection-transition.js', mode], {
      cwd: new URL('../../../', import.meta.url),
      env: { ...process.env, DATABASE_URL: database },
      encoding: 'utf8',
      timeout: 10000,
    });
  await t.test(
    'readiness permits reads before strict transition and refuses legacy writers without backfill',
    async () => {
      assert.deepEqual(await service.inspectTransition(), {
        legacyRunning: 0,
        legacyPreviews: 0,
        strict: false,
      });
      await service.assertSpringReady(false);
      await assert.rejects(service.assertSpringReady(true), /SPRING_TRANSITION_REQUIRED/);
      const source = requiredRow(
        await fixture.query(
          "INSERT INTO collect.source(name,base_url,host,is_active,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES('fixture','https://legacy.invalid','legacy.invalid',false,1000,100,'system:migration','system:migration') RETURNING id"
        )
      );
      assert.equal(typeof source.id, 'string');
      const candidate = requiredRow(
        await fixture.query(
          "INSERT INTO collect.candidate(source_id,origin_url,origin_url_sha256,status,collector_id,claimed_at,lease_until,created_by,updated_by) VALUES($1,'https://legacy.invalid/1',$2,'RUNNING','fixture',now(),now()+interval '1 minute','system:migration','system:migration') RETURNING id",
          [source.id, randomBytes(32)]
        )
      );
      await assert.rejects(service.assertSpringReady(true), /LEGACY_DRAIN_REQUIRED/);
      await assert.rejects(service.applyTransition(), /LEGACY_DRAIN_REQUIRED/);
      assert.equal(cli('apply').status, 1);
      assert.equal(
        requiredRow(
          await fixture.query('SELECT collector_execution_id FROM collect.candidate WHERE id=$1', [
            candidate.id,
          ])
        ).collector_execution_id,
        null
      );
      await fixture.query(
        "UPDATE collect.candidate SET status='FETCH_FAILED',fetch_error_code='LEASE_EXPIRED',lease_until=NULL,fetched_at=now() WHERE id=$1",
        [candidate.id]
      );
      await fixture.query(
        "INSERT INTO collect.candidate_image(candidate_id,position,remote_url,preview_storage_key,preview_expires_at,created_by,updated_by) VALUES($1,1,'https://legacy.invalid/i.png','collect-preview/fixture.png',now()-interval '1 second','system:migration','system:migration')",
        [candidate.id]
      );
      await assert.rejects(service.applyTransition(), /LEGACY_DRAIN_REQUIRED/);
      await fixture.query(
        'UPDATE collect.candidate_image SET preview_storage_key=NULL,preview_expires_at=NULL WHERE candidate_id=$1',
        [candidate.id]
      );
      assert.equal((await service.inspectTransition()).legacyPreviews, 0);
    }
  );
  await t.test(
    'the transition locks writers and rolls back both constraints on failure',
    async () => {
      const repository = new TypeOrmCollectionOperationsRepository(app.get(DatabaseContext));
      await work.transaction(async () => {
        await repository.lockTransitionTables();
        const writer = fixture.createQueryRunner();
        await writer.connect();
        try {
          await writer.query("SET lock_timeout='100ms'");
          await assert.rejects(
            writer.query('UPDATE collect.candidate SET updated_at=now()'),
            (error) => object(error).code === '55P03'
          );
        } finally {
          await writer.query('RESET lock_timeout');
          await writer.release();
        }
      });
      class FailingConstraints extends TypeOrmCollectionOperationsRepository {
        override async enforceTransitionConstraints() {
          await super.enforceTransitionConstraints();
          throw new Error('fixture rollback');
        }
      }
      const failing = new CollectionOperationsService(
        new FailingConstraints(app.get(DatabaseContext)),
        work
      );
      await assert.rejects(failing.applyTransition(), /fixture rollback/);
      assert.equal((await service.inspectTransition()).strict, false);
      assert.equal(cli('check').status, 0);
      assert.equal(cli('invalid').status, 2);
      const applied = cli('apply');
      assert.equal(applied.status, 0, applied.stderr);
      assert.equal(object(JSON.parse(applied.stdout)).strict, true);
      assert.equal((await service.applyTransition()).strict, true);
      await service.assertSpringReady(true);
    }
  );
  await t.test(
    'events require authentication, filter retention, cap at 100, order ties and acknowledge once',
    async () => {
      assert.equal((await fetch(root + route)).status, 401);
      const events = fixture.getRepository(CollectCollectorOperationalEventEntity);
      const now = new Date();
      const ids: string[] = [];
      for (let index = 0; index < 102; index++) {
        const id = randomUUID();
        ids.push(id);
        await events.insert({
          id,
          collector_id: 'fixture',
          delivery_id: randomUUID(),
          candidate_id: null,
          event_code: 'RECONCILE_REQUIRED',
          severity: 'WARN',
          attempt_count: 1,
          occurred_at: now,
          request_hash: randomBytes(32),
        });
      }
      await events.insert({
        id: randomUUID(),
        collector_id: 'fixture',
        delivery_id: randomUUID(),
        event_code: 'LEASE_EXPIRED',
        severity: 'ERROR',
        attempt_count: 1,
        occurred_at: now,
        created_at: new Date(+now - 31 * 86400000),
        request_hash: randomBytes(32),
      });
      const listed = await request();
      assert.equal(listed.response.status, 200);
      assert.equal(listed.response.headers.get('cache-control'), 'private, no-store');
      const items = object(listed.body.data).items;
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 100);
      assert.deepEqual(
        items.map((item: unknown) => object(item).eventId),
        ids.sort().slice(0, 100)
      );
      const id = ids[0];
      assert.ok(id);
      const acknowledgments = await Promise.all([
        request(`/${id}/acknowledge`, 'POST', {}),
        request(`/${id}/acknowledge`, 'POST', {}),
      ]);
      for (const ack of acknowledgments)
        assert.equal(ack.response.status, 200, JSON.stringify(ack.body));
      assert.deepEqual(acknowledgments[0]?.body.data, acknowledgments[1]?.body.data);
      assert.equal(object(acknowledgments[0]?.body.data).deliveryStatus, 'ACKNOWLEDGED');
      assert.equal(
        (await request(`/${randomUUID()}/acknowledge`, 'POST', {})).response.status,
        404
      );
      assert.equal((await request('/invalid/acknowledge', 'POST', {})).response.status, 400);
      const remaining = object((await request()).body.data).items;
      assert.ok(Array.isArray(remaining));
      assert.ok(!remaining.some((item: unknown) => object(item).eventId === id));
    }
  );
  await t.test(
    'feature flag precedes auth; maintenance precedes collection body validation',
    async () => {
      const disabled = await createNestApplication({ databaseUrl: database });
      const maintenance = await createNestApplication({ ...options, maintenance: true });
      try {
        await disabled.listen(0, '127.0.0.1');
        await maintenance.listen(0, '127.0.0.1');
        assert.equal((await fetch((await disabled.getUrl()) + route)).status, 404);
        const denied = await fetch(
          (await maintenance.getUrl()) + route + `/${randomUUID()}/acknowledge`,
          { method: 'POST', headers, body: '{"invalid":true}' }
        );
        assert.equal(denied.status, 503);
        assert.equal(denied.headers.get('retry-after'), '60');
        assert.equal((await fetch((await maintenance.getUrl()) + route, { headers })).status, 200);
      } finally {
        await disabled.close();
        await maintenance.close();
      }
    }
  );
});
