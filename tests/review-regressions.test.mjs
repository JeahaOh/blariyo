import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import sharp from 'sharp';
import { createServer } from 'node:http';
import {
  recordScheduleFailure,
  deliverScheduleAlerts,
  scheduleWebhook,
} from '../apps/api/src/schedule-alerts.mjs';
import { createPool } from '../apps/api/src/db.mjs';
import { migrate } from '../apps/api/src/migrate.mjs';
import { localStorage, localCache } from '../apps/api/src/storage.mjs';
import { imageService } from '../apps/api/src/images.mjs';
import { postService } from '../apps/api/src/posts.mjs';
import { runOutbox, enqueue } from '../apps/api/src/outbox.mjs';
const database = process.env.TEST_REVIEW_DATABASE_URL;
const actor = 'system:scheduler';
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
test(
  'review regressions: publication ownership, stale deletion and scheduled immediate publication',
  { skip: !database },
  async (t) => {
    const pool = createPool(database);
    t.after(() => pool.end());
    await migrate(pool);
    const storage = localStorage(await mkdtemp('/private/tmp/blariyo-review-'));
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    const service = postService(pool, storage);
    async function draft() {
      const uploaded = await imageService(pool, storage).upload(
        [{ bytes, mime: 'image/png' }],
        actor
      );
      return (
        await service.command(
          'create',
          {},
          {
            boardSlug: 'meme',
            title: '회귀 검증',
            source: null,
            pinnedPosition: null,
            blocks: [{ type: 'IMAGE', imageId: uploaded.items[0].imageId, alt: '테스트' }],
          },
          actor
        )
      ).data;
    }
    await t.test(
      'different request keys cannot overtake a paused copy, hide stays private',
      async () => {
        const post = await draft(),
          params = { postId: String(post.postId) };
        const entered = deferred(),
          resume = deferred();
        const slow = postService(pool, {
          ...storage,
          promote: async (...args) => {
            entered.resolve();
            await resume.promise;
            return storage.promote(...args);
          },
        });
        const first = slow.command(
          'publish',
          params,
          { lockVersion: 1, mode: 'IMMEDIATE' },
          actor,
          'A',
          'publish'
        );
        await entered.promise;
        const second = service.command(
          'publish',
          params,
          { lockVersion: 1, mode: 'IMMEDIATE' },
          actor,
          'B',
          'publish'
        );
        const rejected = assert.rejects(second, (e) => e.code === 'POST_VERSION_CONFLICT');
        // Observe the second backend waiting on the advisory lock, not a timing-only assertion.
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          waiting =
            (await pool.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted"))
              .rowCount > 0;
          if (waiting) break;
          await new Promise((r) => setTimeout(r, 5));
        }
        try {
          assert.equal(waiting, true);
          assert.equal((await storage.inventory('public')).length, 0);
        } finally {
          resume.resolve();
        }
        const published = (await first).data;
        await rejected;
        await service.command(
          'hide',
          params,
          { lockVersion: published.lockVersion, reasonCode: 'RIGHTS_EMAIL' },
          actor
        );
        await runOutbox(pool, storage, localCache());
        assert.equal((await service.detail(post.postId)).status, 'HIDDEN_REVIEW');
        assert.equal((await storage.inventory('public')).length, 0);
        assert.equal(
          (
            await pool.query(
              "SELECT 1 FROM ops.outbox_task WHERE type='OBJECT_DELETE_PUBLIC' AND status IN ('PENDING','FAILED','RUNNING')"
            )
          ).rowCount,
          0
        );
        await service.command('republish', params, { lockVersion: 3, pinnedPosition: null }, actor);
        const key = (await storage.inventory('public'))[0].key;
        // A delayed compensation from an older failed attempt must not erase the new publication.
        await enqueue(
          pool,
          'OBJECT_DELETE_PUBLIC',
          'IMAGE',
          (await service.detail(post.postId)).blocks[0].imageId,
          { compensation: true, publicStorageKey: key, publicUrl: 'http://localhost/' + key },
          actor
        );
        await pool.query(
          "UPDATE ops.outbox_task SET status='FAILED',next_attempt_at=now() WHERE type='OBJECT_DELETE_PUBLIC' AND aggregate_type='IMAGE'"
        );
        await runOutbox(pool, storage, localCache());
        assert.equal((await storage.inventory('public')).length, 1);
        assert.equal((await service.detail(post.postId)).blocks[0].status, 'PUBLIC');
      }
    );
    await t.test(
      'copy succeeds but returns failure: durable compensation respects current ownership',
      async () => {
        const post = await draft(),
          params = { postId: String(post.postId) };
        const broken = postService(pool, {
          ...storage,
          promote: async (...args) => {
            await storage.promote(...args);
            throw new Error('copy acknowledgement lost');
          },
        });
        await assert.rejects(
          broken.command('publish', params, { lockVersion: 1, mode: 'IMMEDIATE' }, actor),
          (e) => e.code === 'DEPENDENCY_UNAVAILABLE'
        );
        assert.equal((await service.detail(post.postId)).status, 'DRAFT');
        await runOutbox(pool, storage, localCache());
        assert.equal(
          (await storage.inventory('public')).filter((o) =>
            o.key.startsWith(`posts/${post.postId}/`)
          ).length,
          0
        );
        await service.command('publish', params, { lockVersion: 1, mode: 'IMMEDIATE' }, actor);
        await runOutbox(pool, storage, localCache());
        assert.equal(
          (await storage.inventory('public')).filter((o) =>
            o.key.startsWith(`posts/${post.postId}/`)
          ).length,
          1
        );
      }
    );
    await t.test(
      'DB rollback after copy is compensated; lost commit acknowledgement preserves publication',
      async () => {
        for (const committed of [false, true]) {
          const post = await draft();
          let injected = false;
          const faultyPool = {
            connect: async () => {
              const client = await pool.connect();
              return {
                release: () => client.release(),
                query: async (sql, args) => {
                  if (
                    !injected &&
                    ((!committed && sql.startsWith('UPDATE content.board_post SET')) ||
                      (committed && sql === 'COMMIT'))
                  ) {
                    injected = true;
                    if (committed) await client.query(sql, args);
                    throw new Error('injected DB acknowledgement failure');
                  }
                  return client.query(sql, args);
                },
              };
            },
          };
          await assert.rejects(
            postService(faultyPool, storage).command(
              'publish',
              { postId: String(post.postId) },
              { lockVersion: 1, mode: 'IMMEDIATE' },
              actor
            )
          );
          assert.equal(injected, true);
          assert.equal(
            (await service.detail(post.postId)).status,
            committed ? 'PUBLISHED' : 'DRAFT'
          );
          await runOutbox(pool, storage, localCache());
          assert.equal(
            (await storage.inventory('public')).filter((o) =>
              o.key.startsWith(`posts/${post.postId}/`)
            ).length,
            committed ? 1 : 0
          );
        }
      }
    );
    await t.test(
      'scheduled immediate publish clears schedule and scheduler cannot publish twice',
      async () => {
        const post = await draft(),
          params = { postId: String(post.postId) };
        await service.command(
          'publish',
          params,
          {
            lockVersion: 1,
            mode: 'SCHEDULED',
            scheduledAt: new Date(Date.now() + 120000).toISOString(),
          },
          actor
        );
        await assert.rejects(
          service.command(
            'publish',
            params,
            {
              lockVersion: 2,
              mode: 'SCHEDULED',
              scheduledAt: new Date(Date.now() + 180000).toISOString(),
            },
            actor
          ),
          (e) => e.code === 'POST_STATE_CONFLICT'
        );
        const result = await service.command(
          'publish',
          params,
          { lockVersion: 2, mode: 'IMMEDIATE' },
          actor,
          'scheduled-now',
          'publish'
        );
        assert.equal(result.data.status, 'PUBLISHED');
        assert.equal(result.data.scheduledAt, null);
        assert.ok(result.data.publishedAt);
        assert.equal(result.data.lockVersion, 3);
        assert.deepEqual(
          await service.command(
            'publish',
            params,
            { lockVersion: 2, mode: 'IMMEDIATE' },
            actor,
            'scheduled-now',
            'publish'
          ),
          result
        );
        assert.equal(await service.publishDue(), 0);
        assert.equal(
          (
            await pool.query(
              "SELECT 1 FROM content.board_post_status_history WHERE post_id=$1 AND to_status='PUBLISHED'",
              [post.postId]
            )
          ).rowCount,
          1
        );
      }
    );
    await t.test(
      'scheduler records context and webhook retries survive workers and group repeats',
      async () => {
        const post = await draft();
        await service.command(
          'publish',
          { postId: String(post.postId) },
          {
            lockVersion: 1,
            mode: 'SCHEDULED',
            scheduledAt: new Date(Date.now() + 120000).toISOString(),
          },
          actor
        );
        await pool.query(
          "UPDATE content.board_post SET scheduled_at=now()-interval '1 minute' WHERE id=$1",
          [post.postId]
        );
        const broken = postService(pool, {
          ...storage,
          promote: async () => {
            throw new Error('secret source and identity must not leak');
          },
        });
        const logs = [],
          original = console.error;
        console.error = (value) => logs.push(JSON.parse(value));
        try {
          assert.equal(await broken.publishDue(), 0);
        } finally {
          console.error = original;
        }
        assert.equal(logs.length, 1);
        assert.equal(logs[0].postId, post.postId);
        assert.equal(logs[0].errorCode, 'DEPENDENCY_UNAVAILABLE');
        assert.ok(logs[0].scheduledAt);
        assert.ok(logs[0].attemptedAt);
        assert.ok(!JSON.stringify(logs).includes('secret'));
        assert.equal((await service.detail(post.postId)).status, 'SCHEDULED');
        const received = [];
        let unavailable = true;
        const receiver = createServer(async (req, res) => {
          let body = '';
          for await (const chunk of req) body += chunk;
          received.push(JSON.parse(body));
          res.writeHead(unavailable ? 503 : 204);
          res.end();
        });
        await new Promise((r) => receiver.listen(0, '127.0.0.1', r));
        try {
          const send = scheduleWebhook(`http://127.0.0.1:${receiver.address().port}/fixture`);
          await assert.rejects(deliverScheduleAlerts(pool, send), /DELIVERY_FAILED/);
          assert.equal(
            (
              await pool.query(
                'SELECT notified_count FROM ops.schedule_failure_alert WHERE post_id=$1',
                [post.postId]
              )
            ).rows[0].notified_count,
            0
          );
          unavailable = false;
          const restarted = createPool(database);
          try {
            assert.equal(await deliverScheduleAlerts(restarted, send), 1);
          } finally {
            await restarted.end();
          }
          assert.equal(received.at(-1).attemptCount, 1);
          const row = (
            await pool.query('SELECT id,scheduled_at FROM content.board_post WHERE id=$1', [
              post.postId,
            ])
          ).rows[0];
          await recordScheduleFailure(pool, row, 'DEPENDENCY_UNAVAILABLE');
          assert.equal(await deliverScheduleAlerts(pool, send), 0);
          assert.equal(
            await deliverScheduleAlerts(pool, send, new Date(Date.now() + 16 * 60000)),
            1
          );
          assert.equal(received.at(-1).attemptCount, 2);
          assert.equal(received.at(-1).newAttempts, 1);
          assert.equal(received[0].groupKey, received.at(-1).groupKey);
          assert.equal(await service.publishDue(), 1);
          assert.equal(
            await deliverScheduleAlerts(pool, send, new Date(Date.now() + 32 * 60000)),
            0
          );
        } finally {
          await new Promise((r) => receiver.close(r));
        }
      }
    );
  }
);
