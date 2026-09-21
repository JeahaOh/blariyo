import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { CollectionOperationsService } from '../dist/features/collection/collection-operations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { localStorage } from '../dist/adapters/storage.js';
import { contractData } from './contract-response.js';
import type { operations } from '@blariyo/contracts/collection-api';

await test('Original content: HTTP result, PostgreSQL readback and transactional ordered draft', async (t) => {
  const database = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(database);
  const migration = await migrationContext(database);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const pool = await createDataSource(database).initialize();
  t.after(() => pool.destroy());
  const directory = await mkdtemp('/private/tmp/blariyo-content-test-');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const token = randomBytes(32).toString('hex'),
    bearer = randomBytes(32).toString('hex');
  const app = await createNestApplication({
    databaseUrl: database,
    storage: localStorage(directory),
    serviceToken: token,
    collectManualUrlEnabled: true,
    collectDiscordCommandEnabled: false,
    collectContractMode: 'SPRING_V2',
    collectorKeySecret: randomBytes(32).toString('hex'),
    collectorTokens: [
      {
        collectorId: 'content-fixture',
        contractVersion: 'SPRING_V2',
        tokenSha256: createHash('sha256').update(bearer).digest('hex'),
        scopes: ['collector:run', 'collector:read'],
      },
    ],
  });
  t.after(() => app.close());
  await app.get(CollectionOperationsService).applyTransition();
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  async function request(
    path: string,
    body?: unknown,
    machine = true,
    key: string = randomUUID(),
    extra: Record<string, string> = {}
  ) {
    const response = await fetch(
      origin + (machine ? '/internal/collect' : '/api/v1/admin/collect') + path,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...(machine
            ? { authorization: 'Bearer ' + bearer }
            : { 'X-Blariyo-Service-Token': token, 'X-Blariyo-Admin-Actor': actor }),
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          'Idempotency-Key': key,
          ...extra,
        },
        ...(body === undefined
          ? {}
          : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      }
    );
    const value: unknown = await response.json();
    return {
      path: new URL(response.url).pathname,
      method: body === undefined ? 'GET' : 'POST',
      status: response.status,
      body: value,
    };
  }
  const ok = <K extends keyof operations>(
    operation: K,
    response: Awaited<ReturnType<typeof request>>,
    status = 200
  ) => {
    assert.equal(response.status, status, JSON.stringify(response.body));
    return contractData(operation, response.path, response.status, response.body, response.method);
  };
  await pool.query(
    "INSERT INTO collect.source(name,base_url,host,is_active,robots_allowed,robots_checked_at,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES('Content fixture','https://fixture.invalid','fixture.invalid',true,true,now(),1000,100,'system:migration','system:migration')"
  );
  async function start() {
    const url = 'https://fixture.invalid/post/' + randomUUID();
    const created = ok(
      'collectorCreateCandidate',
      await request('/candidates', { collectorId: 'content-fixture', originUrl: url }),
      202
    );
    const execution = randomUUID();
    const claimed = ok(
      'collectorClaim',
      await request('/candidates/claim', {
        collectorId: 'content-fixture',
        collectorExecutionId: execution,
        jobRequestId: randomUUID(),
        mode: 'COLLECT',
        candidateId: created.candidateId,
        maxItems: 1,
        leaseSeconds: 180,
      })
    ).items[0];
    assert.ok(claimed);
    return {
      id: created.candidateId,
      execution,
      body: {
        collectorId: 'content-fixture',
        collectorExecutionId: execution,
        lockVersion: claimed.lockVersion,
        status: 'NEW',
        title: '원문 제목',
        canonicalUrl: url,
        sourcePublishedAt: null,
        parserVersion: 'fixture-original-v1',
        warnings: [],
      },
    };
  }
  const blocks = [
    { type: 'TEXT', text: '첫 문단 전체' },
    { type: 'IMAGE', imagePosition: 1, alt: '원문 사진' },
    { type: 'TEXT', text: '이미지 뒤 문단' },
    { type: 'LINK', url: 'https://www.youtube.com/watch?v=Abcdefghijk', label: '' },
    { type: 'LINK', url: 'https://x.com/user/status/123', label: '' },
  ];
  await t.test(
    'reject broken references, replay exact content and require every attachment',
    async () => {
      const c = await start(),
        path = `/candidates/${c.id}/result`;
      const body = {
        ...c.body,
        contentBlocks: blocks,
        imageCandidates: [{ position: 1, remoteUrl: 'https://cdn.invalid/image.png' }],
      };
      assert.equal(
        (
          await request(path, {
            ...body,
            contentBlocks: [{ type: 'IMAGE', imagePosition: 2, alt: '' }],
          })
        ).status,
        400
      );
      assert.equal(
        (
          await request(path, {
            ...body,
            contentBlocks: [{ type: 'LINK', url: 'javascript:alert(1)', label: '' }],
          })
        ).status,
        400
      );
      const key = randomUUID();
      const result = ok('collectorResult', await request(path, body, true, key));
      assert.deepEqual(ok('collectorResult', await request(path, body, true, key)), result);
      assert.equal((await request(path, { ...body, title: 'changed' }, true, key)).status, 409);
      assert.deepEqual(
        requiredRow(
          await pool.query('SELECT content_blocks FROM collect.candidate WHERE id=$1', [c.id])
        ).content_blocks,
        blocks
      );
      assert.deepEqual(
        ok('getCollectionCandidate', await request(`/candidates/${c.id}`, undefined, false))
          .contentBlocks,
        blocks
      );
      const image = result.imageCandidates[0];
      assert.ok(image);
      const promotion = {
        lockVersion: result.lockVersion,
        boardSlug: 'meme',
        candidateImageIds: [image.candidateImageId],
        imageOptions: [{ candidateImageId: image.candidateImageId, alt: '검수한 사진' }],
        acknowledgeDuplicate: false,
      };
      assert.equal(
        (
          await request(
            `/candidates/${c.id}/draft`,
            { ...promotion, candidateImageIds: [], imageOptions: [] },
            false
          )
        ).status,
        400
      );
      assert.equal(
        (
          await request(
            `/candidates/${c.id}/draft`,
            { ...promotion, leadText: '원문 대체 불가' },
            false
          )
        ).status,
        400
      );
      assert.equal((await request(`/candidates/${c.id}/draft`, promotion, false)).status, 409);
      const bytes = await sharp({
        create: { width: 20, height: 20, channels: 3, background: '#238' },
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.append('collectorId', 'content-fixture');
      form.append('collectorExecutionId', c.execution);
      form.append('lockVersion', String(result.lockVersion));
      form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'image.png');
      const preview = ok(
        'collectorUploadPreview',
        await request(
          `/candidates/${c.id}/images/${image.candidateImageId}/preview`,
          form,
          true,
          randomUUID(),
          { 'X-Content-SHA256': createHash('sha256').update(bytes).digest('hex') }
        )
      );
      const draftBody = { ...promotion, lockVersion: preview.lockVersion },
        draftKey = randomUUID();
      const draft = ok(
        'promoteCollectionCandidate',
        await request(`/candidates/${c.id}/draft`, draftBody, false, draftKey),
        201
      );
      assert.deepEqual(
        ok(
          'promoteCollectionCandidate',
          await request(`/candidates/${c.id}/draft`, draftBody, false, draftKey),
          201
        ),
        draft
      );
      const stored = rows(
        await pool.query(
          'SELECT type,text_content,alt_text FROM content.board_post_block WHERE post_id=$1 ORDER BY position',
          [draft.postId]
        )
      );
      assert.deepEqual(
        stored.map((b) => b.type),
        ['TEXT', 'IMAGE', 'TEXT', 'TEXT', 'TEXT']
      );
      assert.equal(stored[0]?.text_content, '첫 문단 전체');
      assert.equal(stored[1]?.alt_text, '검수한 사진');
      assert.equal(stored[3]?.text_content, 'https://www.youtube.com/watch?v=Abcdefghijk');
      assert.equal(stored[4]?.text_content, 'https://x.com/user/status/123');
    }
  );
  await t.test(
    'text and SNS only draft, legacy empty result rejected, rejection clears content',
    async () => {
      const c = await start(),
        content = [
          { type: 'TEXT', text: '이미지 없는 원문' },
          { type: 'LINK', url: 'https://www.instagram.com/p/ABC/', label: '' },
        ];
      assert.equal(
        (await request(`/candidates/${c.id}/result`, { ...c.body, imageCandidates: [] })).status,
        400
      );
      const result = ok(
        'collectorResult',
        await request(`/candidates/${c.id}/result`, {
          ...c.body,
          imageCandidates: [],
          contentBlocks: content,
        })
      );
      const draft = ok(
        'promoteCollectionCandidate',
        await request(
          `/candidates/${c.id}/draft`,
          {
            lockVersion: result.lockVersion,
            boardSlug: 'meme',
            candidateImageIds: [],
            imageOptions: [],
            acknowledgeDuplicate: false,
          },
          false
        ),
        201
      );
      assert.equal(
        rows(
          await pool.query('SELECT id FROM content.board_post_block WHERE post_id=$1', [
            draft.postId,
          ])
        ).length,
        2
      );
      const rejected = await start();
      const r = ok(
        'collectorResult',
        await request(`/candidates/${rejected.id}/result`, {
          ...rejected.body,
          imageCandidates: [],
          contentBlocks: content,
        })
      );
      ok(
        'rejectCollectionCandidate',
        await request(
          `/candidates/${rejected.id}/reject`,
          { lockVersion: r.lockVersion, reasonCode: 'OTHER' },
          false
        )
      );
      assert.equal(
        requiredRow(
          await pool.query('SELECT content_blocks FROM collect.candidate WHERE id=$1', [
            rejected.id,
          ])
        ).content_blocks,
        null
      );
    }
  );
});
