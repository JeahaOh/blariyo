import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import type { PolicyOptions } from '../dist/features/policies/policy-artifact.js';
import { outboxRepository } from './doubles.js';
import { artifactChecksum, assertLegalConfig } from '../dist/features/policies/policy-artifact.js';
import { PoliciesService } from '../dist/features/policies/policies.service.js';
import { PoliciesRepository } from '../dist/features/policies/policies.repository.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { PublicService } from '../dist/features/public/public.service.js';
import { policyDto } from '../dist/features/public/public.dto.js';
import { localStorage } from '../dist/adapters/storage.js';
const database = process.env.TEST_NEST_DATABASE_URL;
if (!database) throw new Error('TEST_NEST_DATABASE_URL required');
await test('Nest: original policy verification, atomic release, history and rollback', async (t) => {
  const pool = await createDataSource(database).initialize();
  t.after(() => pool.destroy());
  const migration = await migrationContext(database);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const app = await createNestApplication({ databaseUrl: database });
  t.after(() => app.close());
  const publishPolicy = (artifact: unknown, options: PolicyOptions) =>
    app.get(PoliciesService).publish(artifact, options);
  const service = {
    policy: async (type: string, version?: string) =>
      policyDto(await app.get(PublicService).policy(type, version)),
  };
  const now = new Date();
  const artifact = (version: string, offset: number, body = '<p>로컬 검증 정책</p>') => {
    const a = {
      type: 'terms',
      version,
      title: '테스트 이용약관',
      body,
      effectiveAt: new Date(+now + offset).toISOString(),
    };
    return { ...a, checksum: artifactChecksum(a) };
  };
  await assert.rejects(publishPolicy(artifact('future', 1000), { now }), /WINDOW/);
  await assert.rejects(publishPolicy(artifact('old', -300001), { now }), /WINDOW/);
  await assert.rejects(
    publishPolicy({ ...artifact('bad', -1000), checksum: 'bad' }, { now }),
    /CHECKSUM/
  );
  await publishPolicy(
    artifact(
      'v1',
      -2000,
      '<p>허용<script>alert(1)</script><a href="javascript:alert(1)">링크</a></p>'
    ),
    { now }
  );
  assert.ok(!(await service.policy('terms')).policy.bodyHtml.includes('script'));
  await publishPolicy(artifact('v2', -1000), { now });
  const result = await service.policy('terms');
  assert.equal(result.policy.version, 'v2');
  assert.equal(result.history.length, 2);
  const [current, previous] = result.history;
  assert.ok(current);
  assert.ok(previous);
  assert.equal(previous.endedAt, current.effectiveAt);
  const count = Number(requiredRow(await pool.query('SELECT count(*) FROM ops.outbox_task')).count);
  assert.equal(count, 2);
  await assert.rejects(publishPolicy(artifact('v3', -2500), { now }), /ORDER/);
  assert.equal((await service.policy('terms')).policy.version, 'v2');
  const brokenService = new PoliciesService(
    app.get(PoliciesRepository),
    outboxRepository({
      async enqueue() {
        throw new Error('fixture outbox failure');
      },
    }),
    app.get(UnitOfWork)
  );
  await assert.rejects(brokenService.publish(artifact('rollback', -500), { now }));
  assert.equal((await service.policy('terms')).policy.version, 'v2');
  await publishPolicy(artifact('v2', -1000), { now });
  assert.equal(
    Number(requiredRow(await pool.query('SELECT count(*) FROM ops.outbox_task')).count),
    2
  );
  assert.equal((await service.policy('terms', 'v1')).policy.version, 'v1');
  assert.throws(() => assertLegalConfig({}), /LEGAL_CONFIG_REQUIRED/);
  assert.throws(() => localStorage('/private/tmp/example', { production: true }), /forbidden/);
});
