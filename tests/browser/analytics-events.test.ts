import { object } from '../helpers/browser-values.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';

await test(
  'analytics detail events: active article time and linked native-share fallback',
  { timeout: 90000 },
  async (t) => {
    const fixture = await browserFixture(t, { analytics: true });
    const draft = object(
      (
        await fixture.posts.command(
          {
            action: 'create',
            params: {},
            body: {
              boardSlug: 'meme',
              title: '체류·공유 이벤트 테스트',
              source: null,
              pinnedPosition: null,
              blocks: [{ type: 'TEXT', text: '격리 브라우저 테스트 본문입니다.' }],
            },
          },
          'system:scheduler'
        )
      ).data
    );
    assert.ok(typeof draft.postId === 'number');
    assert.ok(typeof draft.lockVersion === 'number');
    await fixture.posts.command(
      {
        action: 'publish',
        params: { postId: String(draft.postId) },
        body: { lockVersion: draft.lockVersion, mode: 'IMMEDIATE' },
      },
      'system:scheduler'
    );

    const browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext();
    t.after(() => context.close());
    const gtmRequests: string[] = [];
    const gtagRequests: string[] = [];
    const otherExternal: string[] = [];
    await context.addInitScript(() => {
      localStorage.setItem(
        'blariyo_consent',
        JSON.stringify({
          version: 3,
          scope: 'analytics_v1',
          analytics: true,
          ads: false,
          savedAt: new Date().toISOString(),
        })
      );
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
    });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === fixture.origin) return route.continue();
      if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtm.js') {
        gtmRequests.push(url.href);
        return route.fulfill({ contentType: 'application/javascript', body: '' });
      }
      if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
        gtagRequests.push(url.href);
        return route.fulfill({
          contentType: 'application/javascript',
          body: 'window.__localTagLoaded = true;',
        });
      }
      otherExternal.push(url.href);
      return route.abort();
    });
    const page = await context.newPage();
    const response = await page.goto(`${fixture.origin}/meme/posts/${draft.postId}`);
    assert.ok(response);
    await expect(page.locator('article h1')).toHaveText('체류·공유 이벤트 테스트');
    await page.waitForFunction(
      () => '__localTagLoaded' in window && window.__localTagLoaded === true
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.dataLayer
            ?.filter((entry): entry is IArguments => Symbol.iterator in entry)
            .some((entry) => entry[0] === 'event' && entry[1] === 'page_view')
        )
      )
      .toBe(true);

    const readEvents = async () => {
      const tuples = await page.evaluate(() => {
        if (!window.dataLayer) throw new Error('Missing analytics dataLayer');
        return window.dataLayer
          .filter((entry): entry is IArguments => Symbol.iterator in entry)
          .map((entry): unknown[] => [...entry])
          .filter((entry) => entry[0] === 'event');
      });
      return tuples.map((entry) => ({ name: String(entry[1]), params: object(entry[2]) }));
    };

    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: '공유하기' }).click();
    await page.getByRole('button', { name: '브라우저 공유' }).click();
    await expect
      .poll(
        async () => (await readEvents()).filter((event) => event.name === 'share_result').length
      )
      .toBe(2);

    const shareEvents = (await readEvents()).filter(
      (event) => event.name === 'share' || event.name === 'share_result'
    );
    const nativeStart = shareEvents.find(
      (event) => event.name === 'share' && event.params.share_method === 'native'
    );
    const nativeResult = shareEvents.find(
      (event) => event.name === 'share_result' && event.params.share_method === 'native'
    );
    const copyStart = shareEvents.find(
      (event) =>
        event.name === 'share' &&
        event.params.share_method === 'copy' &&
        'parent_attempt_key' in event.params
    );
    const copyResult = shareEvents.find(
      (event) =>
        event.name === 'share_result' &&
        event.params.share_method === 'copy' &&
        'parent_attempt_key' in event.params
    );
    assert.ok(nativeStart && nativeResult && copyStart && copyResult);
    assert.match(String(nativeStart.params.share_attempt_key), /^[0-9a-f-]{36}$/);
    assert.equal(nativeResult.params.share_attempt_key, nativeStart.params.share_attempt_key);
    assert.equal(nativeResult.params.share_outcome, 'unavailable');
    assert.match(String(copyStart.params.share_attempt_key), /^[0-9a-f-]{36}$/);
    assert.equal(copyResult.params.share_attempt_key, copyStart.params.share_attempt_key);
    assert.equal(copyStart.params.parent_attempt_key, nativeStart.params.share_attempt_key);
    assert.equal(copyResult.params.parent_attempt_key, nativeStart.params.share_attempt_key);
    assert.equal(copyResult.params.share_outcome, 'copied');
    assert.ok((await readEvents()).some((event) => event.name === 'share_open'));

    await page.keyboard.press('Escape');
    await expect
      .poll(
        async () =>
          (await readEvents()).filter((event) => event.name === 'content_engagement').length,
        { timeout: 20000, intervals: [1000] }
      )
      .toBeGreaterThan(0);
    const engagement = (await readEvents()).find((event) => event.name === 'content_engagement');
    assert.ok(engagement);
    assert.match(String(engagement.params.page_content_key), /^p1_[0-9a-f]{64}$/);
    assert.ok(Number(engagement.params.active_ms) > 0);
    assert.ok(['interval', 'hidden'].includes(String(engagement.params.flush_reason)));
    assert.equal(gtmRequests.length, 1);
    assert.equal(gtagRequests.length, 1);
    assert.deepEqual(otherExternal, []);
  }
);
