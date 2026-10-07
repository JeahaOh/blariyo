import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDataSource, DatabaseContext, TypeOrmUnitOfWork } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';

const url = process.env.TEST_NEST_DATABASE_URL;
if (!url) throw new Error('TEST_NEST_DATABASE_URL required');

await test('notifications wait for outer commit and session unlock, detach DB context, and never delay response', async t => {
  const source = await createDataSource(url).initialize();
  const second = await createDataSource(url).initialize();
  t.after(async () => { await source.destroy(); await second.destroy(); });
  const db = new DatabaseContext(source), work = new TypeOrmUnitOfWork(db);
  const other = new TypeOrmUnitOfWork(new DatabaseContext(second));
  const seen: string[] = [];
  const detached: boolean[] = [];
  await source.query('CREATE TABLE commit_probe (id integer PRIMARY KEY)');
  assert.throws(() => work.afterCommit(() => {}), /REQUIRES_TRANSACTION/);
  const notify = (value: string) => () => { seen.push(value); detached.push(db.manager === source.manager); };
  await work.lock('discord-cleanup-boundary', async () => {
    await work.transaction(async () => {
      await db.manager.query('INSERT INTO commit_probe VALUES (1)');
      work.afterCommit(notify('outer'));
      await work.transaction(async () => { work.afterCommit(notify('nested')); });
      await nextTurn();
      assert.deepEqual(seen, [], 'nested transaction return is not a commit');
    });
    await nextTurn();
    assert.deepEqual(seen, [], 'committed transaction still owns outer session lock');
    await assert.rejects(other.lock('discord-cleanup-boundary', async () => {}, false), { code: 'IDEMPOTENCY_IN_PROGRESS' });
  });
  assert.deepEqual(seen, [], 'response does not wait for external job');
  await nextTurn();
  assert.deepEqual(seen, ['outer', 'nested']);
  assert.deepEqual(detached, [true, true], 'released QueryRunner cannot leak into workers');
  assert.equal(await other.lock('discord-cleanup-boundary', async () => 'released', false), 'released');
  assert.equal(requiredRow(await second.query('SELECT count(*)::integer AS total FROM commit_probe')).total, 1);

  await assert.rejects(work.transaction(async () => {
    work.afterCommit(notify('rolled-back'));
    await work.transaction(async () => { work.afterCommit(notify('nested-rolled-back')); });
    throw new Error('rollback');
  }), /rollback/);
  await nextTurn();
  assert.deepEqual(seen, ['outer', 'nested']);

  // A failed later operation must not erase a prior durable commit's notification.
  await assert.rejects(work.lock('discord-cleanup-boundary', async () => {
    await work.transaction(async () => { work.afterCommit(notify('committed-before-error')); });
    await work.transaction(async () => { work.afterCommit(notify('later-rollback')); throw new Error('later'); });
  }), /later/);
  await nextTurn();
  assert.deepEqual(seen, ['outer', 'nested', 'committed-before-error']);
  assert.ok(detached.every(Boolean));
});
