import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import {
  ScheduleAlertsService,
  type ScheduleEvent,
} from '../dist/operations/schedule-alerts.service.js';
import { ScheduleAlertsRepository } from '../dist/operations/schedule-alerts.repository.js';
import { scheduleWebhook } from '../dist/adapters/schedule-webhook.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { OpsScheduleFailureAlertEntity } from '../dist/persistence/entities.js';

function latch() {
  let resolve: () => void = () => {
    throw new Error('uninitialized latch');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

await test('schedule alerts survive restart, retry delivery, throttle grouping and serialize independent workers', async (t) => {
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
  const post = requiredRow(
    await fixture.query(
      "INSERT INTO content.board_post(board_id,title,status,created_by,updated_by,created_at,updated_at) SELECT id,'fixture','DRAFT','system:migration','system:migration',now(),now() FROM content.board WHERE slug='meme' RETURNING id"
    )
  );
  assert.ok(typeof post.id === 'string');
  const postId = post.id;
  const now = new Date();
  const alerts = fixture.getRepository(OpsScheduleFailureAlertEntity);
  await alerts.insert({
    post_id: postId,
    scheduled_at: now,
    error_code: 'DEPENDENCY_UNAVAILABLE',
    attempt_count: 1,
    first_attempt_at: now,
    last_attempt_at: now,
  });
  let unavailable = true;
  const received: unknown[] = [];
  const receiver = createServer((request, response) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        const value: unknown = chunk;
        assert.ok(Buffer.isBuffer(value));
        chunks.push(value);
      }
      received.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      response.writeHead(unavailable ? 503 : 204);
      response.end();
    })().catch((error: unknown) =>
      response.destroy(error instanceof Error ? error : new Error('fixture failure'))
    );
  });
  await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        receiver.close((error) => (error ? reject(error) : resolve()))
      )
  );
  const address = receiver.address();
  assert.ok(address && typeof address !== 'string');
  const send = scheduleWebhook(`http://127.0.0.1:${address.port}/fixture`);
  const firstApp = await createNestApplication({ databaseUrl: database });
  const first = new ScheduleAlertsService(
    firstApp.get(ScheduleAlertsRepository),
    firstApp.get(UnitOfWork),
    send
  );
  try {
    await assert.rejects(first.deliver(now), /DELIVERY_FAILED/);
  } finally {
    await firstApp.close();
  }
  assert.equal((await alerts.findOneByOrFail({ post_id: postId })).notified_count, 0);
  unavailable = false;
  const restarted = await createNestApplication({ databaseUrl: database });
  const competing = await createNestApplication({ databaseUrl: database });
  t.after(async () => {
    await restarted.close();
    await competing.close();
  });
  const service = new ScheduleAlertsService(
    restarted.get(ScheduleAlertsRepository),
    restarted.get(UnitOfWork),
    send
  );
  assert.equal(await service.deliver(now), 1);
  assert.equal(received.length, 2);
  await alerts.update({ post_id: postId }, { attempt_count: 2 });
  assert.equal(await service.deliver(new Date(+now + 14 * 60000)), 0);
  assert.equal(await service.deliver(new Date(+now + 15 * 60000)), 1);
  assert.equal((await alerts.findOneByOrFail({ post_id: postId })).notified_count, 2);
  const last: unknown = received.at(-1);
  assert.ok(
    typeof last === 'object' && last !== null && 'newAttempts' in last && last.newAttempts === 1
  );
  await alerts.update({ post_id: postId }, { attempt_count: 3 });
  const entered = latch();
  const release = latch();
  const delivered: ScheduleEvent[] = [];
  const owner = new ScheduleAlertsService(
    restarted.get(ScheduleAlertsRepository),
    restarted.get(UnitOfWork),
    async (event) => {
      delivered.push(event);
      entered.resolve();
      await release.promise;
    }
  );
  const other = new ScheduleAlertsService(
    competing.get(ScheduleAlertsRepository),
    competing.get(UnitOfWork),
    async (event) => {
      delivered.push(event);
    }
  );
  const later = new Date(+now + 31 * 60000);
  const running = owner.deliver(later);
  await entered.promise;
  try {
    assert.equal(await other.deliver(later), 0);
    // A failure recorded during external delivery must remain pending after the old snapshot is acknowledged.
    await alerts.update({ post_id: postId }, { attempt_count: 4 });
  } finally {
    release.resolve();
  }
  assert.equal(await running, 1);
  assert.equal(delivered.length, 1);
  assert.equal((await alerts.findOneByOrFail({ post_id: postId })).notified_count, 3);
  assert.equal(await other.deliver(new Date(+later + 15 * 60000)), 1);
  assert.equal(delivered[1]?.newAttempts, 1);
  assert.equal(delivered[0]?.groupKey, delivered[1]?.groupKey);
  assert.equal((await alerts.findOneByOrFail({ post_id: postId })).notified_count, 4);
});
