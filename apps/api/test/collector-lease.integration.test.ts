import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { localStorage } from '../dist/adapters/storage.js';
import { CollectorPreviewService } from '../dist/features/collection/collector-preview.service.js';
import { CollectorReceiptRepository } from '../dist/features/collection/collector-receipt.repository.js';
import { TypeOrmCollectorReceiptRepository } from '../dist/persistence/collector-receipt.repository.js';
import { CollectionRepository } from '../dist/features/collection/collection.repository.js';
import { OutboxRepository } from '../dist/operations/outbox.repository.js';
import { DatabaseContext } from '../dist/persistence/database.js';
import type { TransactionOptions } from '../dist/shared/unit-of-work.js';
import {
  CollectorResultService,
  type CollectorResultInput,
} from '../dist/features/collection/collector-result.service.js';
import { CollectionService } from '../dist/features/collection/collection.service.js';
import { collectionDigest } from '../dist/features/collection/collection-url.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource } from '../dist/persistence/database.js';
import { CollectSourceEntity, CollectCandidateEntity } from '../dist/persistence/entities.js';
import { CollectorLeaseService } from '../dist/features/collection/collector-lease.service.js';
import { CollectionOperationsService } from '../dist/features/collection/collection-operations.service.js';

await test('collector leases retain SKIP LOCKED claiming, expiration and execution ownership on real PostgreSQL', async (t) => {
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
  const directory = await mkdtemp('/private/tmp/nest-preview-');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = localStorage(directory);
  const first = await createNestApplication({ databaseUrl: database, storage });
  const second = await createNestApplication({ databaseUrl: database, storage });
  t.after(async () => {
    await first.close();
    await second.close();
  });
  const a = first.get(CollectorLeaseService),
    b = second.get(CollectorLeaseService);
  const sources = fixture.getRepository(CollectSourceEntity);
  const source = await sources.save(
    sources.create({
      name: 'Lease fixture',
      host: 'lease.invalid',
      base_url: 'https://lease.invalid',
      request_interval_ms: 1000,
      daily_fetch_limit: 100,
      created_by: 'system:migration',
      updated_by: 'system:migration',
    })
  );
  const candidates = fixture.getRepository(CollectCandidateEntity);
  async function candidate() {
    return candidates.save(
      candidates.create({
        source_id: source.id,
        origin_url: 'https://lease.invalid/' + randomUUID(),
        origin_url_sha256: randomBytes(32),
        status: 'PENDING',
        created_by: 'system:migration',
        updated_by: 'system:migration',
      })
    );
  }
  await t.test(
    'two workers cannot claim the same candidate and old heartbeat versions fail',
    async () => {
      const row = await candidate();
      const body = {
        candidateId: Number(row.id),
        maxItems: 1,
        collectorId: 'fixture',
        leaseSeconds: 60,
      };
      const results = await Promise.all([a.claim(body), b.claim(body)]);
      const claimed = results.flat();
      assert.equal(claimed.length, 1);
      const winner = claimed[0];
      assert.ok(winner);
      assert.equal(winner.attemptCount, 1);
      assert.equal(winner.lockVersion, 2);
      assert.equal(winner.source.isActive, false); // Claim retains the source gate information; fetch authorization is separate.
      const renewed = await b.heartbeat(row.id, {
        collectorId: 'fixture',
        lockVersion: 2,
        leaseSeconds: 60,
      });
      assert.equal(renewed.lockVersion, 3);
      await assert.rejects(
        a.heartbeat(row.id, { collectorId: 'fixture', lockVersion: 2, leaseSeconds: 60 }),
        /CANDIDATE_LEASE_CONFLICT/
      );
      await assert.rejects(
        a.heartbeat(row.id, { collectorId: 'other', lockVersion: 3, leaseSeconds: 60 }),
        /CANDIDATE_LEASE_CONFLICT/
      );
      await candidates.update({ id: row.id }, { lease_until: new Date(Date.now() - 1000) });
      const reclaimed = await b.claim(body);
      assert.equal(reclaimed[0]?.attemptCount, 2);
      assert.equal(reclaimed[0]?.lockVersion, 4);
    }
  );
  await t.test('an independent row lock is skipped without claiming or modifying it', async () => {
    const row = await candidate();
    const runner = fixture.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('SELECT id FROM collect.candidate WHERE id=$1 FOR UPDATE', [row.id]);
      assert.deepEqual(
        await a.claim({
          candidateId: Number(row.id),
          maxItems: 1,
          collectorId: 'fixture',
          leaseSeconds: 60,
        }),
        []
      );
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
    assert.equal((await candidates.findOneByOrFail({ id: row.id })).status, 'PENDING');
    assert.equal(
      (
        await a.claim({
          candidateId: Number(row.id),
          maxItems: 1,
          collectorId: 'fixture',
          leaseSeconds: 60,
        })
      ).length,
      1
    );
  });
  await t.test(
    'exhausted or day-old RUNNING candidates expire once and release their leases',
    async () => {
      const row = await candidate();
      const body = {
        candidateId: Number(row.id),
        maxItems: 1,
        collectorId: 'fixture',
        leaseSeconds: 60,
      };
      await a.claim(body);
      await candidates.update(
        { id: row.id },
        { lease_until: new Date(Date.now() - 1000), attempt_count: 3 }
      );
      assert.deepEqual(await a.claim(body), []);
      const state = await candidates.findOneByOrFail({ id: row.id });
      assert.equal(state.status, 'FETCH_FAILED');
      assert.equal(state.fetch_error_code, 'LEASE_EXPIRED');
      assert.equal(state.lease_until, null);
      assert.ok(state.fetched_at);
      assert.equal(state.lock_version, 3);
      assert.deepEqual(await a.claim(body), []);
      assert.equal((await candidates.findOneByOrFail({ id: row.id })).lock_version, 3);
      const old = await candidate();
      const oldBody = { ...body, candidateId: Number(old.id) };
      await a.claim(oldBody);
      await candidates.update(
        { id: old.id },
        {
          lease_until: new Date(Date.now() - 1000),
          requested_at: new Date(Date.now() - 25 * 3600000),
        }
      );
      assert.deepEqual(await b.claim(oldBody), []);
      const oldState = await candidates.findOneByOrFail({ id: old.id });
      assert.equal(oldState.status, 'FETCH_FAILED');
      assert.equal(oldState.attempt_count, 1);
    }
  );
  await t.test(
    'strict mode writes execution metadata and rejects stale execution even with a current version',
    async () => {
      // Drain only this test's synthetic RUNNING rows before applying the preserved transition command.
      await fixture.query(
        "UPDATE collect.candidate SET status='FETCH_FAILED',fetch_error_code='LEASE_EXPIRED',lease_until=NULL,fetched_at=now() WHERE status='RUNNING'"
      );
      await first.get(CollectionOperationsService).applyTransition();
      const row = await candidate();
      const execution = randomUUID();
      const body = {
        candidateId: Number(row.id),
        maxItems: 1,
        collectorId: 'spring',
        leaseSeconds: 60,
      };
      const result = await a.claim(body, execution);
      assert.equal(result[0]?.collectorExecutionId, execution);
      const stored = await candidates.findOneByOrFail({ id: row.id });
      assert.equal(stored.collector_execution_id, execution);
      assert.ok(stored.last_heartbeat_at);
      assert.equal(stored.result_payload_sha256, null);
      await assert.rejects(
        b.heartbeat(
          row.id,
          { collectorId: 'spring', lockVersion: 2, leaseSeconds: 60 },
          randomUUID()
        ),
        /CANDIDATE_EXECUTION_CONFLICT/
      );
      const renewed = await b.heartbeat(
        row.id,
        { collectorId: 'spring', lockVersion: 2, leaseSeconds: 60 },
        execution.toUpperCase()
      );
      assert.equal(renewed.lockVersion, 3);
      await assert.rejects(a.claim({ ...body, maxItems: 2 }, execution), /VALIDATION_FAILED/);
    }
  );
  await t.test(
    'result failure and success retain lease checks, source audit, digest and outer transaction rollback',
    async () => {
      const row = await candidate();
      const execution = randomUUID();
      const submit = first.get(CollectorResultService);
      await a.claim(
        { candidateId: Number(row.id), maxItems: 1, collectorId: 'spring', leaseSeconds: 60 },
        execution
      );
      const failure: CollectorResultInput = {
        collectorId: 'spring',
        collectorExecutionId: execution,
        lockVersion: 2,
        status: 'FETCH_FAILED',
        fetchErrorCode: 'FETCH_TIMEOUT',
        warnings: [],
      };
      await assert.rejects(
        submit.submit(row.id, failure, randomUUID()),
        /CANDIDATE_EXECUTION_CONFLICT/
      );
      const failed = await submit.submit(row.id, failure, execution);
      assert.equal(failed.status, 'FETCH_FAILED');
      assert.equal(failed.lockVersion, 3);
      assert.deepEqual(failed.images, []);
      assert.ok(
        (await candidates.findOneByOrFail({ id: row.id })).result_payload_sha256?.equals(
          collectionDigest(failure)
        )
      );
      assert.equal((await sources.findOneByOrFail({ id: source.id })).consecutive_error_count, 1);
      await first
        .get(CollectionService)
        .command(
          { action: 'retry', params: { candidateId: row.id }, body: { lockVersion: 3 } },
          'system:collector',
          randomUUID(),
          'fixture:retry-result'
        );
      const nextExecution = randomUUID();
      await a.claim(
        { candidateId: Number(row.id), maxItems: 1, collectorId: 'spring', leaseSeconds: 60 },
        nextExecution
      );
      const success: CollectorResultInput = {
        collectorId: 'spring',
        collectorExecutionId: nextExecution,
        lockVersion: 5,
        status: 'NEW',
        title: 'Parsed fixture',
        canonicalUrl: row.origin_url,
        sourcePublishedAt: null,
        parserVersion: 'fixture-v1',
        warnings: ['FIXTURE_WARNING'],
        imageCandidates: [
          { position: 1, remoteUrl: 'https://lease.invalid/image.png?utm_source=fixture' },
        ],
      };
      await assert.rejects(submit.submit(row.id, success, nextExecution), /SOURCE_NOT_ALLOWED/);
      await sources.update(
        { id: source.id },
        { is_active: true, robots_allowed: true, robots_checked_at: new Date() }
      );
      await assert.rejects(
        submit.submit(
          row.id,
          { ...success, canonicalUrl: 'https://wrong.invalid/1' },
          nextExecution
        ),
        /SOURCE_NOT_ALLOWED/
      );
      await assert.rejects(
        submit.submit(
          row.id,
          {
            ...success,
            imageCandidates: [{ position: 2, remoteUrl: 'https://lease.invalid/i.png' }],
          },
          nextExecution
        ),
        /VALIDATION_FAILED/
      );
      await assert.rejects(
        first.get(UnitOfWork).transaction(async () => {
          await submit.submit(row.id, success, nextExecution);
          throw new Error('fixture receipt failure');
        }),
        /fixture receipt failure/
      );
      assert.equal((await candidates.findOneByOrFail({ id: row.id })).status, 'RUNNING');
      assert.equal(
        (await sources.findOneByOrFail({ id: source.id })).last_error_code,
        'FETCH_TIMEOUT'
      );
      const completed = await submit.submit(row.id, success, nextExecution);
      assert.equal(completed.status, 'NEW');
      assert.equal(completed.lockVersion, 6);
      assert.equal(completed.images.length, 1);
      const detail = await first.get(CollectionService).detail(row.id);
      assert.equal(detail.images[0]?.remoteUrl, 'https://lease.invalid/image.png');
      assert.equal(detail.candidate.leaseUntil, null);
      assert.deepEqual(detail.candidate.warnings, ['FIXTURE_WARNING']);
      assert.ok(detail.candidate.resultPayloadSha256?.equals(collectionDigest(success)));
      assert.equal((await sources.findOneByOrFail({ id: source.id })).consecutive_error_count, 0);
      await assert.rejects(
        submit.submit(row.id, success, nextExecution),
        /CANDIDATE_LEASE_CONFLICT/
      );
    }
  );

  await t.test(
    'preview upload commits raw digest and receipt atomically, compensates rollback and preserves a lost-ack object',
    async () => {
      const row = await candidate(),
        execution = randomUUID();
      await a.claim(
        { candidateId: Number(row.id), maxItems: 1, collectorId: 'spring', leaseSeconds: 60 },
        execution
      );
      const result = await first
        .get(CollectorResultService)
        .submit(
          row.id,
          {
            collectorId: 'spring',
            collectorExecutionId: execution,
            lockVersion: 2,
            status: 'NEW',
            title: 'Preview fixture',
            canonicalUrl: row.origin_url,
            sourcePublishedAt: null,
            parserVersion: 'fixture-v1',
            warnings: [],
            imageCandidates: [{ position: 1, remoteUrl: 'https://lease.invalid/preview.png' }],
          },
          execution
        );
      const imageId = result.images[0]?.id;
      assert.ok(imageId);
      const bytes = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#00a19b' },
      })
        .png()
        .toBuffer();
      const file = { bytes, mime: 'image/png' };
      const receipt = () => ({
        collectorId: 'spring',
        operation: 'collectorUploadPreview',
        keyHash: randomBytes(32),
        requestHash: randomBytes(32),
      });
      const body = { collectorId: 'spring', lockVersion: 3 };
      const preview = first.get(CollectorPreviewService);
      await assert.rejects(
        preview.upload(row.id, imageId, body, file, {
          executionId: randomUUID(),
          receipt: receipt(),
        }),
        /CANDIDATE_EXECUTION_CONFLICT/
      );
      class FailingReceipt extends TypeOrmCollectorReceiptRepository {
        override async save() {
          throw new Error('fixture receipt rollback');
        }
      }
      const failing = new CollectorPreviewService(
        first.get(CollectionRepository),
        storage,
        first.get(UnitOfWork),
        first.get(OutboxRepository),
        new FailingReceipt(first.get(DatabaseContext))
      );
      await assert.rejects(
        failing.upload(row.id, imageId, body, file, { executionId: execution, receipt: receipt() }),
        /DEPENDENCY_UNAVAILABLE/
      );
      assert.equal((await storage.inventory('private')).length, 0);
      assert.equal(
        (await first.get(CollectionService).detail(row.id)).images[0]?.previewStorageKey,
        null
      );
      const key = receipt();
      const uploaded = await preview.upload(row.id, imageId, body, file, {
        executionId: execution.toUpperCase(),
        receipt: key,
      });
      assert.equal(uploaded.lockVersion, 4);
      assert.deepEqual(
        (await first.get(CollectorReceiptRepository).find('spring', key.operation, key.keyHash))
          ?.data,
        uploaded
      );
      const detail = await first.get(CollectionService).detail(row.id);
      assert.ok(
        detail.images[0]?.previewSourceSha256?.equals(createHash('sha256').update(bytes).digest())
      );
      assert.ok(detail.images[0]?.previewUploadedAt);
      const actual = first.get(UnitOfWork);
      class LostAcknowledgment extends UnitOfWork {
        async transaction<T>(work: () => Promise<T>, options?: TransactionOptions): Promise<T> {
          await actual.transaction(work, options);
          throw new Error('fixture lost commit acknowledgment');
        }
        transactionLock(key: string, wait?: boolean) {
          return actual.transactionLock(key, wait);
        }
        lock<T>(key: string | number, work: () => Promise<T>, wait?: boolean) {
          return actual.lock(key, work, wait);
        }
      }
      const lost = new CollectorPreviewService(
        first.get(CollectionRepository),
        storage,
        new LostAcknowledgment(),
        first.get(OutboxRepository),
        first.get(CollectorReceiptRepository)
      );
      const secondKey = receipt();
      await assert.rejects(
        lost.upload(row.id, imageId, { ...body, lockVersion: 4 }, file, {
          executionId: execution,
          receipt: secondKey,
        }),
        /DEPENDENCY_UNAVAILABLE/
      );
      const committed = await first.get(CollectionService).detail(row.id);
      assert.equal(committed.candidate.lockVersion, 5);
      assert.ok(
        await first
          .get(CollectorReceiptRepository)
          .find('spring', secondKey.operation, secondKey.keyHash)
      );
      const storedKey = committed.images[0]?.previewStorageKey;
      assert.ok(storedKey);
      assert.ok((await storage.get('private', storedKey)).length > 0);
      assert.equal((await storage.inventory('private')).length, 2); // Prior preview remains until its committed outbox deletion runs.
    }
  );

  await t.test(
    'concurrent canonical URL replacement maps the database uniqueness race to the same duplicate conflict',
    async () => {
      const left = await candidate(),
        right = await candidate();
      const leftExecution = randomUUID(),
        rightExecution = randomUUID();
      await a.claim(
        { candidateId: Number(left.id), maxItems: 1, collectorId: 'spring', leaseSeconds: 60 },
        leftExecution
      );
      await b.claim(
        { candidateId: Number(right.id), maxItems: 1, collectorId: 'spring', leaseSeconds: 60 },
        rightExecution
      );
      const body: CollectorResultInput = {
        collectorId: 'spring',
        lockVersion: 2,
        status: 'NEW',
        title: 'Canonical race',
        canonicalUrl: 'https://lease.invalid/canonical-race',
        parserVersion: 'fixture-v1',
        sourcePublishedAt: null,
        warnings: [],
        imageCandidates: [],
      };
      const results = await Promise.allSettled([
        first
          .get(CollectorResultService)
          .submit(left.id, { ...body, collectorExecutionId: leftExecution }, leftExecution),
        second
          .get(CollectorResultService)
          .submit(right.id, { ...body, collectorExecutionId: rightExecution }, rightExecution),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const failure = results.find((result) => result.status === 'rejected');
      assert.ok(failure && failure.status === 'rejected');
      const error: unknown = failure.reason;
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'CANDIDATE_DUPLICATE');
    }
  );
});
