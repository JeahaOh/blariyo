import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource, DatabaseContext, TypeOrmUnitOfWork } from '../dist/persistence/database.js';
import { TypeOrmReviewCommandRepository } from '../dist/persistence/review-command.repository.js';
import type { AcceptReviewCommand } from '../dist/features/collection/review-command.repository.js';

const url = process.env.TEST_NEST_DATABASE_URL;
if (!url) throw new Error('TEST_NEST_DATABASE_URL required');
await test('shared review commands replay once, fence stale workers and give admin precedence through commit', async t => {
  const migration = await migrationContext(url);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const source = await createDataSource(url).initialize(), second = await createDataSource(url).initialize();
  t.after(async () => { await source.destroy(); await second.destroy(); });
  const db = new DatabaseContext(source), work = new TypeOrmUnitOfWork(db), repo = new TypeOrmReviewCommandRepository(db);
  const otherDb = new DatabaseContext(second), otherWork = new TypeOrmUnitOfWork(otherDb), otherRepo = new TypeOrmReviewCommandRepository(otherDb);
  const input: AcceptReviewCommand = { itemId: randomUUID(), origin: 'DISCORD', action: 'APPROVE_PUBLISH',
    actor: 'admin:v1:'+randomBytes(32).toString('base64url'), operatorId: 'fixture-editor', reviewerIds: ['111111111111111111'],
    expectedEpoch: 0, itemVersion: 1, reviewVersion: 0, contentDigest: 'a'.repeat(64), selectionDigest: 'b'.repeat(64),
    excludedUnitIds: [], evidence: {}, requestBody: { boardSlug: 'meme' }, requestKey: randomUUID(), requestHash: 'c'.repeat(64) };
  const accepts = await Promise.all([
    work.transaction(() => repo.accept(input)), otherWork.transaction(() => otherRepo.accept(input)),
  ]);
  assert.equal(accepts.filter(value => value.created).length, 1);
  assert.equal(accepts[0]?.command.id, accepts[1]?.command.id);
  const command = accepts[0].command;
  assert.equal(command.epoch, 1);
  await assert.rejects(work.transaction(() => repo.accept({ ...input, requestHash: 'd'.repeat(64) })), { code: 'IDEMPOTENCY_CONFLICT' });
  const claims = await Promise.all([
    work.transaction(() => repo.claim(command.id,'one')), otherWork.transaction(() => otherRepo.claim(command.id,'two')),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const leased = claims.find(Boolean); assert.ok(leased?.leaseToken);
  await work.transaction(() => repo.progress(command.id,command.epoch,leased.leaseToken!,'ACCEPTED','APPROVED'));
  const preparing = await work.transaction(() => repo.claim(command.id,'prepare')); assert.ok(preparing?.leaseToken);

  // Simulates admin acceptance while Discord is preparing external images without a DB lock.
  const admin = await otherWork.transaction(() => otherRepo.accept({ ...input, origin: 'ADMIN', action: 'REJECT',
    requestKey: randomUUID(), requestHash: 'e'.repeat(64), expectedEpoch: 0 }));
  assert.equal(admin.command.epoch, 2);
  assert.equal((await repo.find(command.id))?.stage, 'CANCELLED');
  await assert.rejects(work.transaction(() => repo.assertActive(command.id,command.epoch,preparing.leaseToken!)), { code: 'BATCH_REVIEW_SUPERSEDED' });
  assert.equal(await work.transaction(() => repo.claim(command.id,'retry')), null);
  await assert.rejects(work.transaction(() => repo.accept({ ...input, requestKey: randomUUID(), expectedEpoch: 2 })), { code: 'BATCH_REVIEW_SUPERSEDED' });
  const replay = await work.transaction(() => repo.accept(input));
  assert.equal(replay.created, false);
  assert.equal(replay.command.stage, 'CANCELLED', 'old idempotency key cannot resurrect approval');
  const adminLease = await otherWork.transaction(() => otherRepo.claim(admin.command.id,'admin')); assert.ok(adminLease?.leaseToken);
  const rejected = await otherWork.transaction(() => otherRepo.progress(admin.command.id,2,adminLease.leaseToken!,'ACCEPTED','REJECTED'));
  assert.equal(rejected.finished, true);
  assert.equal(await work.transaction(() => repo.claim(rejected.id,'retry')), null);

  // Accepting a decision in a transaction that later fails cannot cancel the committed one.
  await assert.rejects(work.transaction(async () => {
    await repo.accept({ ...input, origin: 'ADMIN', requestKey: randomUUID(), requestHash: 'f'.repeat(64) });
    throw new Error('rollback');
  }), /rollback/);
  assert.equal((await repo.find(admin.command.id))?.stage, 'REJECTED');
});
