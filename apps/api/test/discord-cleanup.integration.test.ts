import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource, DatabaseContext, TypeOrmUnitOfWork } from '../dist/persistence/database.js';
import { TypeOrmDiscordCleanupRepository } from '../dist/persistence/discord-cleanup.repository.js';
import { DiscordCleanupService, DiscordDeleteClient, DiscordTransportError } from '../dist/features/collection/discord-cleanup.js';
import { TypeOrmDiscordReviewRepository } from '../dist/persistence/discord-review.repository.js';
import { requiredRow } from '../dist/persistence/rows.js';

const url = process.env.TEST_NEST_DATABASE_URL;
if (!url) throw new Error('TEST_NEST_DATABASE_URL required');
await test('durable cleanup shares leases, counts failures once, preserves thread, and never repeats business decisions', async t => {
  const migration = await migrationContext(url);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const source = await createDataSource(url).initialize();
  const second = await createDataSource(url).initialize();
  t.after(async () => { await source.destroy(); await second.destroy(); });
  const db = new DatabaseContext(source), work = new TypeOrmUnitOfWork(db);
  const repository = new TypeOrmDiscordCleanupRepository(db);
  const otherDb = new DatabaseContext(second), otherWork = new TypeOrmUnitOfWork(otherDb);
  const otherRepository = new TypeOrmDiscordCleanupRepository(otherDb);
  const id = randomUUID(), itemId = randomUUID();
  await source.query(`INSERT INTO collect.discord_review_delivery
    (id,item_id,environment,item_version,content_digest,renderer_version,manifest,guild_id,channel_id,head_message_id,thread_id,head_send_state,cleanup_state)
    VALUES($1,$2,'local_test',1,decode(repeat('aa',32),'hex'),'sentence-v1','{}','111111111111111111','222222222222222222','333333333333333333','333333333333333333','SENT','PENDING')`, [id,itemId]);
  const read = async () => requiredRow(await source.query('SELECT * FROM collect.discord_review_delivery WHERE id=$1', [id]));
  const due = () => source.query('UPDATE collect.discord_review_delivery SET next_attempt_at=now() WHERE id=$1', [id]);
  const headCalls: string[] = [], threadCalls: string[] = [];
  let shouldFail = true;
  class Discord extends DiscordDeleteClient {
    async deleteHead(channel: string, message: string) {
      assert.equal(db.manager, source.manager, 'HTTP must have no inherited QueryRunner');
      headCalls.push(`${channel}/${message}`);
      assert.equal((await read()).cleanup_state, 'RUNNING', 'claim committed before HTTP');
      assert.equal(await otherWork.transaction(() => otherRepository.claim(id, 'batch')), null);
      if (shouldFail) throw new DiscordTransportError('DISCORD_RATE_LIMITED', false, 600_000);
    }
    async deleteThread(_channel: string, thread: string) { assert.equal(db.manager, source.manager); threadCalls.push(thread); }
  }
  const service = new DiscordCleanupService(repository, work, new Discord());
  await service.attempt(id, 'api-after-commit');
  const first = await read();
  assert.equal(first.cleanup_failures, 1);
  assert.equal(first.notice_state, 'NONE');
  assert.equal(first.cleanup_state, 'RETRY_WAIT');
  assert.ok(first.next_attempt_at instanceof Date && first.next_attempt_at.getTime() > Date.now()+590_000);
  assert.deepEqual(threadCalls, [], 'failed head preserves the thread for the required notice');
  await service.attempt(id, 'batch');
  assert.equal(headCalls.length, 1, 'Retry-After is respected');
  await due();
  await service.attempt(id, 'batch');
  assert.equal((await read()).cleanup_failures, 2);
  assert.equal((await read()).notice_state, 'PENDING');
  const deliveries = new TypeOrmDiscordReviewRepository(db,{environment:'local_test',guildId:'111111111111111111',channelId:'222222222222222222',
    exportSince:new Date().toISOString(),botTokenFile:'/unused',workerTokenFile:'/unused',reviewersFile:'/unused',adminOperatorsFile:'/unused',actorSecretFile:'/unused'});
  const notice = await work.transaction(()=>deliveries.claimNotice(id,'notice')); assert.ok(notice);
  assert.match(notice.text,/삭제가 2회 실패/);
  await work.transaction(()=>deliveries.acknowledgeNotice(id,{leaseToken:notice.leaseToken,attemptId:notice.attemptId,error:'DISCORD_HTTP_UNAVAILABLE'}));
  assert.equal((await read()).cleanup_failures,2,'notice failure does not count as delete failure');
  assert.equal((await read()).notice_failures,1);
  assert.equal(await work.transaction(()=>deliveries.claimNotice(id,'notice')),null,'notice has independent retry backoff');
  await source.query('UPDATE collect.discord_review_delivery SET notice_next_attempt_at=now() WHERE id=$1',[id]);
  const noticeRetry = await work.transaction(()=>deliveries.claimNotice(id,'notice')); assert.ok(noticeRetry);
  assert.equal(noticeRetry.nonce,notice.nonce);
  await work.transaction(()=>deliveries.acknowledgeNotice(id,{leaseToken:noticeRetry.leaseToken,attemptId:noticeRetry.attemptId,messageId:'444444444444444444'}));
  assert.equal((await read()).notice_state,'SENT');
  assert.equal(await work.transaction(()=>deliveries.claimNotice(id,'notice')),null,'successful notice is not duplicated');
  shouldFail = false;
  await due();
  await service.attempt(id, 'batch');
  const done = await read();
  assert.equal(done.cleanup_state, 'DONE');
  assert.ok(done.head_deleted_at instanceof Date);
  assert.ok(done.thread_deleted_at instanceof Date);
  assert.equal(done.cleanup_failures, 2);
  await service.attempt(id, 'api-after-commit');
  assert.equal(headCalls.length, 3);
  assert.equal(threadCalls.length, 1);
  assert.equal(requiredRow(await source.query('SELECT count(*) FROM collect.batch_review_command')).count, '0');
  assert.equal(requiredRow(await source.query('SELECT count(*) FROM content.board_post')).count, '0');

  // An expired worker cannot ACK another worker's attempt or count the same failure twice.
  await source.query("UPDATE collect.discord_review_delivery SET cleanup_state='PENDING',next_attempt_at=now() WHERE id=$1", [id]);
  const old = await work.transaction(() => repository.claim(id, 'old')); assert.ok(old);
  await source.query("UPDATE collect.discord_review_delivery SET lease_until=now()-interval '1 second' WHERE id=$1", [id]);
  const newer = await otherWork.transaction(() => otherRepository.claim(id, 'new')); assert.ok(newer);
  const failed = { headDeleted: true, threadDeleted: true, error: 'DISCORD_FORBIDDEN', blocked: true, retryAfterMs: 0 };
  assert.equal(await work.transaction(() => repository.acknowledge(old, failed)), false);
  assert.equal(await otherWork.transaction(() => otherRepository.acknowledge(newer, failed)), true);
  assert.equal(await otherWork.transaction(() => otherRepository.acknowledge(newer, failed)), false);
  assert.equal((await read()).cleanup_failures, 3);
  assert.equal((await read()).cleanup_state, 'BLOCKED');

  // Missing source rows do not cascade the only copy of cleanup IDs away.
  assert.equal((await read()).item_id, itemId);
  await assert.rejects(migrationContext(url).then(async context => {
    try {
      await context.get(MigrationsService).migrate('down'); // Unchanged V017 keywords are reversible.
      await context.get(MigrationsService).migrate('down'); // Empty V016 classification is reversible.
    await context.get(MigrationsService).migrate('down'); // Empty V015 policy rolls back before testing the V014 cleanup guard.
      await context.get(MigrationsService).migrate('down');
    } finally { await context.close(); }
  }), /recovery\/export plan/);
});
