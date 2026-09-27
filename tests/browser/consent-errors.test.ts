import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { browserFixture } from '../helpers/browser-fixture.ts';

await test('UX05: consent read/delete/write failures remain denied and can be retried', { timeout: 120000 }, async (t) => {
  const fixture = await browserFixture(t, { analytics: true });
  const browser = await launchBrowser();
  t.after(() => browser.close());
  for (const mode of ['read', 'json', 'schema', 'delete-throw', 'delete-silent', 'write'] as const) {
    await t.test(mode, async () => {
      const context = await browser.newContext({ viewport: { width: 320, height: 850 } });
      try {
        context.setDefaultTimeout(8000);
        const tags: string[] = [], external: string[] = [], errors: string[] = [];
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          if (url.origin === fixture.origin) return route.continue();
          if (url.href === 'https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3') return route.fulfill({ contentType: 'application/javascript', body: '' });
          if (url.href === 'https://www.googletagmanager.com/gtag/js?id=G-TESTONLY') {
            tags.push(url.href);
            return route.fulfill({ contentType: 'application/javascript', body: '' });
          }
          external.push(url.href); return route.abort();
        });
        await context.addInitScript((mode) => {
          if (mode === 'json') localStorage.setItem('blariyo_consent', '{broken');
          if (mode === 'schema') localStorage.setItem('blariyo_consent', '{"version":1}');
          if (mode === 'read') {
            const original = Storage.prototype.getItem.bind(localStorage);
            Storage.prototype.getItem = function (key) {
              if (key === 'blariyo_consent') throw new DOMException('blocked', 'SecurityError');
              return original(key);
            };
            window.addEventListener('fixture-unblock-read', () => { Storage.prototype.getItem = original; }, { once: true });
          }
        }, mode);
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(fixture.origin + '/cookie-settings');
        const settings = page.locator('main');
        const checkbox = settings.getByRole('checkbox', { name: '이용 통계 분석 허용' });
        await expect(checkbox).toBeVisible();
        if (['read', 'json', 'schema'].includes(mode)) {
          await expect(settings.getByRole('status')).toContainText('저장된 선택을 읽을 수 없습니다.');
          await expect(checkbox).not.toBeChecked();
          assert.equal(tags.length, 0);
          assert.equal(await page.evaluate(() => window['ga-disable-G-TESTONLY']), true);
          await page.evaluate(() => {
            window.dispatchEvent(new Event('fixture-unblock-read'));
            localStorage.removeItem('blariyo_consent');
          });
          await settings.getByRole('button', { name: '다시 시도', exact: true }).click();
          await expect(settings.getByRole('status')).toBeEmpty();
          assert.equal(tags.length, 0);
        } else {
          await checkbox.check();
          await settings.getByRole('button', { name: '선택 저장', exact: true }).click();
          await expect.poll(() => tags.length).toBe(1);
          await page.evaluate((mode) => {
            if (mode === 'write') {
              const original = Storage.prototype.setItem.bind(localStorage);
              Storage.prototype.setItem = function (key, value) {
                if (key === 'blariyo_consent') throw new DOMException('blocked', 'SecurityError');
                return original(key, value);
              };
              window.addEventListener('fixture-unblock-write', () => { Storage.prototype.setItem = original; }, { once: true });
            } else {
              document.cookie = '_ga=fixture; Path=/';
              Object.defineProperty(document, 'cookie', {
                configurable: true, get: () => '_ga=fixture',
                set: () => { if (mode === 'delete-throw') throw new DOMException('blocked', 'SecurityError'); },
              });
            }
          }, mode);
          await checkbox.uncheck();
          await settings.getByRole('button', { name: '선택 저장', exact: true }).click();
          await expect(settings.getByRole('status')).toContainText(mode === 'write' ? '선택을 저장할 수 없습니다.' : '분석 쿠키를 삭제하지 못했습니다.');
          await expect(page.locator('#blariyo-ga4')).toHaveCount(0);
          assert.equal(await page.evaluate(() => window['ga-disable-G-TESTONLY']), true);
          assert.equal(tags.length, 1);
          // A retry while the fault remains must preserve the error and disabled state.
          await settings.getByRole('button', { name: '다시 시도', exact: true }).click();
          await expect(settings.getByRole('status')).not.toBeEmpty();
          assert.equal(tags.length, 1);
          if (mode === 'delete-silent') {
            await mkdir('worklog/2026-09-27/m0-implementation/artifacts', { recursive: true });
            await page.screenshot({ path: 'worklog/2026-09-27/m0-implementation/artifacts/consent-delete-320.png', fullPage: true });
          }
          await page.evaluate(() => {
            window.dispatchEvent(new Event('fixture-unblock-write'));
            Reflect.deleteProperty(document, 'cookie');
          });
          await settings.getByRole('button', { name: '다시 시도', exact: true }).click();
          await expect(settings.getByRole('status')).toBeEmpty();
          await expect(checkbox).not.toBeChecked();
          assert.match(await page.evaluate(() => localStorage.getItem('blariyo_consent') ?? ''), /"analytics":false/);
          assert.equal((await context.cookies()).some((cookie) => cookie.name.startsWith('_ga')), false);
          assert.equal(tags.length, 1, 'withdrawal retry cannot restore a previous grant');
        }
        assert.deepEqual(external, []); assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
  const disabled = await browserFixture(t);
  const context = await browser.newContext();
  t.after(() => context.close());
  const requests: string[] = [];
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === disabled.origin) return route.continue();
    if (route.request().url() === 'https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3') return route.fulfill({ contentType: 'application/javascript', body: '' });
    requests.push(route.request().url()); return route.abort();
  });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  const page = await context.newPage();
  await page.goto(disabled.origin + '/cookie-settings');
  await expect(page.locator('main')).toContainText('현재 활성화된 저장소가 없습니다');
  await expect(page.locator('main').getByRole('status')).toBeEmpty();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  assert.deepEqual(requests, []);
});
