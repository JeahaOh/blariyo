import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:3000';
const directory = new URL('../../.local-data/content-review/originals-20260920/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const report = { live: [], fallback: null, errors: [], network: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(message.text().slice(0, 400));
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (
      ['platform.x.com', 'platform.twitter.com', 'syndication.twitter.com'].includes(url.hostname)
    )
      report.network.push({ host: url.hostname, path: url.pathname, status: response.status() });
  });
  await page.goto(origin + '/meme/posts/10', { waitUntil: 'domcontentloaded' });
  const expectedText = {
    '2101299592734400792': /중학생때/,
    '2100941325210374558': /아빠가/,
    '2100505033410552194': /나 이거 웃겨/,
  };
  const cards = page.locator('.x-post');
  assert.equal(await cards.count(), 3);
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await card.locator('.x-widget.ready, .x-status').waitFor({ state: 'visible', timeout: 35000 });
    const id = await card.getAttribute('data-x-id');
    const embedded = (await card.locator('.x-widget.ready').count()) > 0;
    if (embedded) {
      await card
        .frameLocator('iframe')
        .getByText(expectedText[id])
        .first()
        .waitFor({ state: 'visible', timeout: 30000 });
    }
    report.live.push({
      id,
      embedded,
      iframeCount: await card.locator('iframe').count(),
      snapshotVisible: await card.locator('.x-snapshot').isVisible(),
    });
    console.log(JSON.stringify(report.live.at(-1)));
  }
  await cards.first().screenshot({ path: new URL('x-post-first-card.png', directory).pathname });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: new URL('x-posts-live-desktop.png', directory).pathname,
    fullPage: true,
  });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(origin + '/meme/posts/10', { waitUntil: 'domcontentloaded' });
  for (const card of await mobile.locator('.x-post').all()) {
    await card.scrollIntoViewIfNeeded();
    const id = await card.getAttribute('data-x-id');
    await card.locator('.x-widget.ready').waitFor({ timeout: 35000 });
    await card
      .frameLocator('iframe')
      .getByText(expectedText[id])
      .first()
      .waitFor({ timeout: 30000 });
    await card.screenshot({ path: new URL(`x-post-mobile-${id}.png`, directory).pathname });
  }
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.screenshot({
    path: new URL('x-posts-live-mobile.png', directory).pathname,
    fullPage: true,
  });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  const blocked = await browser.newPage({ viewport: { width: 320, height: 844 } });
  await blocked.route(/^https:\/\/platform\.(?:x|twitter)\.com\/widgets\.js/, (route) =>
    route.abort()
  );
  await blocked.goto(origin + '/meme/posts/10', { waitUntil: 'domcontentloaded' });
  const first = blocked.locator('.x-post').first();
  await first.locator('.x-status').waitFor({ timeout: 15000 });
  assert.equal(await first.locator('.x-text, .x-images').count(), 0);
  assert.equal(
    await first.getByRole('link', { name: 'X에서 보기' }).getAttribute('href'),
    'https://x.com/3everageclub/status/2101299592734400792'
  );
  const last = blocked.locator('.x-post').last();
  await last.scrollIntoViewIfNeeded();
  assert.equal(await last.locator('img').count(), 0);
  assert.ok(await blocked.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await blocked.evaluate(() => window.scrollTo(0, 0));
  await blocked.screenshot({
    path: new URL('x-posts-fallback-mobile.png', directory).pathname,
    fullPage: true,
  });
  report.fallback = {
    unavailableNotice: 'PASS',
    originalLink: 'PASS',
    noSnapshotReplacement: 'PASS',
    noHorizontalOverflowAt320: true,
  };
} finally {
  await browser.close();
}
report.verifiedAt = new Date().toISOString();
await writeFile(
  new URL('x-posts-browser-verification.json', directory),
  JSON.stringify(report, null, 2) + '\n',
  { mode: 0o600 }
);
console.log(
  JSON.stringify({
    live: report.live,
    fallback: report.fallback,
    errors: report.errors,
    network: report.network,
  })
);
