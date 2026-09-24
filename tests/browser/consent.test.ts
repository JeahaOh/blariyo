import { object } from '../helpers/browser-values.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';

await test(
  'consent browser gate: no GA4 tag before grant, safe fields, withdrawal and storage failure',
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
              title: '분석 route 재방문 fixture',
              source: null,
              pinnedPosition: null,
              blocks: [{ type: 'TEXT', text: '분석 route 재방문 본문' }],
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
    const tags: string[] = [],
      containers: string[] = [],
      otherExternal: string[] = [];
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === fixture.origin) return route.continue();
      if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtm.js') {
        containers.push(url.href);
        return route.fulfill({ contentType: 'application/javascript', body: '' });
      }
      if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
        tags.push(url.href);
        // Exercise the real loader lifecycle without contacting Google or sending telemetry.
        return route.fulfill({
          contentType: 'application/javascript',
          body: 'window.__localTagLoaded = true;',
        });
      }
      otherExternal.push(url.href);
      return route.abort();
    });
    context.setDefaultTimeout(8000);
    context.setDefaultNavigationTimeout(15000);
    const page = await context.newPage();
    const cspErrors: string[] = [];
    page.on('console', (message) => {
      if (/content security policy/i.test(message.text())) cspErrors.push(message.text());
    });
    const response = await page.goto(fixture.origin + '/meme');
    assert.ok(response);
    const html = await response.text();
    assert.match(html, /<head><!-- Google Tag Manager -->\s*<script nonce="[^"]+">/);
    assert.match(html, /<body[^>]*><!-- Google Tag Manager \(noscript\) -->\s*<noscript>/);
    assert.equal(html.match(/<!-- Google Tag Manager -->/g)?.length, 1);
    assert.equal(html.match(/<!-- Google Tag Manager \(noscript\) -->/g)?.length, 1);
    assert.equal(containers.length, 1);
    assert.equal(new URL(containers[0] || '').searchParams.get('id'), 'GTM-5BRTQ5T3');
    const nonce = await page
      .locator('script[src*="/gtm.js?"]')
      .evaluate((element) => (element instanceof HTMLScriptElement ? element.nonce : ''));
    assert.ok(nonce);
    assert.ok(response.headers()['content-security-policy']?.includes(`'nonce-${nonce}'`));
    await expect(page.getByRole('complementary', { name: '쿠키 선택' })).toBeVisible();
    assert.equal(
      await page.evaluate(
        () =>
          window.dataLayer?.filter((entry) => 'event' in entry && entry.event === 'gtm.js').length
      ),
      1
    );
    assert.deepEqual(tags, []);
    await page.getByRole('button', { name: '필수만 사용', exact: true }).click();
    await expect(page.getByRole('complementary', { name: '쿠키 선택' })).toHaveCount(0);
    assert.deepEqual(tags, []);
    await page.getByRole('link', { name: '쿠키 설정', exact: true }).click();
    await page.getByRole('checkbox', { name: '이용 통계 분석 허용' }).check();
    await page.getByRole('button', { name: '선택 저장', exact: true }).click();
    await page.waitForFunction(
      () => '__localTagLoaded' in window && window.__localTagLoaded === true
    );
    assert.equal(tags.length, 1);
    const events = await page.evaluate(() => {
      if (!window.dataLayer) throw new Error('Missing analytics dataLayer');
      return window.dataLayer
        .filter((entry): entry is IArguments => Symbol.iterator in entry)
        .map((value): unknown[] => [...value]);
    });
    const pageViews = events.filter((entry) => entry[0] === 'event' && entry[1] === 'page_view');
    assert.equal(pageViews.length, 1);
    const event = pageViews[0];
    assert.ok(event);
    assert.equal(object(event[2]).page_title, '블라리요');
    assert.equal(object(event[2]).page_location, fixture.origin + '/analytics/list');
    assert.equal(object(event[2]).page_referrer, '');
    await page.evaluate(() => {
      document.cookie = '_ga=fixture; Path=/';
      document.cookie = '_ga_TEST=fixture; Path=/';
    });
    await page.getByRole('link', { name: '쿠키 설정', exact: true }).click();
    await page.getByRole('checkbox', { name: '이용 통계 분석 허용' }).uncheck();
    await page.getByRole('button', { name: '선택 저장', exact: true }).click();
    await expect(page.locator('#blariyo-ga4')).toHaveCount(0);
    assert.equal(containers.length, 1, 'consent changes must not reload GTM');
    assert.equal(
      await page.evaluate(
        () =>
          window.dataLayer?.filter((entry) => 'event' in entry && entry.event === 'gtm.js').length
      ),
      1,
      'GA4 withdrawal must preserve GTM initialization'
    );
    assert.equal(await page.evaluate(() => window['ga-disable-G-TESTONLY']), true);
    assert.equal(
      (await context.cookies()).some((cookie) => cookie.name.startsWith('_ga')),
      false
    );
    await page.goto(fixture.origin + '/privacy');
    await expect(page.locator('.policy-body')).toContainText('fixture-current');
    assert.equal(tags.length, 1);
    await page.evaluate(() => localStorage.setItem('blariyo_consent', '{broken'));
    await page.reload();
    await expect(page.getByRole('complementary', { name: '쿠키 선택' })).toBeVisible();
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Blocked', 'SecurityError');
      };
    });
    await page.getByRole('button', { name: '모두 허용', exact: true }).click();
    await expect(
      page.getByText('선택을 저장할 수 없습니다. 분석 기능을 사용하지 않습니다.')
    ).toBeVisible();
    assert.equal(tags.length, 1);
    const remembered = await browser.newContext();
    t.after(() => remembered.close());
    const rememberedTags: string[] = [],
      rememberedContainers: string[] = [],
      rememberedExternal: string[] = [];
    await remembered.addInitScript(() =>
      localStorage.setItem(
        'blariyo_consent',
        JSON.stringify({
          version: 2,
          scope: 'analytics',
          analytics: true,
          ads: false,
          savedAt: new Date().toISOString(),
        })
      )
    );
    await remembered.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === fixture.origin) return route.continue();
      if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtm.js') {
        rememberedContainers.push(url.href);
        return route.fulfill({ contentType: 'application/javascript', body: '' });
      }
      if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') {
        rememberedTags.push(url.href);
        return route.fulfill({
          contentType: 'application/javascript',
          body: 'window.__rememberedTagLoaded = true;',
        });
      }
      rememberedExternal.push(url.href);
      return route.abort();
    });
    const rememberedPage = await remembered.newPage();
    await rememberedPage.goto(fixture.origin + '/meme');
    await rememberedPage.waitForFunction(
      () => '__rememberedTagLoaded' in window && window.__rememberedTagLoaded === true
    );
    const pageViewCount = () =>
      rememberedPage.evaluate(() => {
        if (!window.dataLayer) throw new Error('Missing analytics dataLayer');
        return window.dataLayer
          .filter((entry): entry is IArguments => Symbol.iterator in entry)
          .filter((entry) => entry[0] === 'event' && entry[1] === 'page_view').length;
      });
    await expect.poll(pageViewCount).toBe(1);
    await rememberedPage.locator('.post-row').first().click();
    await expect(rememberedPage.locator('article h1')).toBeVisible();
    await expect.poll(pageViewCount).toBe(2);
    await rememberedPage.locator('.detail-nav').getByRole('link', { name: '목록으로' }).click();
    await expect(rememberedPage.locator('.post-row')).toHaveCount(1);
    await expect.poll(pageViewCount).toBe(3);
    assert.equal(rememberedTags.length, 1);
    assert.equal(rememberedContainers.length, 1, 'SPA navigation must not reload GTM');
    assert.deepEqual(rememberedExternal, []);
    assert.deepEqual(otherExternal, []);
    assert.deepEqual(cspErrors, []);

    const noScript = await browser.newContext({ javaScriptEnabled: false });
    t.after(() => noScript.close());
    const frames: string[] = [];
    await noScript.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === fixture.origin) return route.continue();
      if (url.href === 'https://www.googletagmanager.com/ns.html?id=GTM-5BRTQ5T3') {
        frames.push(url.href);
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>GTM fixture</title>',
        });
      }
      return route.abort();
    });
    const noScriptPage = await noScript.newPage();
    await noScriptPage.goto(fixture.origin + '/cookie-settings');
    assert.equal(frames.length, 1, 'noscript iframe must load through CSP without JavaScript');
    await expect(noScriptPage.locator('body > noscript:first-child > iframe')).toHaveAttribute(
      'height',
      '0'
    );
    await expect(noScriptPage.locator('body > noscript:first-child > iframe')).toHaveAttribute(
      'width',
      '0'
    );
  }
);
