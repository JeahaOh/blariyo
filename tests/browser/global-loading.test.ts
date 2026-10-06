import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { expect, type Page, type Route } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';

async function hold(page: Page, pattern: RegExp, fail = false, firstOnly = false) {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let requests = 0;
  const completed: Promise<void>[] = [];
  const handler = async (route: Route) => {
    requests++;
    // A new screen may independently request the same endpoint.
    if (firstOnly && requests > 1) return route.continue();
    const done = Promise.withResolvers<void>();
    completed.push(done.promise);
    started.resolve();
    try {
      await release.promise;
      if (fail)
        await route.fulfill({
          status: 503,
          json: { success: false, error: { code: 'DEPENDENCY_UNAVAILABLE' } },
        });
      else await route.continue();
    } finally {
      done.resolve();
    }
  };
  await page.route(pattern, handler);
  return {
    started: started.promise,
    release: () => release.resolve(),
    count: () => requests,
    cleanup: async () => {
      release.resolve();
      await Promise.all(completed);
      await page.unroute(pattern, handler);
    },
  };
}

await test(
  'shared loading bar covers user work, concurrency, errors, navigation and excludes polling',
  { timeout: 120000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true, directInput: true });
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin },
    ]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const bar = page.getByRole('progressbar', { name: '화면 작업 처리 중' });
    const listPath = /\/api\/v1\/admin\/collect\/batch-items\?/;
    const runtimePath = /\/api\/admin\/collect\/runtime-sources$/;
    await page.goto(f.origin + '/admin/batch');
    await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}));
    await expect(bar).toHaveCount(0);

    await t.test(
      'query failure and retry visibly start and stop, keeping controls locked',
      async () => {
        const query = await hold(page, listPath, true);
        try {
          await page.getByRole('button', { name: '조회', exact: true }).click();
          await query.started;
          await expect(bar).toBeVisible();
          await expect(page.getByRole('button', { name: '조회 중…', exact: true })).toBeDisabled();
          await expect(page.getByRole('region', { name: '수집 결과 목록' })).toHaveAttribute(
            'aria-busy',
            'true'
          );
          assert.equal(query.count(), 1);
          await expect(bar).toHaveCSS('height', '3px');
          await expect(bar).toHaveCSS('position', 'fixed');
          await expect(bar).toHaveCSS('pointer-events', 'none');
          await mkdir('.local-data/global-loading/screenshots', { recursive: true });
          await page.screenshot({ path: '.local-data/global-loading/screenshots/desktop.png' });
          query.release();
          await expect(page.getByRole('alert')).toContainText('목록을 불러오지 못했습니다');
          await expect(bar).toHaveCount(0);
        } finally {
          await query.cleanup();
        }
        const retry = await hold(page, listPath);
        try {
          await page.getByRole('button', { name: '목록 다시 조회', exact: true }).click();
          await retry.started;
          await expect(bar).toBeVisible();
          await expect(page.getByRole('button', { name: '목록 다시 조회 중…' })).toBeDisabled();
          await page.setViewportSize({ width: 320, height: 800 });
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await expect(bar.locator('span')).toHaveCSS('animation-name', 'none');
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true
          );
          await page.screenshot({ path: '.local-data/global-loading/screenshots/mobile.png' });
          retry.release();
          await expect(bar).toHaveCount(0);
          await expect(page.getByRole('alert')).toHaveCount(0);
          await expect(page.getByRole('button', { name: '조회', exact: true })).toBeEnabled();
        } finally {
          await retry.cleanup();
        }
        await page.setViewportSize({ width: 1280, height: 900 });
      }
    );

    await t.test('parallel requests keep the bar until both finish', async () => {
      await page.getByText('출처 실행 설정 확인', { exact: true }).click();
      await expect(page.getByRole('button', { name: '실행 설정 다시 조회' })).toBeEnabled();
      const query = await hold(page, listPath),
        runtime = await hold(page, runtimePath);
      try {
        await page.getByRole('button', { name: '조회', exact: true }).click();
        await query.started;
        await page.getByRole('button', { name: '실행 설정 다시 조회' }).click();
        await runtime.started;
        await expect(bar).toBeVisible();
        query.release();
        await expect(page.getByRole('button', { name: '조회', exact: true })).toBeEnabled();
        await page.waitForTimeout(400);
        await expect(bar).toBeVisible();
        runtime.release();
        await expect(bar).toHaveCount(0);
      } finally {
        await query.cleanup();
        await runtime.cleanup();
      }
    });

    await t.test('automatic runtime polling is silent, manual request is visible', async () => {
      await page.clock.install();
      // Re-enter so polling timers are registered with the controlled clock.
      await page.goto(f.origin + '/admin/batch');
      await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}));
      await expect(page.getByRole('button', { name: '수집 요청', exact: true })).toBeEnabled();
      await expect(bar).toHaveCount(0);
      const runtime = await hold(page, runtimePath);
      try {
        await page.clock.fastForward(31000);
        await runtime.started;
        await page.clock.fastForward(1000);
        await expect(bar).toHaveCount(0);
        runtime.release();
      } finally {
        await runtime.cleanup();
      }
    });

    await t.test('route navigation and same-page common code reload use the same bar', async () => {
      const groups = await hold(page, /\/api\/v1\/admin\/common-code-groups$/);
      try {
        await page
          .getByRole('navigation', { name: '관리 메뉴' })
          .getByRole('link', { name: '공통코드 관리' })
          .click();
        await groups.started;
        await expect(bar).toBeVisible();
        groups.release();
        await expect(
          page.getByRole('heading', { name: '공통코드 관리', exact: true })
        ).toBeVisible();
        await expect(bar).toHaveCount(0);
      } finally {
        await groups.cleanup();
      }
      const codes = await hold(page, /\/api\/v1\/admin\/common-code-groups\/source\/codes$/);
      try {
        await page.getByRole('button', { name: '최신 목록 다시 조회' }).click();
        await codes.started;
        await expect(bar).toBeVisible();
        await expect(page.getByRole('button', { name: '목록 조회 중…' })).toBeDisabled();
        codes.release();
        await expect(bar).toHaveCount(0);
      } finally {
        await codes.cleanup();
      }
    });
    await t.test(
      'leaving a screen releases its pending work without hiding new navigation work',
      async () => {
        const pending = await hold(page, /\/api\/v1\/admin\/common-code-groups\/source\/codes$/, false, true);
        try {
          await page.getByRole('button', { name: '최신 목록 다시 조회' }).click();
          await pending.started;
          await expect(bar).toBeVisible();
          await page
            .getByRole('navigation', { name: '관리 메뉴' })
            .getByRole('link', { name: '수집 결과 검수' })
            .click();
          await expect(
            page.getByRole('heading', { name: '수집 결과 검수', exact: true })
          ).toBeVisible();
          await expect(bar).toHaveCount(0);
        } finally {
          await pending.cleanup();
        }
      }
    );
    assert.deepEqual(errors, []);
  }
);
