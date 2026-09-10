import { CollectionCleanupService } from '../dist/features/collection/collection-cleanup.service.js';
import { CollectionOperationsService } from '../dist/features/collection/collection-operations.service.js';
import { CollectorQuotaService } from '../dist/features/collection/collector-quota.service.js';
import { canonical } from '../dist/shared/canonical.js';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow, rows, decimalId } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import type { operations } from '@blariyo/contracts/collection-api';
import { contractData } from './contract-response.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { localStorage } from '../dist/adapters/storage.js';

const database = process.env.TEST_NEST_DATABASE_URL;
assert.ok(database);
await test('Nest: original Spring V2 fencing, replay, quota and legacy transition with PostgreSQL', async (t) => {
  const pool = await createDataSource(database).initialize(),
    root = await mkdtemp('/private/tmp/blariyo-v2-'),
    storage = localStorage(root);
  const bearer = randomBytes(32).toString('hex'),
    legacyToken = randomBytes(32).toString('hex');
  const options = {
    storage,
    collectManualUrlEnabled: true,
    collectDiscordCommandEnabled: true,
    collectContractMode: 'SPRING_V2' as const,
    collectorKeySecret: randomBytes(32).toString('hex'),
    collectorTokens: [
      {
        collectorId: 'spring-fixture',
        contractVersion: 'SPRING_V2',
        scopes: ['collector:run', 'collector:read', 'collector:event'],
        tokenSha256: createHash('sha256').update(bearer).digest('hex'),
      },
      {
        collectorId: 'legacy-fixture',
        scopes: ['collect'],
        tokenSha256: createHash('sha256').update(legacyToken).digest('hex'),
      },
    ],
  };
  t.after(() => pool.destroy());
  t.after(() => rm(root, { recursive: true, force: true }));
  const migration = await migrationContext(database);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const app = await createNestApplication({ databaseUrl: database, ...options });
  t.after(async () => {
    await app.close();
  });
  const applySpringTransition = () => app.get(CollectionOperationsService).applyTransition();
  const inspectSpringTransition = () => app.get(CollectionOperationsService).inspectTransition();
  const collectionService = () => ({ cleanup: () => app.get(CollectionCleanupService).run() });
  const springCollectionService = () => app.get(CollectorQuotaService);
  await t.test(
    'legacy running and preview rows block strict transition without backfill',
    async () => {
      const source = requiredRow(
        await pool.query(
          "INSERT INTO collect.source(name,base_url,host,is_active,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES('legacy fixture','https://legacy.invalid','legacy.invalid',false,1000,100,'system:migration','system:migration') RETURNING id"
        )
      ).id;
      const legacy = requiredRow(
        await pool.query(
          "INSERT INTO collect.candidate(source_id,origin_url,origin_url_sha256,status,collector_id,claimed_at,lease_until,created_by,updated_by) VALUES($1,'https://legacy.invalid/post/1',$2,'RUNNING','legacy-fixture',now(),now()+interval '1 minute','system:migration','system:migration') RETURNING id",
          [source, randomBytes(32)]
        )
      ).id;
      await assert.rejects(applySpringTransition(), /LEGACY_DRAIN_REQUIRED/);
      assert.equal(
        requiredRow(
          await pool.query('SELECT collector_execution_id FROM collect.candidate WHERE id=$1', [
            legacy,
          ])
        ).collector_execution_id,
        null
      );
      await pool.query(
        "UPDATE collect.candidate SET status='FETCH_FAILED',fetch_error_code='LEASE_EXPIRED',lease_until=NULL,fetched_at=now() WHERE id=$1",
        [legacy]
      );
      await pool.query(
        "INSERT INTO collect.candidate_image(candidate_id,position,remote_url,preview_storage_key,preview_expires_at,created_by,updated_by) VALUES($1,1,'https://legacy.invalid/image.png','collect-preview/legacy-fixture.png',now()-interval '1 second','system:migration','system:migration')",
        [legacy]
      );
      await assert.rejects(applySpringTransition(), /LEGACY_DRAIN_REQUIRED/);
      await collectionService().cleanup();
      assert.equal((await inspectSpringTransition()).legacyPreviews, 0);
    }
  );
  assert.equal((await inspectSpringTransition()).strict, false);
  await applySpringTransition();
  assert.equal((await applySpringTransition()).strict, true);
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/internal/collect';
  async function request(
    path: string,
    body?: unknown,
    {
      key = randomUUID(),
      token = bearer,
      method = body ? 'POST' : 'GET',
      headers = {},
    }: {
      key?: string | null;
      token?: string;
      method?: string;
      headers?: Record<string, string>;
    } = {}
  ) {
    const multipart = body instanceof FormData;
    const res = await fetch(base + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
    const parsed: unknown = await res.json();
    return {
      path: new URL(res.url).pathname,
      method,
      status: res.status,
      body: parsed,
      headers: res.headers,
    };
  }
  const data = <K extends keyof operations>(
    name: K,
    response: Awaited<ReturnType<typeof request>>
  ) => contractData(name, response.path, response.status, response.body, response.method);
  const source = decimalId(
    requiredRow(
      await pool.query(
        "INSERT INTO collect.source(name,base_url,host,is_active,robots_allowed,robots_checked_at,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES('fixture','https://fixture.invalid','fixture.invalid',true,true,now(),1000,1,'system:migration','system:migration') RETURNING id"
      )
    ).id
  );
  let id: number, version: number, imageId: number;
  let claimBody: Record<string, unknown>, resultBody: Record<string, unknown>;
  let execution = randomUUID();
  const job = randomUUID(),
    claimKey = randomUUID(),
    resultKey = randomUUID();
  await t.test(
    'contract mode rejects legacy mutations and V2 requires execution and replay key',
    async () => {
      assert.equal(
        (
          await request(
            '/candidates/claim',
            { collectorId: 'legacy-fixture', maxItems: 1, leaseSeconds: 180 },
            { token: legacyToken }
          )
        ).status,
        403
      );
      assert.equal(
        (
          await request('/candidates/claim', {
            collectorId: 'spring-fixture',
            maxItems: 1,
            leaseSeconds: 180,
          })
        ).status,
        400
      );
      const created = await request('/candidates', {
        collectorId: 'spring-fixture',
        originUrl: 'https://fixture.invalid/post/1',
      });
      assert.equal(created.status, 202, JSON.stringify(created.body));
      id = data('collectorCreateCandidate', created).candidateId;
      claimBody = {
        collectorId: 'spring-fixture',
        candidateId: id,
        maxItems: 1,
        leaseSeconds: 180,
        mode: 'COLLECT',
        jobRequestId: job,
        collectorExecutionId: execution,
      };
      assert.equal((await request('/candidates/claim', claimBody, { key: null })).status, 400);
    }
  );
  await t.test(
    'lost claim/heartbeat responses replay once and receipts contain no original URL',
    async () => {
      const first = await request('/candidates/claim', claimBody, { key: claimKey });
      assert.equal(first.status, 200, JSON.stringify(first.body));
      const again = await request('/candidates/claim', claimBody, { key: claimKey });
      assert.deepEqual(data('collectorClaim', again), data('collectorClaim', first));
      const claimed = data('collectorClaim', first).items[0];
      assert.ok(claimed);
      version = claimed.lockVersion;
      assert.equal(
        (await request('/candidates/claim', { ...claimBody, leaseSeconds: 181 }, { key: claimKey }))
          .status,
        409
      );
      const body = {
          collectorId: 'spring-fixture',
          collectorExecutionId: execution,
          lockVersion: version,
          leaseSeconds: 180,
        },
        key = randomUUID();
      const hb = await request(`/candidates/${id}/heartbeat`, body, { key });
      assert.equal(hb.status, 200, JSON.stringify(hb.body));
      assert.deepEqual(
        data('collectorHeartbeat', await request(`/candidates/${id}/heartbeat`, body, { key })),
        data('collectorHeartbeat', hb)
      );
      version = data('collectorHeartbeat', hb).lockVersion;
      const receipts = JSON.stringify(
        rows(await pool.query('SELECT response_body FROM collect.collector_receipt'))
      );
      assert.equal(receipts.includes('https://'), false);
      const wrong = await request(
        `/candidates/${id}/execution-state?collectorExecutionId=${randomUUID()}`
      );
      assert.equal(wrong.status, 409);
      assert.equal(JSON.stringify(wrong.body).includes(execution), false);
    }
  );
  await t.test(
    '100 parallel reservations cannot overspend; replay keeps permit and source interval survives date change',
    async () => {
      const service = springCollectionService();
      const body = {
        collectorId: 'spring-fixture',
        collectorExecutionId: execution,
        jobRequestId: job,
        candidateId: id,
        lockVersion: version,
        requestKey: 'permit-1',
        requestKind: 'DETAIL' as const,
      };
      const keys = Array.from({ length: 100 }, () => randomUUID());
      const results = await Promise.allSettled(
        keys.map((key, n) =>
          service.reserve(source, 'spring-fixture', key, { ...body, requestKey: 'permit-' + n })
        )
      );
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(
        results.filter((r) => {
          if (r.status !== 'rejected') return false;
          const reason: unknown = r.reason;
          return (
            typeof reason === 'object' &&
            reason !== null &&
            'status' in reason &&
            reason.status === 429
          );
        }).length,
        99
      );
      const n = results.findIndex((r) => r.status === 'fulfilled');
      const winner = results[n];
      assert.ok(winner);
      assert.equal(winner.status, 'fulfilled');
      const saved = winner.value;
      const winningKey = keys[n];
      assert.ok(winningKey);
      const replay = await service.reserve(source, 'spring-fixture', winningKey, {
        ...body,
        requestKey: 'permit-' + n,
      });
      assert.equal(replay.reservationId, saved.reservationId);
      assert.equal(replay.validUntil, saved.validUntil);
      assert.equal(
        requiredRow(await pool.query('SELECT reserved_count FROM collect.source_request_budget'))
          .reserved_count,
        1
      );
      for (const change of ['is_active=false', 'robots_allowed=false', "host='changed.invalid'"]) {
        await pool.query('UPDATE collect.source SET ' + change + ' WHERE id=$1', [source]);
        await assert.rejects(
          service.reserve(source, 'spring-fixture', winningKey, {
            ...body,
            requestKey: 'permit-' + n,
          }),
          { status: 403 }
        );
        await pool.query(
          "UPDATE collect.source SET is_active=true,robots_allowed=true,host='fixture.invalid' WHERE id=$1",
          [source]
        );
      }
      assert.equal(
        requiredRow(await pool.query('SELECT reserved_count FROM collect.source_request_budget'))
          .reserved_count,
        1
      );
      // A new daily row never clears the global source next-request boundary.
      await pool.query('UPDATE collect.source_request_budget SET budget_date=budget_date-1');
      const rate = await request(`/sources/${source}/request-reservations`, {
        ...body,
        requestKey: 'next-day',
      });
      assert.equal(rate.status, 429);
      assert.ok(Number(rate.headers.get('retry-after')) >= 1);
    }
  );
  await t.test(
    'result and preview response-loss replay preserve version and reject stale execution',
    async () => {
      resultBody = {
        collectorId: 'spring-fixture',
        collectorExecutionId: execution,
        lockVersion: version,
        status: 'NEW',
        title: 'fixture title',
        canonicalUrl: 'https://fixture.invalid/post/1',
        sourcePublishedAt: null,
        parserVersion: 'fixture-v1',
        warnings: [],
        imageCandidates: [{ position: 1, remoteUrl: 'https://fixture.invalid/image.png' }],
      };
      assert.equal(
        (
          await request(`/candidates/${id}/result`, {
            ...resultBody,
            collectorExecutionId: randomUUID(),
          })
        ).status,
        409
      );
      const result = await request(`/candidates/${id}/result`, resultBody, { key: resultKey });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.deepEqual(
        data(
          'collectorResult',
          await request(`/candidates/${id}/result`, resultBody, { key: resultKey })
        ),
        data('collectorResult', result)
      );
      version = data('collectorResult', result).lockVersion;
      const resultImage = data('collectorResult', result).imageCandidates[0];
      assert.ok(resultImage);
      imageId = resultImage.candidateImageId;
      assert.equal((await request('/candidates/claim', claimBody, { key: claimKey })).status, 409);
      const bytes = await sharp({
        create: { width: 4, height: 4, channels: 3, background: 'red' },
      })
        .png()
        .toBuffer();
      const form = () => {
        const f = new FormData();
        f.set('collectorId', 'spring-fixture');
        f.set('collectorExecutionId', execution);
        f.set('lockVersion', String(version));
        f.set('file', new Blob([Uint8Array.from(bytes)], { type: 'image/png' }), 'fixture.png');
        return f;
      };
      const key = randomUUID(),
        headers = { 'X-Content-SHA256': createHash('sha256').update(bytes).digest('hex') };
      const first = await request(`/candidates/${id}/images/${imageId}/preview`, form(), {
        key,
        headers,
      });
      assert.equal(first.status, 200, JSON.stringify(first.body));
      const again = await request(`/candidates/${id}/images/${imageId}/preview`, form(), {
        key,
        headers,
      });
      assert.deepEqual(
        data('collectorUploadPreview', again),
        data('collectorUploadPreview', first)
      );
      assert.equal((await storage.inventory('private')).length, 1);
      const state = await request(
        `/candidates/${id}/execution-state?collectorExecutionId=${execution}`
      );
      assert.equal(state.status, 200, JSON.stringify(state.body));
      const executionState = data('collectorExecutionState', state);
      assert.ok('images' in executionState);
      const previewImage = executionState.images[0];
      assert.ok(previewImage);
      assert.equal(previewImage.previewSourceSha256, headers['X-Content-SHA256']);
      assert.equal(
        JSON.stringify(data('collectorExecutionState', state)).includes('fixture.invalid'),
        false
      );
      version = executionState.lockVersion;
    }
  );
  await t.test(
    'refresh fences previous execution, event replay deduplicates and status never claims',
    async () => {
      await pool.query(
        "UPDATE collect.candidate_image SET preview_expires_at=now()-interval '1 second' WHERE id=$1",
        [imageId]
      );
      const previous = execution;
      execution = randomUUID();
      const key = randomUUID();
      const body = {
        ...claimBody,
        mode: 'PREVIEW_REFRESH',
        collectorExecutionId: execution,
        lockVersion: version,
      };
      const refresh = await request('/candidates/claim', body, { key });
      assert.equal(refresh.status, 200, JSON.stringify(refresh.body));
      const refreshed = data('collectorClaim', refresh).items[0];
      assert.ok(refreshed);
      assert.ok('images' in refreshed);
      assert.equal(refreshed.images.length, 1);
      assert.deepEqual(
        data('collectorClaim', await request('/candidates/claim', body, { key })),
        data('collectorClaim', refresh)
      );
      assert.equal(
        (await request(`/candidates/${id}/execution-state?collectorExecutionId=${previous}`))
          .status,
        409
      );
      const event = {
        collectorId: 'spring-fixture',
        jobRequestId: job,
        candidateId: id,
        deliveryId: randomUUID(),
        eventCode: 'NOTIFICATION_FINAL_FAILED',
        severity: 'WARN',
        occurredAt: new Date().toISOString(),
        attemptCount: 4,
      };
      const first = await request('/operational-events', event);
      assert.equal(first.status, 202, JSON.stringify(first.body));
      const again = await request('/operational-events', event);
      assert.equal(
        data('collectorOperationalEvent', again).eventId,
        data('collectorOperationalEvent', first).eventId
      );
      assert.equal(data('collectorOperationalEvent', again).deduplicated, true);
      assert.equal(
        (await request('/operational-events', { ...event, severity: 'ERROR' })).status,
        409
      );
      const status = await request('/status');
      assert.equal(status.status, 200, JSON.stringify(status.body));
      assert.equal(data('collectorStatus', status).candidateCounts.new, 1);
      assert.equal(status.headers.get('cache-control'), 'private, no-store');
    }
  );
  await t.test(
    'expired receipts retain result digest; candidate expiry preserves generalized quota and events',
    async () => {
      await pool.query("UPDATE collect.collector_receipt SET expires_at=now()-interval '1 second'");
      await collectionService().cleanup();
      assert.equal(
        requiredRow(
          await pool.query('SELECT count(*)::integer AS count FROM collect.collector_receipt')
        ).count,
        0
      );
      const state = await request(
        `/candidates/${id}/execution-state?collectorExecutionId=${execution}`
      );
      const executionState = data('collectorExecutionState', state);
      assert.ok('resultPayloadSha256' in executionState);
      assert.equal(
        executionState.resultPayloadSha256,
        createHash('sha256')
          .update(JSON.stringify(canonical(resultBody)))
          .digest('hex')
      );
      assert.equal(
        (await request(`/candidates/${id}/result`, resultBody, { key: resultKey })).status,
        409
      );
      await pool.query(
        "UPDATE collect.candidate SET fetched_at=now()-interval '31 days' WHERE id=$1",
        [id]
      );
      await collectionService().cleanup();
      assert.equal(
        requiredRow(
          await pool.query('SELECT count(*)::integer AS count FROM collect.candidate WHERE id=$1', [
            id,
          ])
        ).count,
        0
      );
      assert.equal(
        requiredRow(await pool.query('SELECT candidate_id FROM collect.source_request_reservation'))
          .candidate_id,
        null
      );
      assert.equal(
        requiredRow(
          await pool.query('SELECT candidate_id FROM collect.collector_operational_event')
        ).candidate_id,
        null
      );
    }
  );
});
