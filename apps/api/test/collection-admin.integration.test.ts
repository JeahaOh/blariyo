import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource } from '../dist/persistence/database.js';
import {
  CollectSourceEntity,
  CollectCandidateEntity,
  CollectCandidateImageEntity,
} from '../dist/persistence/entities.js';
import { CollectionService } from '../dist/features/collection/collection.service.js';
import { CollectionRepository } from '../dist/features/collection/collection.repository.js';
import { IdempotencyRepository } from '../dist/shared/idempotency.repository.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { TypeOrmOutboxRepository } from '../dist/persistence/outbox.repository.js';
import { DatabaseContext } from '../dist/persistence/database.js';
import { OpsIdempotencyRequestEntity, OpsOutboxTaskEntity } from '../dist/persistence/entities.js';
import { localStorage } from '../dist/adapters/storage.js';
function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
await test('Nest collection sources, filtered pagination, candidate details and private previews', async (t) => {
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
  const directory = await mkdtemp('/private/tmp/nest-collection-admin-');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = localStorage(directory);
  const token = randomBytes(32).toString('hex');
  const actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  const app = await createNestApplication({
    databaseUrl: database,
    storage,
    serviceToken: token,
    collectManualUrlEnabled: true,
  });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const root = (await app.getUrl()) + '/api/v1/admin/collect';
  const headers = {
    'X-Blariyo-Service-Token': token,
    'X-Blariyo-Admin-Actor': actor,
    'Content-Type': 'application/json',
  };
  async function request(
    path: string,
    body?: unknown,
    method = body === undefined ? 'GET' : 'PATCH',
    key = randomUUID()
  ) {
    const response = await fetch(root + path, {
      headers: { ...headers, 'Idempotency-Key': key },
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, body: object(await response.json()) };
  }
  const sources = fixture.getRepository(CollectSourceEntity);
  const source = await sources.save(
    sources.create({
      name: 'Fixture',
      base_url: 'https://fixture.invalid',
      host: 'fixture.invalid',
      is_active: true,
      robots_allowed: true,
      robots_checked_at: new Date(),
      request_interval_ms: 1000,
      daily_fetch_limit: 100,
      created_by: 'system:migration',
      updated_by: 'system:migration',
    })
  );
  await t.test(
    'source patch preserves null vs omitted, audit actor and version fencing across connections',
    async () => {
      const initial = await request('/sources');
      assert.equal(initial.response.status, 200);
      assert.equal(initial.response.headers.get('cache-control'), 'private, no-store');
      assert.equal(
        (await request(`/sources/${source.id}`, { lockVersion: 1, fetchMode: 'LIST_CRAWL' }))
          .response.status,
        409
      );
      assert.equal(
        (await request(`/sources/${source.id}`, { lockVersion: 1, requestIntervalMs: -1 })).response
          .status,
        400
      );
      assert.equal(
        (await request('/sources/invalid', { lockVersion: 1, isActive: true })).response.status,
        404
      );
      const changed = await request(`/sources/${source.id}`, {
        lockVersion: 1,
        robotsAllowed: null,
        isActive: false,
      });
      assert.equal(changed.response.status, 200, JSON.stringify(changed.body));
      const data = object(changed.body.data);
      assert.equal(data.lockVersion, 2);
      assert.equal(data.robotsAllowed, null);
      assert.equal(data.robotsCheckedAt, null);
      assert.equal(data.disabledReasonCode, 'OPERATOR');
      const contenders = await Promise.all([
        request(`/sources/${source.id}`, { lockVersion: 2, isActive: true }),
        request(`/sources/${source.id}`, { lockVersion: 2, isActive: true }),
      ]);
      assert.deepEqual(contenders.map((item) => item.response.status).sort(), [200, 409]);
      const actual = await sources.findOneByOrFail({ id: source.id });
      assert.equal(actual.lock_version, 3);
      assert.equal(actual.updated_by, actor);
      assert.equal(actual.robots_checked_at, null);
      assert.equal(actual.disabled_reason_code, null);
    }
  );
  const candidates = fixture.getRepository(CollectCandidateEntity);
  const images = fixture.getRepository(CollectCandidateImageEntity);
  const now = new Date();
  const ids: string[] = [];
  for (let index = 0; index < 51; index++) {
    const row = await candidates.save(
      candidates.create({
        source_id: source.id,
        origin_url: `https://fixture.invalid/${index}`,
        origin_url_sha256: randomBytes(32),
        title: `fixture ${index}`,
        parser_version: 'fixture-v1',
        status: 'NEW',
        fetched_at: now,
        created_by: 'system:migration',
        updated_by: 'system:migration',
      })
    );
    ids.push(row.id);
  }
  const candidateId = ids.at(-1);
  assert.ok(candidateId);
  const image = await images.save(
    images.create({
      candidate_id: candidateId,
      position: 1,
      remote_url: 'https://fixture.invalid/test.png',
      preview_storage_key: 'collect-preview/test.png',
      preview_expires_at: new Date(Date.now() + 60000),
      created_by: 'system:migration',
      updated_by: 'system:migration',
    })
  );
  await storage.put('private', 'collect-preview/test.png', Buffer.from('synthetic preview bytes'));
  await t.test(
    'candidate ordering, filters, second page, bigint IDs and image count are preserved',
    async () => {
      const result = await request('/candidates?status=NEW&sourceId=' + source.id);
      assert.equal(result.response.status, 200, JSON.stringify(result.body));
      const first = object(result.body.data).items;
      assert.ok(Array.isArray(first));
      assert.equal(first.length, 50);
      assert.equal(object(first[0]).candidateId, Number(candidateId));
      assert.equal(object(first[0]).imageCandidateCount, 1);
      assert.equal(object(result.body.meta).totalItems, 51);
      const second = await request('/candidates?page=2');
      const secondItems = object(second.body.data).items;
      assert.ok(Array.isArray(secondItems));
      assert.equal(secondItems.length, 1);
      assert.equal(object(secondItems[0]).candidateId, Number(ids[0]));
      assert.equal(
        object((await request('/candidates?duplicateOnly=true')).body.meta).totalItems,
        0
      );
      assert.equal(object((await request('/candidates?status=PENDING')).body.meta).totalItems, 0);
      assert.equal((await request('/candidates?page=0')).response.status, 400);
      assert.equal((await request('/candidates?unexpected=x')).response.status, 400);
      assert.equal((await request('/candidates/invalid')).response.status, 404);
      const detail = await request(`/candidates/${candidateId}`);
      assert.equal(detail.response.status, 200);
      const values = object(detail.body.data).imageCandidates;
      assert.ok(Array.isArray(values));
      assert.equal(object(values[0]).candidateImageId, Number(image.id));
      assert.ok(object(values[0]).previewPath);
    }
  );
  await t.test(
    'private preview uses DB expiry and generalized storage errors without leaking keys',
    async () => {
      const path = root + `/candidates/${candidateId}/images/${image.id}/preview`;
      const preview = await fetch(path, { headers });
      assert.equal(preview.status, 200);
      assert.equal(preview.headers.get('content-type'), 'image/png');
      assert.equal(preview.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(await preview.text(), 'synthetic preview bytes');
      await storage.delete('private', 'collect-preview/test.png');
      assert.equal((await fetch(path, { headers })).status, 503);
      await images.update({ id: image.id }, { preview_expires_at: new Date(Date.now() - 1000) });
      assert.equal((await fetch(path, { headers })).status, 404);
      const detail = await request(`/candidates/${candidateId}`);
      const values = object(detail.body.data).imageCandidates;
      assert.ok(Array.isArray(values));
      assert.equal(object(values[0]).previewPath, null);
    }
  );
  await t.test(
    'candidate creation preserves normalization, idempotency expiry, duplicate conflicts and atomic rollback',
    async () => {
      const key = randomUUID();
      const body = {
        originUrl: 'https://fixture.invalid/new///?utm_source=fixture&keep=1#fragment',
      };
      const created = await request('/candidates', body, 'POST', key);
      assert.equal(created.response.status, 202, JSON.stringify(created.body));
      const id = object(created.body.data).candidateId;
      assert.equal(typeof id, 'number');
      const same = await request('/candidates', body, 'POST', key);
      assert.deepEqual(same.body.data, created.body.data);
      assert.equal(
        (
          await request(
            '/candidates',
            { originUrl: 'https://fixture.invalid/different' },
            'POST',
            key
          )
        ).response.status,
        409
      );
      assert.equal(
        (await request('/candidates', { originUrl: 'https://fixture.invalid/new?keep=1' }, 'POST'))
          .response.status,
        409
      );
      assert.equal(
        (await request('/candidates', { originUrl: 'https://not-allowed.invalid/1' }, 'POST'))
          .response.status,
        403
      );
      assert.equal(
        (await request('/candidates', { originUrl: 'http://fixture.invalid/1' }, 'POST')).response
          .status,
        400
      );
      const stored = await candidates.findOneByOrFail({ id: String(id) });
      assert.equal(stored.origin_url, 'https://fixture.invalid/new?keep=1');
      assert.equal(stored.created_by, actor);
      const races = await Promise.all([
        request('/candidates', { originUrl: 'https://fixture.invalid/race' }, 'POST'),
        request('/candidates', { originUrl: 'https://fixture.invalid/race' }, 'POST'),
      ]);
      assert.deepEqual(races.map((result) => result.response.status).sort(), [202, 409]);
      await fixture.getRepository(OpsIdempotencyRequestEntity).update(
        { idempotency_key: key },
        {
          created_at: new Date(Date.now() - 25 * 3600000),
          updated_at: new Date(Date.now() - 25 * 3600000),
          expires_at: new Date(Date.now() - 3600000),
        }
      );
      const refreshed = await request(
        '/candidates',
        { originUrl: 'https://fixture.invalid/after-expiry' },
        'POST',
        key
      );
      assert.equal(refreshed.response.status, 202, JSON.stringify(refreshed.body));
      assert.notEqual(object(refreshed.body.data).candidateId, id);
    }
  );
  await t.test(
    'retry resets execution metadata with preview outbox atomically; rejection respects version and status',
    async () => {
      const candidate = await candidates.findOneByOrFail({ id: candidateId });
      await candidates.update(
        { id: candidateId },
        {
          status: 'FETCH_FAILED',
          fetch_error_code: 'LEASE_EXPIRED',
          collector_id: 'fixture',
          collector_execution_id: randomUUID(),
          result_payload_sha256: randomBytes(32),
          attempt_count: 3,
        }
      );
      await images.update(
        { id: image.id },
        {
          preview_storage_key: 'collect-preview/retry.png',
          preview_expires_at: new Date(Date.now() + 60000),
          preview_source_sha256: randomBytes(32),
        }
      );
      class FailingOutbox extends TypeOrmOutboxRepository {
        override async enqueue() {
          throw new Error('fixture outbox rollback');
        }
      }
      const service = new CollectionService(
        app.get(CollectionRepository),
        app.get(UnitOfWork),
        storage,
        app.get(IdempotencyRepository),
        new FailingOutbox(app.get(DatabaseContext))
      );
      await assert.rejects(
        service.command(
          {
            action: 'retry',
            params: { candidateId },
            body: { lockVersion: candidate.lock_version },
          },
          actor,
          randomUUID(),
          'fixture:retry'
        ),
        /fixture outbox rollback/
      );
      assert.equal((await candidates.findOneByOrFail({ id: candidateId })).status, 'FETCH_FAILED');
      assert.equal(
        (await images.findOneByOrFail({ id: image.id })).preview_storage_key,
        'collect-preview/retry.png'
      );
      const key = randomUUID();
      const retried = await request(
        `/candidates/${candidateId}/retry`,
        { lockVersion: candidate.lock_version },
        'POST',
        key
      );
      assert.equal(retried.response.status, 200, JSON.stringify(retried.body));
      assert.equal(object(retried.body.data).status, 'PENDING');
      assert.deepEqual(
        (
          await request(
            `/candidates/${candidateId}/retry`,
            { lockVersion: candidate.lock_version },
            'POST',
            key
          )
        ).body.data,
        retried.body.data
      );
      const state = await candidates.findOneByOrFail({ id: candidateId });
      assert.equal(state.collector_execution_id, null);
      assert.equal(state.result_payload_sha256, null);
      assert.equal(state.attempt_count, 0);
      assert.equal(state.title, null);
      assert.equal(state.parser_version, null);
      assert.equal(state.fetched_at, null);
      assert.equal(await images.countBy({ candidate_id: candidateId }), 0);
      const outbox = await fixture.getRepository(OpsOutboxTaskEntity).find();
      assert.ok(
        outbox.some((row) => object(row.payload).privateStorageKey === 'collect-preview/retry.png')
      );
      assert.equal(
        (
          await request(
            `/candidates/${candidateId}/reject`,
            { lockVersion: state.lock_version, reasonCode: 'OTHER' },
            'POST'
          )
        ).response.status,
        409
      );
      const rejectId = ids[0];
      assert.ok(rejectId);
      const rejection = await request(
        `/candidates/${rejectId}/reject`,
        { lockVersion: 1, reasonCode: 'RIGHTS_RISK' },
        'POST'
      );
      assert.equal(rejection.response.status, 200, JSON.stringify(rejection.body));
      assert.equal(object(rejection.body.data).status, 'REJECTED');
      assert.ok(object(rejection.body.data).reviewedAt);
      assert.equal(
        (
          await request(
            `/candidates/${rejectId}/reject`,
            { lockVersion: 1, reasonCode: 'RIGHTS_RISK' },
            'POST'
          )
        ).response.status,
        409
      );
    }
  );
});
