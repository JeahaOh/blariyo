import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import sharp from 'sharp';
import { createPool } from '../apps/api/src/db.mjs';
import { migrate } from '../apps/api/src/migrate.mjs';
import { createApp } from '../apps/api/src/app.mjs';
import { localStorage } from '../apps/api/src/storage.mjs';
import { collectionService } from '../apps/api/src/collection.mjs';
const database = process.env.TEST_COLLECTION_DATABASE_URL;
test(
  'collection lifecycle, isolation and transactional promotion',
  { skip: !database },
  async (t) => {
    const pool = createPool(database);
    await migrate(pool);
    const storage = localStorage(await mkdtemp('/private/tmp/blariyo-collect-'));
    const token = randomBytes(32).toString('hex'),
      bearer = randomBytes(32).toString('hex'),
      actor = 'admin:v1:' + randomBytes(32).toString('base64url');
    const options = {
      storage,
      serviceToken: token,
      collectManualUrlEnabled: true,
      collectDiscordCommandEnabled: true,
      collectorTokens: [
        {
          collectorId: 'fixture',
          tokenSha256: createHash('sha256').update(bearer).digest('hex'),
          scopes: ['collect'],
        },
      ],
    };
    const server = createApp(pool, options).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await pool.end();
    });
    const request = async (
      path,
      {
        body,
        method = body ? 'POST' : 'GET',
        key = randomUUID(),
        machine = false,
        auth = true,
      } = {}
    ) => {
      const headers = auth
        ? machine
          ? { authorization: 'Bearer ' + bearer }
          : { 'X-Blariyo-Service-Token': token, 'X-Blariyo-Admin-Actor': actor }
        : {};
      headers['Idempotency-Key'] = key;
      if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
      const r = await fetch(
        `http://127.0.0.1:${server.address().port}${machine ? '/internal/collect' : '/api/v1/admin/collect'}${path}`,
        {
          method,
          headers,
          body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        }
      );
      return {
        status: r.status,
        body: r.headers.get('content-type')?.includes('json')
          ? await r.json()
          : await r.arrayBuffer(),
      };
    };
    const ok = (r, status = 200) => {
      assert.equal(r.status, status, JSON.stringify(r));
      return r.body.data;
    };
    const machine = (path, body, key) => request(path, { machine: true, body, key });
    const create = async (n) =>
      ok(
        await request('/candidates', { body: { originUrl: `https://fixture.example/${n}` } }),
        202
      );
    const claim = async (candidateId) =>
      ok(
        await machine('/candidates/claim', {
          collectorId: 'fixture',
          maxItems: 1,
          leaseSeconds: 60,
          candidateId,
        })
      ).items[0];
    await pool.query(
      "INSERT INTO collect.source(name,base_url,host,is_active,robots_allowed,robots_checked_at,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES('Fixture','https://fixture.example','fixture.example',true,true,now(),1000,100,'system:migration','system:migration')"
    );
    let c, claimed, result, img, preview;
    await t.test('authentication and normalized URL idempotency', async () => {
      assert.equal((await request('/sources', { auth: false })).status, 401);
      assert.equal(
        (await request('/candidates/claim', { machine: true, auth: false, body: {} })).status,
        401
      );
      assert.equal(
        (
          await machine('/candidates/claim', {
            collectorId: 'other',
            maxItems: 1,
            leaseSeconds: 60,
          })
        ).status,
        403
      );
      const body = { originUrl: 'https://fixture.example/1/?utm_source=test#x' },
        key = randomUUID();
      c = ok(await request('/candidates', { body, key }), 202);
      assert.deepEqual(ok(await request('/candidates', { body, key }), 202), c);
      assert.equal((await createDuplicate()).status, 409);
      async function createDuplicate() {
        return request('/candidates', { body: { originUrl: 'https://fixture.example/1' } });
      }
      assert.equal(
        (await request('/candidates', { body: { originUrl: 'https://unknown.example/1' } })).status,
        403
      );
    });
    await t.test('exclusive claim, lease ownership and result replay', async () => {
      const results = await Promise.all([claim(c.candidateId), claim(c.candidateId)]);
      assert.equal(results.filter(Boolean).length, 1);
      claimed = results.find(Boolean);
      const heartbeat = ok(
        await machine(`/candidates/${c.candidateId}/heartbeat`, {
          collectorId: 'fixture',
          lockVersion: claimed.lockVersion,
          leaseSeconds: 60,
        })
      );
      assert.equal(heartbeat.source.host, 'fixture.example');
      const body = {
          collectorId: 'fixture',
          lockVersion: heartbeat.lockVersion,
          status: 'NEW',
          canonicalUrl: 'https://fixture.example/1',
          title: '검수할 제목',
          parserVersion: 'fixture-v1',
          sourcePublishedAt: null,
          warnings: [],
          imageCandidates: [{ position: 1, remoteUrl: 'https://images.example/1.png' }],
        },
        key = randomUUID();
      result = ok(await machine(`/candidates/${c.candidateId}/result`, body, key));
      assert.deepEqual(ok(await machine(`/candidates/${c.candidateId}/result`, body, key)), result);
      assert.equal((await machine(`/candidates/${c.candidateId}/result`, body)).status, 409);
      img = result.imageCandidates[0];
    });
    await t.test('private preview validation and atomic draft creation', async () => {
      const bytes = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#319a41' },
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.set('collectorId', 'fixture');
      form.set('lockVersion', String(result.lockVersion));
      form.set('file', new Blob([bytes], { type: 'image/png' }), 'fixture.png');
      preview = ok(
        await request(`/candidates/${c.candidateId}/images/${img.candidateImageId}/preview`, {
          machine: true,
          body: form,
        })
      );
      assert.equal(
        (
          await request(`/candidates/${c.candidateId}/images/${img.candidateImageId}/preview`, {
            auth: false,
          })
        ).status,
        401
      );
      assert.equal(
        (await request(`/candidates/${c.candidateId}/images/${img.candidateImageId}/preview`))
          .status,
        200
      );
      const body = {
        lockVersion: preview.lockVersion,
        boardSlug: 'meme',
        candidateImageIds: [img.candidateImageId],
        imageOptions: [{ candidateImageId: img.candidateImageId, alt: '초록 이미지' }],
        acknowledgeDuplicate: false,
      };
      const key = randomUUID(),
        draft = ok(await request(`/candidates/${c.candidateId}/draft`, { body, key }), 201);
      assert.deepEqual(
        ok(await request(`/candidates/${c.candidateId}/draft`, { body, key }), 201),
        draft
      );
      assert.equal(
        (await pool.query('SELECT status FROM collect.candidate WHERE id=$1', [c.candidateId]))
          .rows[0].status,
        'APPROVED'
      );
      assert.equal(
        (await pool.query('SELECT status FROM content.board_post WHERE id=$1', [draft.postId]))
          .rows[0].status,
        'DRAFT'
      );
      assert.equal(
        (await request(`/candidates/${c.candidateId}/images/${img.candidateImageId}/preview`))
          .status,
        404
      );
      assert.equal(ok(await request('/candidates')).items.length, 1);
    });
    await t.test(
      'lease expiry rejects stale results and draft rollback preserves candidate',
      async () => {
        const next = await create(3),
          old = await claim(next.candidateId);
        await pool.query(
          "UPDATE collect.candidate SET lease_until=now()-interval '1 second' WHERE id=$1",
          [next.candidateId]
        );
        const fresh = await claim(next.candidateId);
        assert.ok(fresh.lockVersion > old.lockVersion);
        const body = {
          collectorId: 'fixture',
          lockVersion: old.lockVersion,
          status: 'NEW',
          canonicalUrl: 'https://fixture.example/3',
          title: '롤백',
          parserVersion: 'fixture-v1',
          sourcePublishedAt: null,
          warnings: [],
          imageCandidates: [{ position: 1, remoteUrl: 'https://images.example/3.png' }],
        };
        assert.equal((await machine(`/candidates/${next.candidateId}/result`, body)).status, 409);
        const done = ok(
          await machine(`/candidates/${next.candidateId}/result`, {
            ...body,
            lockVersion: fresh.lockVersion,
          })
        );
        const bytes = await sharp({
          create: { width: 9, height: 9, channels: 3, background: '#ff1441' },
        })
          .png()
          .toBuffer();
        const form = new FormData();
        form.set('collectorId', 'fixture');
        form.set('lockVersion', String(done.lockVersion));
        form.set('file', new Blob([bytes], { type: 'image/png' }), 'fixture.png');
        const image = done.imageCandidates[0],
          preview = ok(
            await request(
              `/candidates/${next.candidateId}/images/${image.candidateImageId}/preview`,
              { machine: true, body: form }
            )
          );
        const draft = {
          lockVersion: preview.lockVersion,
          boardSlug: 'missing',
          candidateImageIds: [image.candidateImageId],
          imageOptions: [{ candidateImageId: image.candidateImageId, alt: '롤백 이미지' }],
          acknowledgeDuplicate: false,
        };
        const before = (await pool.query('SELECT count(*) FROM content.board_post')).rows[0].count;
        assert.equal(
          (await request(`/candidates/${next.candidateId}/draft`, { body: draft })).status,
          404
        );
        assert.equal(
          (await pool.query('SELECT count(*) FROM content.board_post')).rows[0].count,
          before
        );
        assert.equal(ok(await request(`/candidates/${next.candidateId}`)).status, 'NEW');
        assert.equal(
          (
            await request(
              `/candidates/${next.candidateId}/images/${image.candidateImageId}/preview`
            )
          ).status,
          200
        );
        const rejected = ok(
          await request(`/candidates/${next.candidateId}/reject`, {
            body: { lockVersion: preview.lockVersion, reasonCode: 'OTHER' },
          })
        );
        assert.equal(rejected.status, 'REJECTED');
        assert.equal(
          (
            await request(
              `/candidates/${next.candidateId}/images/${image.candidateImageId}/preview`
            )
          ).status,
          404
        );
      }
    );
    await t.test('expired runs stop after three attempts or 24 hours', async () => {
      const limited = await create(4);
      for (let attempt = 1; attempt <= 3; attempt++) {
        const job = await claim(limited.candidateId);
        assert.equal(job.attemptCount, attempt);
        await pool.query(
          "UPDATE collect.candidate SET lease_until=now()-interval '1 second' WHERE id=$1",
          [limited.candidateId]
        );
      }
      assert.equal(await claim(limited.candidateId), undefined);
      const exhausted = ok(await request(`/candidates/${limited.candidateId}`));
      assert.equal(exhausted.status, 'FETCH_FAILED');
      assert.equal(exhausted.fetchErrorCode, 'LEASE_EXPIRED');

      const stale = await create(5);
      await pool.query(
        "UPDATE collect.candidate SET requested_at=now()-interval '25 hours' WHERE id=$1",
        [stale.candidateId]
      );
      const staleJob = await claim(stale.candidateId);
      assert.equal(staleJob.attemptCount, 1);
      await pool.query(
        "UPDATE collect.candidate SET lease_until=now()-interval '1 second' WHERE id=$1",
        [stale.candidateId]
      );
      assert.equal(await claim(stale.candidateId), undefined);
      const expired = ok(await request(`/candidates/${stale.candidateId}`));
      assert.equal(expired.status, 'FETCH_FAILED');
      assert.equal(expired.fetchErrorCode, 'LEASE_EXPIRED');
    });
    await t.test('failure retry, source version conflict and retention', async () => {
      const next = await create(2),
        job = await claim(next.candidateId);
      const failed = ok(
        await machine(`/candidates/${next.candidateId}/result`, {
          collectorId: 'fixture',
          lockVersion: job.lockVersion,
          status: 'FETCH_FAILED',
          fetchErrorCode: 'PARSER_FAILED',
          warnings: [],
        })
      );
      await pool.query(
        "UPDATE collect.candidate SET requested_at=now()-interval '25 hours' WHERE id=$1",
        [next.candidateId]
      );
      const retry = ok(
        await request(`/candidates/${next.candidateId}/retry`, {
          body: { lockVersion: failed.lockVersion },
        })
      );
      assert.equal(retry.status, 'PENDING');
      const retryCycle = (
        await pool.query('SELECT attempt_count,requested_at FROM collect.candidate WHERE id=$1', [
          next.candidateId,
        ])
      ).rows[0];
      assert.equal(retryCycle.attempt_count, 0);
      assert.ok(Date.now() - retryCycle.requested_at.getTime() < 10000);
      const s = ok(await request('/sources')).items[0];
      ok(
        await request(`/sources/${s.sourceId}`, {
          method: 'PATCH',
          body: { lockVersion: s.lockVersion, isActive: false },
        })
      );
      assert.equal(
        (
          await request(`/sources/${s.sourceId}`, {
            method: 'PATCH',
            body: { lockVersion: s.lockVersion, isActive: true },
          })
        ).status,
        409
      );
      await collectionService(pool, storage).cleanup();
      assert.equal(ok(await request(`/candidates/${next.candidateId}`)).status, 'PENDING');
      assert.equal((await claim(next.candidateId)).attemptCount, 1);
    });
  }
);
