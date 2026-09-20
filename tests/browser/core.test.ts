import { object } from '../helpers/browser-values.ts';
import type { Route, Request } from '@playwright/test';
import { launchBrowser } from '../helpers/launch-browser.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import sharp from 'sharp';
import { browserFixture } from '../helpers/browser-fixture.ts';

await test(
  'M0 Core actual Chromium UI with isolated PostgreSQL and local storage',
  { timeout: 180000 },
  async (t) => {
    const fixture = await browserFixture(t, { rightsEmail: 'rights@example.test' });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const external: string[] = [],
      errors: string[] = [];
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== fixture.origin) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    context.setDefaultTimeout(8000);
    context.setDefaultNavigationTimeout(15000);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: fixture.adminToken, url: fixture.origin },
    ]);
    const png = await sharp({
      create: { width: 300, height: 180, channels: 3, background: '#00a19b' },
    })
      .png()
      .toBuffer();
    const valid = { name: 'valid.png', mimeType: 'image/png', buffer: png };
    const invalid = {
      name: '<broken>.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    };
    const oversized = {
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    };
    await page.goto(fixture.origin + '/admin');
    await expect(page.getByRole('heading', { name: '게시글 관리' })).toBeVisible();
    // Interacting after Nuxt hydration prevents a test click being lost to SSR-only markup.
    await page.waitForFunction(() => {
      const root = document.querySelector('#__nuxt');
      return root !== null && '__vue_app__' in root && !!root.__vue_app__;
    });
    const input = page.getByLabel('이미지 추가', { exact: true });
    const title = page.getByLabel('제목', { exact: true });
    const feedback = page.locator('main > [role="status"]');
    async function upload(files: Parameters<typeof input.setInputFiles>[0], status: number) {
      const response = page.waitForResponse(
        (r) => r.url().endsWith('/api/v1/admin/images') && r.request().method() === 'POST'
      );
      await input.setInputFiles(files);
      assert.equal((await response).status(), status);
      await expect(input).toBeEnabled();
    }
    await t.test(
      'field feedback, file errors, gate errors and dependency failures preserve all-or-nothing',
      async () => {
        await page.getByRole('button', { name: '초안 생성', exact: true }).click();
        await expect(title).toHaveAttribute('aria-invalid', 'true');
        await expect(title).toBeFocused();
        await expect(page.locator('#error-block-0')).toBeVisible();
        await upload([valid, invalid, oversized], 413);
        await expect(page.getByRole('alert').getByRole('listitem')).toHaveCount(2);
        await expect(page.getByRole('alert')).toContainText('<broken>.png');
        await expect(page.getByRole('alert')).toContainText('large.png');
        await expect(page.getByAltText('업로드 미리보기')).toHaveCount(0);
        assert.equal((await fixture.storage.inventory('private')).length, 0);
        await upload([invalid], 415);
        await expect(page.getByRole('alert').getByRole('listitem')).toHaveCount(1);
        await upload(
          Array.from({ length: 11 }, (_, i) => ({ ...valid, name: `${i}.png` })),
          413
        );
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(feedback).toContainText('최대 10개');
        fixture.failStorage(true);
        try {
          await upload([valid], 503);
          await expect(page.getByRole('alert')).toHaveCount(0);
          await expect(feedback).toContainText('저장소에 연결하지 못했습니다');
          await expect(page.getByAltText('업로드 미리보기')).toHaveCount(0);
        } finally {
          fixture.failStorage(false);
        }
      }
    );
    let postId: number;
    await t.test(
      'upload blocks editor switching, then draft / publish / hide / republish / remove work',
      async () => {
        const { promise: started, resolve: entered } = Promise.withResolvers<void>();
        const { promise: held, resolve: release } = Promise.withResolvers<void>();
        const holdUpload = async (route: Route) => {
          entered();
          await held;
          await route.continue();
        };
        await page.route('**/api/v1/admin/images', holdUpload);
        await input.setInputFiles(valid);
        await started;
        try {
          await expect(page.getByRole('button', { name: '새 초안', exact: true })).toBeDisabled();
          await expect(title).toBeDisabled();
        } finally {
          release();
        }
        await expect(page.getByAltText('업로드 미리보기')).toBeVisible();
        await expect(input).toBeEnabled();
        await page.unroute('**/api/v1/admin/images', holdUpload);
        await title.fill('브라우저 이미지 발행 검증');
        await page.getByLabel('본문 1', { exact: true }).fill('브라우저에서 작성한 본문');
        await page.getByRole('button', { name: '초안 생성', exact: true }).click();
        await expect(page.getByLabel('대체 텍스트')).toHaveAttribute('aria-invalid', 'true');
        await page.getByLabel('대체 텍스트').fill('청록색 테스트 이미지');
        await page.getByRole('button', { name: '초안 생성', exact: true }).click();
        await expect(feedback).toHaveText('저장했습니다.');
        await expect(page.getByRole('button', { name: '즉시 발행', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: '즉시 발행', exact: true }).click();
        const link = page.getByRole('link', { name: '공개 게시글 보기' });
        await expect(link).toBeVisible();
        const href = await link.getAttribute('href');
        assert.ok(href);
        postId = Number(href.split('/').at(-1));
        const publicPage = await context.newPage();
        publicPage.on('pageerror', (e) => errors.push(e.message));
        await publicPage.goto(fixture.origin + '/meme/posts/' + postId);
        await expect(publicPage.getByAltText('청록색 테스트 이미지')).toBeVisible();
        assert.equal(
          await publicPage
            .getByAltText('청록색 테스트 이미지')
            .evaluate(
              (img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
            ),
          true
        );
        const current = publicPage.locator('.post-row[aria-current="true"]');
        await expect(current).toHaveCount(1);
        assert.equal(await current.evaluate((el) => el.tagName), 'DIV');
        await expect(current.locator('a, [tabindex]')).toHaveCount(0);
        await expect(publicPage.locator('header')).toHaveCount(0);
        await publicPage.close();
        await page.getByRole('button', { name: '숨김', exact: true }).click();
        await expect(page.getByRole('button', { name: '재공개', exact: true })).toBeDisabled();
        assert.equal(
          (await context.request.get(fixture.origin + '/meme/posts/' + postId)).status(),
          404
        );
        await fixture.flush();
        await page.getByRole('button', { name: '최신 내용 확인', exact: true }).click();
        await expect(page.getByRole('button', { name: '재공개', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: '재공개', exact: true }).click();
        await expect(link).toBeVisible();
        await page.getByRole('button', { name: '숨김', exact: true }).click();
        await expect(page.getByRole('button', { name: '최종 삭제', exact: true })).toBeDisabled();
        await fixture.flush();
        await page.getByRole('button', { name: '최신 내용 확인', exact: true }).click();
        await expect(page.getByRole('button', { name: '최종 삭제', exact: true })).toBeEnabled();
        page.once('dialog', async (dialog) => {
          assert.match(dialog.message(), /되돌릴 수 없는/);
          await dialog.accept();
        });
        await page.getByRole('button', { name: '최종 삭제', exact: true }).click();
        await expect(page.locator('section > p').first()).toContainText('REMOVED');
        await expect(title).toBeDisabled();
        await fixture.flush();
      }
    );
    await t.test(
      'retry after a saved draft cannot be reloaded keeps the original idempotency key',
      async () => {
        await page.getByRole('button', { name: '새 초안', exact: true }).click();
        await title.fill('저장 응답 복구 검증');
        await page.getByLabel('본문 1', { exact: true }).fill('중복 생성 방지');
        const keys: string[] = [];
        const capture = (request: Request) => {
          if (request.method() === 'POST' && request.url().endsWith('/api/v1/admin/posts')) {
            const key = request.headers()['idempotency-key'];
            assert.ok(key);
            keys.push(key);
          }
        };
        page.on('request', capture);
        const failDetail = async (route: Route) => {
          if (route.request().method() === 'GET')
            return route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ success: false, error: { code: 'DEPENDENCY_UNAVAILABLE' } }),
            });
          return route.continue();
        };
        await page.route(/\/api\/v1\/admin\/posts\/\d+$/, failDetail);
        try {
          await page.getByRole('button', { name: '초안 생성', exact: true }).click();
          await expect(feedback).toContainText('처리하지 못했습니다');
        } finally {
          await page.unroute(/\/api\/v1\/admin\/posts\/\d+$/, failDetail);
        }
        await page.getByRole('button', { name: '초안 생성', exact: true }).click();
        await expect(feedback).toHaveText('저장했습니다.');
        page.off('request', capture);
        assert.equal(keys.length, 2);
        assert.equal(keys[0], keys[1]);
        assert.equal(
          (
            await fixture.pool.query(
              "SELECT id FROM content.board_post WHERE title='저장 응답 복구 검증'"
            )
          ).rowCount,
          1
        );
      }
    );
    await t.test('schedule slots, cancellation, due worker and unsaved-change guard', async () => {
      await page.getByRole('button', { name: '새 초안', exact: true }).click();
      await title.fill('예약 브라우저 검증');
      await page.getByLabel('본문 1', { exact: true }).fill('예약 본문');
      page.once('dialog', (dialog) => dialog.dismiss());
      await page.getByRole('button', { name: '새 초안', exact: true }).click();
      await expect(title).toHaveValue('예약 브라우저 검증');
      await page.getByRole('button', { name: '초안 생성', exact: true }).click();
      await expect(feedback).toHaveText('저장했습니다.');
      await page.getByRole('button', { name: '07:30 KST', exact: true }).click();
      await page.getByRole('button', { name: '예약', exact: true }).click();
      await expect(page.locator('section > p').first()).toContainText('SCHEDULED');
      await page.getByRole('button', { name: '예약 취소', exact: true }).click();
      await expect(page.locator('section > p').first()).toContainText('DRAFT');
      await page.getByRole('button', { name: '17:30 KST', exact: true }).click();
      await page.getByRole('button', { name: '예약', exact: true }).click();
      await expect(page.locator('section > p').first()).toContainText('SCHEDULED');
      await fixture.pool.query(
        "UPDATE content.board_post SET scheduled_at=now()-interval '1 minute' WHERE status='SCHEDULED'"
      );
      assert.equal(await fixture.posts.publishDue(), 1);
      assert.equal(await fixture.posts.publishDue(), 0);
      await page.getByRole('button', { name: '최신 내용 확인', exact: true }).click();
      await expect(page.getByRole('link', { name: '공개 게시글 보기' })).toBeVisible();
    });
    await t.test(
      'pagination preserves detail, policy history and dialogs, disabled consent and responsive UI',
      async () => {
        for (let i = 0; i < 23; i++) {
          const post = object(
            (
              await fixture.posts.command(
                {
                  action: 'create',
                  params: {},
                  body: {
                    boardSlug: 'meme',
                    title: `목록 검증 ${i}`,
                    source: null,
                    pinnedPosition: null,
                    blocks: [{ type: 'TEXT', text: `공개 본문 ${i}` }],
                  },
                },
                'system:scheduler'
              )
            ).data
          );
          await fixture.posts.command(
            {
              action: 'publish',
              params: { postId: String(post.postId) },
              body: { lockVersion: 1, mode: 'IMMEDIATE' },
            },
            'system:scheduler'
          );
        }
        await page.goto(fixture.origin + '/meme');
        await expect(page.locator('.post-row')).toHaveCount(20);
        await mkdir('test-results/m0-browser', { recursive: true });
        for (const width of [1280, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          const layout = await page.evaluate(() => {
            const header = document.querySelector('.site-header');
            const shell = document.querySelector('.shell');
            const row = document.querySelector('.post-row');
            if (!header || !shell || !row) throw new Error('Missing public layout');
            return {
              headerHeight: header.getBoundingClientRect().height,
              headerColor: getComputedStyle(header).backgroundColor,
              shellWidth: shell.getBoundingClientRect().width,
              rowHeight: row.getBoundingClientRect().height,
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          assert.equal(layout.headerHeight, 54);
          assert.equal(layout.headerColor, 'rgb(58, 74, 90)');
          assert.ok(layout.shellWidth <= Math.min(width, 760));
          assert.ok(layout.rowHeight >= 64);
          assert.equal(layout.overflow, false);
          await expect(page.getByRole('navigation', { name: '게시판', exact: true })).toBeVisible();
          const headingLayout = await page.locator('.list-heading').evaluate((heading) => {
            const title = heading.querySelector('h1')!.getBoundingClientRect();
            const tagline = heading.querySelector('div > p')!.getBoundingClientRect();
            return {
              below: tagline.top >= title.bottom,
              aligned: Math.abs(title.left - tagline.left) < 1,
            };
          });
          assert.deepEqual(headingLayout, { below: true, aligned: true });
          await expect(page.getByRole('button', { name: '이전 페이지' })).toBeDisabled();
          await expect(page.getByRole('link', { name: '권리 문의', exact: true })).toHaveAttribute(
            'href',
            /mailto:rights@example\.test\?subject=/
          );
          assert.ok(!(await page.locator('footer').innerText()).includes('rights@example.test'));
          await page.screenshot({
            path: `test-results/m0-browser/list-${width}.png`,
            fullPage: true,
          });
        }
        const failedPage = '**/api/v1/boards/meme/posts?page=2';
        await page.route(failedPage, (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }),
          })
        );
        await page.getByRole('button', { name: '다음 페이지' }).click();
        await expect(page.getByRole('alert')).toContainText('목록을 불러오지 못했습니다.');
        await page.unroute(failedPage);
        await page.getByRole('button', { name: '다시 시도', exact: true }).click();
        await expect(page.locator('.post-row')).toHaveCount(4);
        await page.locator('.post-row').first().click();
        await expect(page.locator('article h1'))
          .toBeVisible()
          .catch(async (error) => {
            console.error(
              'DETAIL_NAVIGATION',
              page.url(),
              await page.locator('main').innerText(),
              errors
            );
            throw error;
          });
        const heading = await page.locator('article h1').textContent();
        assert.ok(heading);
        await page.getByRole('button', { name: '이전 페이지' }).click();
        await expect(page.locator('.post-row')).toHaveCount(20);
        await expect(page.locator('article h1')).toHaveText(heading);
        await page.getByRole('button', { name: '공유하기', exact: true }).click();
        await expect(page.getByRole('dialog', { name: '공유하기' })).toBeVisible();
        for (const width of [1280, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          const box = await page.getByRole('dialog', { name: '공유하기' }).boundingBox();
          assert.ok(box);
          assert.ok(box.x >= 0 && box.x + box.width <= width);
          if (width < 768) assert.ok(Math.abs(box.y + box.height - 900) <= 1);
          await page.screenshot({ path: `test-results/m0-browser/share-${width}.png` });
        }
        await expect(page.getByRole('button', { name: '카카오톡', exact: true })).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: '공유하기', exact: true })).toBeFocused();
        await page.getByRole('link', { name: '이용약관', exact: true }).click();
        await expect(page.locator('dialog[open] .policy-body')).toContainText('fixture-current');
        for (const width of [1280, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          const policyBox = await page.locator('dialog[open]').boundingBox();
          assert.ok(policyBox && policyBox.x >= 0 && policyBox.x + policyBox.width <= width);
          assert.equal(
            await page.locator('dialog[open]').evaluate((el) => el.scrollWidth > el.clientWidth),
            false
          );
          await expect(page.locator('dialog[open] .policy-kicker')).toHaveText('BLARIYO POLICY');
          await page.screenshot({ path: `test-results/m0-browser/policy-${width}.png` });
        }
        await page.getByRole('button', { name: /fixture-old/ }).click();
        await expect(page.locator('dialog[open] .policy-body')).toContainText('fixture-old');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('link', { name: '이용약관', exact: true })).toBeFocused();
        await page.getByRole('link', { name: '쿠키 설정', exact: true }).click();
        await expect(page.getByText('현재 활성화된 저장소가 없습니다')).toBeVisible();
        await expect(page.getByRole('checkbox')).toHaveCount(0);
        assert.equal(await page.evaluate(() => localStorage.getItem('blariyo_consent')), null);
        assert.ok(!(await page.content()).includes('G-MUSTNOTLEAK'));
        await page.keyboard.press('Escape');
        await mkdir('test-results/m0-browser', { recursive: true });
        for (const width of [1280, 768, 390, 360, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => window.scrollTo(0, 0));
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true
          );
          await page.screenshot({
            path: `test-results/m0-browser/detail-${width}.png`,
            fullPage: true,
          });
        }
        await page.goto(fixture.origin + '/admin');
        await expect(page.getByRole('heading', { name: '게시글 관리' })).toBeVisible();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true
        );
        await page.screenshot({ path: 'test-results/m0-browser/admin-320.png', fullPage: true });
        await page.goto(fixture.origin + '/meme/posts/999999999');
        await expect(page.getByRole('heading', { name: '볼 수 없는 게시글입니다' })).toBeVisible();
        await expect(page.getByRole('button', { name: '공유하기', exact: true })).toHaveCount(0);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true
        );
        await page.screenshot({
          path: 'test-results/m0-browser/not-found-320.png',
          fullPage: true,
        });
        assert.deepEqual(external, []);
        assert.deepEqual(errors, []);
      }
    );
  }
);
