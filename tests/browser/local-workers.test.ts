import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rename, mkdir, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect } from '@playwright/test';
import { localDevelopmentFixture } from '../helpers/local-development-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { object } from '../helpers/browser-values.ts';

await test(
  'local command timer: real due time, cancellation, restart, single owner and transient media failures',
  { timeout: 300000 },
  async (t) => {
    const fixture = await localDevelopmentFixture(t);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext();
    const authenticate = () =>
      context.addCookies([
        { name: 'BLARIYO_ADMIN_SESSION', value: fixture.adminToken, url: fixture.origin },
      ]);
    await authenticate();
    const page = await context.newPage();
    await page.goto(fixture.origin + '/admin');
    await page.waitForFunction(() => '__vue_app__' in document.querySelector('#__nuxt')!);
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const feedback = page.locator('main > [role="status"]').first();
    async function command(name: string, confirm = false) {
      if (confirm) page.once('dialog', (d) => d.accept());
      const response = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/admin/posts') &&
          ['POST', 'PATCH'].includes(r.request().method())
      );
      await button(name).click();
      const received = await response;
      assert.ok(received.ok());
      const id = Number(object(object(await received.json()).data).postId);
      await expect(feedback).toHaveText('저장했습니다.');
      return id;
    }
    const png = await sharp({
      create: { width: 30, height: 30, channels: 3, background: '#00a19b' },
    })
      .png()
      .toBuffer();
    async function create(title: string) {
      await button('새 초안').click();
      await page.getByLabel('제목', { exact: true }).fill(title);
      await page.getByLabel('본문 1', { exact: true }).fill(title + ' 본문');
      await page
        .getByLabel('이미지 추가', { exact: true })
        .setInputFiles({ name: 'worker.png', mimeType: 'image/png', buffer: png });
      await expect(page.getByAltText('업로드 미리보기')).toHaveCount(1);
      await expect(page.getByLabel('이미지 추가', { exact: true })).toBeEnabled();
      await page.getByLabel('대체 텍스트').fill('worker 검증 이미지');
      return command('초안 생성');
    }
    const status = async (id: number) =>
      (await fixture.pool.query('SELECT status FROM content.board_post WHERE id=$1', [id])).rows[0]
        ?.status;
    const image = async (id: number) => {
      const row = (
        await fixture.pool.query(
          'SELECT private_storage_key,public_storage_key FROM content.board_post_image WHERE post_id=$1',
          [id]
        )
      ).rows[0];
      assert.ok(row);
      return row;
    };

    // Fail an actual filesystem delete, then let the normal two-minute backoff expire.
    const hiddenId = await create('회수 재시도');
    await command('즉시 발행');
    const hiddenImage = await image(hiddenId);
    const publicPath = join(
      fixture.directory,
      'media/public',
      String(hiddenImage.public_storage_key)
    );
    await rename(publicPath, publicPath + '.fault-backup');
    await mkdir(publicPath);
    await command('숨김', true);
    await expect
      .poll(
        async () =>
          (
            await fixture.pool.query(
              "SELECT count(*)::int AS failures FROM ops.outbox_task WHERE type='OBJECT_DELETE_PUBLIC' AND status='FAILED'"
            )
          ).rows[0]?.failures,
        { timeout: 15000 }
      )
      .toBe(1);
    await rmdir(publicPath);
    await rename(publicPath + '.fault-backup', publicPath);
    const failedAt = new Date().toISOString();

    // Same real wall-clock slot for successful, cancelled and temporarily failing scheduled posts.
    const due = new Date(Math.ceil((Date.now() + 75000) / 60000) * 60000);
    const kst = new Date(+due + 9 * 3600000).toISOString().slice(0, 16);
    const dueId = await create('실시각 예약');
    await page.getByLabel('예약 시각 (KST)', { exact: true }).fill(kst);
    await command('예약', true);
    const cancelledId = await create('실시각 취소');
    await page.getByLabel('예약 시각 (KST)', { exact: true }).fill(kst);
    await command('예약', true);
    await command('예약 취소', true);
    const retryId = await create('예약 일시 실패');
    await page.getByLabel('예약 시각 (KST)', { exact: true }).fill(kst);
    await command('예약', true);
    const privatePath = join(
      fixture.directory,
      'media/private',
      String((await image(retryId)).private_storage_key)
    );
    await rename(privatePath, privatePath + '.fault-backup');

    // A second process must fail to take the same DB-wide lock, even without binding the web port.
    const probe = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
    import { readFile } from 'node:fs/promises';
    import { startCoreWorkers } from './scripts/local/core-workers.mjs';
    const { databaseUrl } = JSON.parse(await readFile(process.env.SANDBOX_CONFIG, 'utf8'));
    try {
      const stop = await startCoreWorkers({ databaseUrl, storageRoot: process.env.SANDBOX_MEDIA, origin: 'http://localhost:3000', intervalMs: 1000 });
      await stop(); process.exitCode = 2;
    } catch (e) { if (e.message !== 'LOCAL_WORKERS_ALREADY_RUNNING') throw e; console.log('DUPLICATE_REJECTED'); }
  `,
      ],
      {
        env: {
          ...process.env,
          SANDBOX_CONFIG: join(fixture.directory, 'sandbox.json'),
          SANDBOX_MEDIA: join(fixture.directory, 'media'),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let probeOutput = '';
    probe.stdout.on('data', (data: Buffer) => {
      probeOutput += data.toString();
    });
    const probeResult: unknown[] = await once(probe, 'exit');
    assert.equal(probeResult[0], 0);
    assert.match(probeOutput, /DUPLICATE_REJECTED/);
    await fixture.stop();
    await fixture.start();
    await authenticate();
    assert.equal(await status(dueId), 'SCHEDULED');
    console.log(
      `Waiting for real scheduled time ${due.toISOString()} and outbox retry; no clock/DB time adjustment`
    );
    await expect
      .poll(() => status(dueId), { timeout: 155000, intervals: [1000] })
      .toBe('PUBLISHED');
    await expect
      .poll(
        async () =>
          (
            await fixture.pool.query(
              'SELECT count(*)::int AS failures FROM ops.schedule_failure_alert WHERE post_id=$1',
              [retryId]
            )
          ).rows[0]?.failures,
        { timeout: 15000 }
      )
      .toBe(1);
    assert.equal(await status(retryId), 'SCHEDULED');
    assert.equal(await status(cancelledId), 'DRAFT');
    await rename(privatePath + '.fault-backup', privatePath);
    await expect.poll(() => status(retryId), { timeout: 15000 }).toBe('PUBLISHED');
    await expect
      .poll(
        async () =>
          (
            await fixture.pool.query(
              'SELECT status FROM content.board_post_image WHERE post_id=$1',
              [hiddenId]
            )
          ).rows[0]?.status,
        { timeout: 140000, intervals: [1000] }
      )
      .toBe('PRIVATE_REVIEW');
    await assert.rejects(fixture.storage.get('public', String(hiddenImage.public_storage_key)));
    assert.ok(
      (await fixture.storage.get('private', String(hiddenImage.private_storage_key))).length > 0
    );
    await page.goto(fixture.origin + '/admin');
    await page.waitForFunction(() => '__vue_app__' in document.querySelector('#__nuxt')!);
    await page.locator(`[data-post-id="${hiddenId}"]`).click();
    await expect(button('재공개')).toBeEnabled();
    await command('재공개');
    await fixture.waitForOutbox();
    await fixture.stop();
    await fixture.start();
    const priorTicks = fixture.logs.join('').split('LOCAL_WORKER_OK outbox:run').length;
    await expect
      .poll(() => fixture.logs.join('').split('LOCAL_WORKER_OK outbox:run').length, {
        timeout: 10000,
      })
      .toBeGreaterThan(priorTicks + 1);
    const histories = await fixture.pool.query(
      "SELECT post_id::int, count(*)::int AS publications FROM content.board_post_status_history WHERE to_status='PUBLISHED' GROUP BY post_id ORDER BY post_id"
    );
    assert.deepEqual(histories.rows, [
      { post_id: hiddenId, publications: 2 },
      { post_id: dueId, publications: 1 },
      { post_id: retryId, publications: 1 },
    ]);
    assert.equal(await status(cancelledId), 'DRAFT');
    for (const id of [hiddenId, dueId, retryId]) {
      const row = await image(id);
      assert.deepEqual(
        await fixture.storage.get('private', String(row.private_storage_key)),
        await fixture.storage.get('public', String(row.public_storage_key))
      );
    }
    // No local notification sink is configured: preserve the undelivered alert honestly.
    assert.ok(fixture.logs.join('').includes('LOCAL_WORKER_RETRY posts:publish-due'));
    await mkdir('test-results/admin-core', { recursive: true });
    await writeFile(
      'test-results/admin-core/workers.json',
      JSON.stringify(
        {
          posts: 4,
          origin: fixture.origin,
          due: due.toISOString(),
          failedAt,
          checkedAt: new Date().toISOString(),
          histories: histories.rows,
          cancelledPublications: 0,
          duplicateOwner: 'rejected',
          restarts: 2,
          clockAdjusted: false,
          workerDirectCalls: 0,
          notificationDelivery: 'not-configured-local-alert-remains-pending',
        },
        null,
        2
      )
    );
  }
);
