import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { object } from '../helpers/browser-values.ts';

await test('UX01–04: policy focus, SSR fallback, pagination and retry/share states', { timeout: 120000 }, async (t) => {
  const fixture = await browserFixture(t, { policyParagraphs: 70 });
  for (let i = 0; i < 22; i++) {
    const post = object((await fixture.posts.command({ action: 'create', params: {}, body: {
      boardSlug: 'meme', title: `공개 화면 검증 ${i}`, source: null, pinnedPosition: null,
      blocks: [{ type: 'TEXT', text: `본문 유지 검증 ${i}` }],
    } }, 'system:scheduler')).data);
    await fixture.posts.command({ action: 'publish', params: { postId: String(post.postId) }, body: { lockVersion: 1, mode: 'IMMEDIATE' } }, 'system:scheduler');
  }
  const browser = await launchBrowser(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 320, height: 850 } });
  const external: string[] = [], errors: string[] = [];
  await context.route('**/*', (route) => {
    if (route.request().url() === 'https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3')
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (new URL(route.request().url()).origin !== fixture.origin) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  context.setDefaultTimeout(8000);
  await page.goto(fixture.origin + '/meme');
  await page.waitForFunction(() => { const root = document.querySelector('#__nuxt'); return root !== null && '__vue_app__' in root && !!root.__vue_app__; });
  // Render the unchanged static HTML/JS with its real CSS in a local route fixture.
  const publishing = await browser.newContext();
  const staticErrors: string[] = [], staticExternal: string[] = [];
  const staticFiles = new Map(await Promise.all(['index.html', 'styles.css', 'app.js'].map(async (name) => [name, await readFile(`docs/ui/publishing/responsive/${name}`, 'utf8')] as const)));
  await publishing.route('**/*', (route) => {
    const url = new URL(route.request().url()), name = url.pathname.slice(1) || 'index.html';
    const body = url.origin === 'http://publishing.local' ? staticFiles.get(name) : undefined;
    if (body === undefined) { staticExternal.push(url.href); return route.abort(); }
    return route.fulfill({ contentType: name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'application/javascript' : 'text/html', body });
  });
  const staticPage = await publishing.newPage(); staticPage.on('pageerror', (error) => staticErrors.push(error.message));
  await staticPage.goto('http://publishing.local/');
  await mkdir('test-results/browser', { recursive: true });
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await staticPage.setViewportSize({ width, height: 850 });
    assert.equal(await page.locator('.board-tabs a').first().evaluate((link) => getComputedStyle(link).borderBottomColor), 'rgb(0, 161, 155)');
    assert.equal(await staticPage.locator('.board-tabs a').first().evaluate((link) => getComputedStyle(link, '::after').backgroundColor), 'rgb(0, 161, 155)');
    for (const [label, target] of [['app', page], ['publishing', staticPage]] as const) {
      assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label} ${width}px overflow`);
      await target.screenshot({ path: `test-results/browser/teal-${label}-${width}.png` });
    }
  }
  assert.deepEqual(staticErrors, []); assert.deepEqual(staticExternal, []);
  await publishing.close();
  await page.setViewportSize({ width: 320, height: 850 });
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(page.locator('.post-row')).toHaveCount(2);
  await expect(page.locator('.list-heading h1')).toBeFocused();
  await expect(page.locator('.list-summary')).toContainText('2쪽');
  assert.match(await page.locator('main').ariaSnapshot(), /heading .*level=1/);
  await page.locator('.post-row').first().click();
  const heading = page.locator('article h1'); await expect(heading).toBeVisible();
  const title = await heading.textContent();
  const ssr = await (await context.request.get(page.url())).text();
  const meta = await page.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const value = (key: string) => document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.getAttribute('content') ?? null;
    return { image: value('og:image'), twitter: value('twitter:image'), alt: value('og:image:alt'), width: value('og:image:width'), height: value('og:image:height'), twitterAlt: value('twitter:image:alt') };
  }, ssr);
  assert.match(meta.image ?? '', /\/og\/blariyo-default\.png$/); assert.equal(meta.twitter, meta.image);
  assert.deepEqual([meta.alt, meta.width, meta.height, meta.twitterAlt], [null, null, null, null]);

  let requests = 0;
  const started = Promise.withResolvers<void>(), held = Promise.withResolvers<void>();
  await page.route('**/api/v1/boards/meme/posts?page=1', async (route) => {
    requests++;
    if (requests === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DEPENDENCY_UNAVAILABLE' } }) });
    started.resolve(); await held.promise; await route.continue();
  });
  await page.getByRole('button', { name: '이전 페이지' }).click();
  const bottom = page.getByRole('region', { name: '같은 게시판 목록' });
  await expect(bottom.getByRole('alert')).toContainText('목록을 불러오지 못했습니다.');
  await bottom.getByRole('button', { name: '목록 다시 시도' }).click(); await started.promise;
  try {
    for (const button of await bottom.locator('.pagination button').all()) await expect(button).toBeDisabled();
    assert.equal(requests, 2);
  } finally { held.resolve(); }
  await expect(bottom.locator('.post-row')).toHaveCount(20);
  await expect(bottom.getByRole('alert')).toHaveCount(0); await expect(heading).toHaveText(title ?? '');

  await page.getByRole('button', { name: '공유하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '공유하기' });
  for (const [mode, message] of [['success', '공유했습니다.'], ['cancel', '공유를 취소했습니다.'], ['failure', '공유하지 못했습니다. 링크 복사를 이용해 주세요.']] as const) {
    await page.evaluate((mode) => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: () => {
        if (mode === 'cancel') return Promise.reject(new DOMException('Fixture cancellation', 'AbortError'));
        if (mode === 'failure') return Promise.reject(new Error('Fixture share failure'));
        return Promise.resolve();
      } });
    }, mode);
    await dialog.getByRole('button', { name: '브라우저 공유' }).click();
    await expect(dialog.getByRole('status')).toHaveText(message);
  }
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await dialog.getByRole('button', { name: '브라우저 공유' }).click();
  await expect(dialog.getByRole('status')).toHaveText('브라우저 공유를 지원하지 않습니다. 링크를 복사했습니다.');
  await mkdir('test-results/browser', { recursive: true });
  await page.screenshot({ path: 'test-results/browser/public-share-320.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '공유하기', exact: true })).toBeFocused();

  await page.getByRole('link', { name: '이용약관', exact: true }).click();
  const policy = page.locator('dialog[open]');
  await policy.getByRole('button', { name: /fixture-old/ }).click();
  await expect(policy.locator('.policy-body')).toContainText('fixture-old');
  await expect(policy.locator('h1')).toBeFocused();
  assert.ok(await policy.evaluate((element) => element.scrollTop < 80));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/browser/policy-focus-320.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: '이용약관', exact: true })).toBeFocused();
  await page.goto(fixture.origin + '/terms');
  await page.getByRole('button', { name: /fixture-old/ }).click();
  await expect(page.locator('.policy-viewer h1')).toBeFocused();
  assert.ok(await page.locator('.policy-viewer h1').evaluate((element) => element.getBoundingClientRect().top >= 0 && element.getBoundingClientRect().top < 200));
  assert.deepEqual(external, []); assert.deepEqual(errors, []);
});
