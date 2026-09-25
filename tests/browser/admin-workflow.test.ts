import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type Route } from '@playwright/test';
import sharp from 'sharp';
import { localDevelopmentFixture } from '../helpers/local-development-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { object } from '../helpers/browser-values.ts';

await test(
  'administrator repeated 12-post workflow and recovery with DB/media readback',
  { timeout: 300000 },
  async (t) => {
    const fixture = await localDevelopmentFixture(t);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    // The workstation timezone must not change KST scheduling.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      timezoneId: 'America/Los_Angeles',
    });
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: fixture.adminToken, url: fixture.origin },
    ]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    context.setDefaultTimeout(10000);
    await page.goto(fixture.origin + '/admin');
    await page.waitForFunction(
      () =>
        !!document.querySelector('#__nuxt') && '__vue_app__' in document.querySelector('#__nuxt')!
    );
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const title = page.getByLabel('제목', { exact: true });
    const feedback = page.locator('main > [role="status"]').first();
    async function command(name: string, confirm = false) {
      if (confirm) page.once('dialog', (d) => d.accept());
      const response = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/admin/posts') &&
          ['POST', 'PATCH', 'DELETE'].includes(r.request().method())
      );
      await button(name).click();
      const received = await response;
      assert.ok(received.ok(), `${name}: ${received.status()}`);
      const data = object(object(await received.json()).data);
      await expect(feedback).toHaveText('저장했습니다.');
      await expect(page.locator('section')).toHaveAttribute('aria-busy', 'false');
      return Number(data.postId);
    }
    const png = await sharp({
      create: { width: 80, height: 50, channels: 3, background: '#00a19b' },
    })
      .png()
      .toBuffer();
    const ids: number[] = [];
    let completedStages = 0;
    const started = Date.now();
    let clicks = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/admin/') && request.method() !== 'GET') clicks++;
    });
    await t.test(
      '12 posts: create, edit, upload, reorder, schedule/cancel, publish, hide, edit and republish',
      async () => {
        for (let i = 0; i < 12; i++) {
          await button('새 초안').click();
          await title.fill(
            `반복 검증 ${String(i + 1).padStart(2, '0')} ${'긴 제목 '.repeat(i === 0 ? 25 : 1)}`
          );
          await page.getByLabel('본문 1', { exact: true }).fill(`유실되면 안 되는 본문 ${i}`);
          await page.getByLabel('출처명', { exact: true }).fill('검증 출처');
          await page
            .getByLabel('출처 URL', { exact: true })
            .fill(`https://example.test/posts/${i}`);
          await page.getByLabel('이미지 추가', { exact: true }).setInputFiles([
            { name: 'first.png', mimeType: 'image/png', buffer: png },
            { name: 'second.png', mimeType: 'image/png', buffer: png },
          ]);
          await expect(page.getByAltText('업로드 미리보기')).toHaveCount(2);
          await expect(page.getByLabel('이미지 추가', { exact: true })).toBeEnabled();
          await page.getByLabel('대체 텍스트').nth(0).fill(`첫 이미지 ${i}`);
          await page.getByLabel('대체 텍스트').nth(1).fill(`둘째 이미지 ${i}`);
          await page
            .locator('.block-editor')
            .nth(2)
            .getByRole('button', { name: '위로', exact: true })
            .focus();
          await page.keyboard.press('Enter');
          await expect(page.getByLabel('대체 텍스트').nth(0)).toHaveValue(`둘째 이미지 ${i}`);
          await expect(
            page.locator('.block-editor').nth(1).getByRole('button', { name: '위로', exact: true })
          ).toBeFocused();
          const id = await command('초안 생성');
          ids.push(id);
          assert.equal(
            (
              await context.request.get(`${fixture.origin}/api/v1/boards/meme/posts/${id}`)
            ).status(),
            404
          );
          await title.fill(`반복 검증 ${String(i + 1).padStart(2, '0')} 수정`);
          await command('수정 저장');
          if (i % 2 === 0) {
            await button('07:30 KST').click();
            const scheduled = await page
              .getByLabel('예약 시각 (KST)', { exact: true })
              .inputValue();
            assert.ok(scheduled.endsWith('07:30'));
            page.once('dialog', (d) => d.dismiss());
            await button('예약').click();
            await expect(page.locator('.save-state')).toContainText('초안');
            await command('예약', true);
            const row = (
              await fixture.pool.query('SELECT scheduled_at FROM content.board_post WHERE id=$1', [
                id,
              ])
            ).rows[0];
            assert.ok(row?.scheduled_at instanceof Date);
            assert.equal(
              row.scheduled_at.toISOString(),
              new Date(scheduled + '+09:00').toISOString()
            );
            await command('예약 취소', true);
          }
          await command('즉시 발행');
          await expect(title).toBeDisabled();
          const publicResponse = await context.request.get(
            `${fixture.origin}/api/v1/boards/meme/posts/${id}`
          );
          assert.equal(publicResponse.status(), 200);
          const stored = await fixture.pool.query(
            'SELECT private_storage_key,public_storage_key,content_sha256 FROM content.board_post_image WHERE post_id=$1 ORDER BY id',
            [id]
          );
          assert.equal(stored.rowCount, 2);
          for (const row of stored.rows) {
            assert.equal(typeof row.private_storage_key, 'string');
            assert.equal(typeof row.public_storage_key, 'string');
            const privateBytes = await fixture.storage.get(
              'private',
              String(row.private_storage_key)
            );
            const publicBytes = await fixture.storage.get('public', String(row.public_storage_key));
            assert.deepEqual(privateBytes, publicBytes);
            assert.deepEqual(createHash('sha256').update(publicBytes).digest(), row.content_sha256);
            assert.equal((await sharp(publicBytes).metadata()).width, 80);
          }
          await command('숨김', true);
          assert.equal(
            (
              await context.request.get(`${fixture.origin}/api/v1/boards/meme/posts/${id}`)
            ).status(),
            404
          );
          await expect(button('재공개')).toBeDisabled();
          await fixture.waitForOutbox();
          for (const row of stored.rows)
            await assert.rejects(fixture.storage.get('public', String(row.public_storage_key)));
          await button('최신 내용 확인').click();
          await expect(button('재공개')).toBeEnabled();
          await page.getByLabel('본문 1', { exact: true }).fill(`숨김에서 수정한 본문 ${i}`);
          await command('수정 저장');
          await command('재공개');
          const detail = object(
            object(
              await (await context.request.get(`${fixture.origin}/api/v1/admin/posts/${id}`)).json()
            ).data
          );
          assert.ok(Array.isArray(detail.blocks));
          assert.deepEqual(
            detail.blocks.map((b: unknown) => {
              const block = object(b);
              return block.type === 'TEXT' ? block.text : block.alt;
            }),
            [`숨김에서 수정한 본문 ${i}`, `둘째 이미지 ${i}`, `첫 이미지 ${i}`]
          );
        }
        const result = await fixture.pool.query(
          "SELECT count(*)::int AS total, count(*) FILTER (WHERE status='PUBLISHED')::int AS published FROM content.board_post"
        );
        assert.deepEqual(result.rows[0], { total: 12, published: 12 });
        const histories = await fixture.pool.query(
          "SELECT post_id,count(*)::int AS publications FROM content.board_post_status_history WHERE to_status='PUBLISHED' GROUP BY post_id"
        );
        assert.equal(histories.rowCount, 12);
        for (const row of histories.rows) assert.equal(row.publications, 2);
        assert.equal((await fixture.storage.inventory('public')).length, 24);
        completedStages++;
      }
    );
    await t.test(
      'filters, empty, errors, permissions, version conflict and input preservation',
      async () => {
        await page.getByLabel('제목 앞부분', { exact: true }).fill('없는 글');
        await button('검색').click();
        await expect(page.getByText('검색 결과가 없습니다.', { exact: false })).toBeVisible();
        await page.getByLabel('제목 앞부분', { exact: true }).fill('반복 검증 01');
        await page.locator('aside').getByLabel('상태', { exact: true }).selectOption('PUBLISHED');
        await page.locator('aside').getByLabel('게시판', { exact: true }).selectOption('meme');
        await button('검색').click();
        await expect(page.locator('.admin-result')).toHaveCount(1);
        await expect(page.locator('.admin-result')).toContainText('공개 중 · 짤');
        await expect(page.locator('.admin-result')).toContainText('KST');
        const failure = (status: number) => (route: Route) =>
          route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: status === 403 ? 'FORBIDDEN' : 'DEPENDENCY_UNAVAILABLE' },
            }),
          });
        await page.route('**/api/v1/admin/posts?*', failure(503));
        await button('검색').click();
        await expect(button('검색 다시 시도')).toBeVisible();
        await expect(page.locator('.admin-result')).toHaveCount(0);
        await page.unroute('**/api/v1/admin/posts?*');
        await button('검색 다시 시도').click();
        await expect(page.locator('.admin-result')).toHaveCount(1);
        await page.route('**/api/v1/admin/posts?*', failure(403));
        await button('검색').click();
        await expect(page.locator('aside [role="alert"]')).toContainText('접근 권한');
        await page.unroute('**/api/v1/admin/posts?*');
        await button('검색 다시 시도').click();
        await page.locator('.admin-result').click();
        await expect(page.locator('#editor-heading')).toBeFocused();
        await command('숨김', true);
        await fixture.waitForOutbox();
        await button('최신 내용 확인').click();
        await expect(title).toBeEnabled();
        await title.fill('내가 편집하던 제목');
        const editorResponse = object(
          object(
            await (
              await context.request.get(`${fixture.origin}/api/v1/admin/posts/${ids[0]}`)
            ).json()
          ).data
        );
        const concurrent = await context.request.patch(
          `${fixture.origin}/api/v1/admin/posts/${ids[0]}`,
          {
            headers: { 'Idempotency-Key': crypto.randomUUID(), Origin: fixture.origin },
            data: {
              title: '다른 운영자 제목',
              source: editorResponse.source,
              blocks: [{ type: 'TEXT', text: '다른 운영자 본문' }],
              lockVersion: editorResponse.lockVersion,
            },
          }
        );
        assert.equal(concurrent.status(), 200);
        await button('수정 저장').click();
        await expect(feedback).toContainText('다른 변경이 반영되었습니다');
        await expect(title).toHaveValue('내가 편집하던 제목');
        page.once('dialog', (d) => d.dismiss());
        await button('최신 내용 확인').click();
        await expect(title).toHaveValue('내가 편집하던 제목');
        page.once('dialog', (d) => d.accept());
        await button('최신 내용 확인').click();
        await expect(title).toHaveValue('다른 운영자 제목');
        // Restore public state via the same editor, leaving no accidentally public draft.
        await command('재공개');
        const anonymous = await browser.newContext();
        const denied = await anonymous.request.get(fixture.origin + '/api/v1/admin/posts');
        assert.equal(denied.status(), 401);
        assert.ok(!(await denied.text()).includes('반복 검증'));
        const deniedPage = await anonymous.newPage();
        assert.equal((await deniedPage.goto(fixture.origin + '/admin'))?.status(), 401);
        await expect(
          deniedPage.getByRole('heading', { name: '관리자 인증이 필요합니다.' })
        ).toBeVisible();
        await anonymous.close();
        completedStages++;
      }
    );
    await t.test('320/390/768/1280 layout, mobile return and preview retry', async () => {
      await page.getByLabel('제목 앞부분', { exact: true }).fill('');
      await button('검색').click();
      await expect(page.locator('.admin-result')).toHaveCount(12);
      await page.locator(`[data-post-id="${ids[1]}"]`).click();
      await expect(button('숨김')).toBeVisible();
      await command('숨김', true);
      await fixture.waitForOutbox();
      await button('최신 내용 확인').click();
      await expect(title).toBeEnabled();
      await mkdir('test-results/admin-core', { recursive: true });
      // Hiding removes this post from the PUBLISHED filter. Return must still have a focus target.
      await page.setViewportSize({ width: 390, height: 900 });
      await button('목록으로').click();
      await expect(button('새 초안')).toBeFocused();
      await page.locator('aside').getByLabel('상태', { exact: true }).selectOption('');
      await button('검색').click();
      await expect(page.locator('.admin-result')).toHaveCount(12);
      await page.locator(`[data-post-id="${ids[1]}"]`).click();
      for (const width of [1280, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false
        );
        await expect(title).toBeVisible();
        await page.screenshot({
          path: `test-results/admin-core/editor-${width}.png`,
          fullPage: true,
        });
        if (width < 768) {
          await button('목록으로').click();
          await expect(page.locator(`[data-post-id="${ids[1]}"]`)).toBeFocused();
          await expect(title).toBeHidden();
          await page.screenshot({
            path: `test-results/admin-core/list-${width}.png`,
            fullPage: true,
          });
          await page.locator(`[data-post-id="${ids[1]}"]`).click();
          await expect(title).toBeVisible();
        }
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.route('**/api/v1/admin/images/*/preview*', (route) => route.abort());
      await button('최신 내용 확인').click();
      await expect(page.locator('section')).toHaveAttribute('aria-busy', 'false');
      // Reloading an identical src may stay cached: explicitly invalidate the DOM src to exercise onerror.
      await page
        .getByAltText('업로드 미리보기')
        .first()
        .evaluate((img) => {
          if (img instanceof HTMLImageElement) img.src += '?fault=1';
        });
      await expect(button('이미지 다시 불러오기')).toBeVisible();
      await page.unroute('**/api/v1/admin/images/*/preview*');
      await button('이미지 다시 불러오기').click();
      await expect(page.getByAltText('업로드 미리보기')).toHaveCount(2);
      await expect
        .poll(() =>
          page
            .getByAltText('업로드 미리보기')
            .first()
            .evaluate(
              (img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
            )
        )
        .toBe(true);
      await command('재공개');
      completedStages++;
    });
    assert.equal(
      completedStages,
      3,
      'Do not record completed workflow evidence after a failed stage'
    );
    assert.deepEqual(errors, []);
    const finalPosts = await fixture.pool.query(
      'SELECT status,count(*)::int AS count FROM content.board_post GROUP BY status'
    );
    assert.deepEqual(finalPosts.rows, [{ status: 'PUBLISHED', count: 12 }]);
    await writeFile(
      'test-results/admin-core/workflow.json',
      JSON.stringify(
        {
          posts: ids.length,
          checkedAt: new Date().toISOString(),
          completedStages,
          finalPosts: finalPosts.rows,
          elapsedMs: Date.now() - started,
          mutationRequests: clicks,
          browserErrors: errors,
          authentication: 'synthetic-local',
          operatorAcceptance: 'not-performed',
          database: 'isolated-random-fixture',
          media: 'temporary-local-storage',
          launcher: 'scripts/local/start-development.mjs --sandbox --workers',
          origin: fixture.origin,
          workerExecution: 'periodic commands, no direct test invocation',
        },
        null,
        2
      )
    );
  }
);
