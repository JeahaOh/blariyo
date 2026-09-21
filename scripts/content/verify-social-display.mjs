import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:3000';
const directory = new URL('../../.local-data/content-review/social-embeds/', import.meta.url);
await mkdir(directory, { recursive: true, mode: 0o700 });
async function fingerprint() {
  const posts = [];
  const ids = new Set();
  for (const page of [1, 2]) {
    const { data } = await (await fetch(`${origin}/api/v1/boards/meme/posts?page=${page}`)).json();
    for (const item of [...data.items, ...data.pinnedItems]) ids.add(item.postId);
  }
  assert.equal(ids.size, 25);
  for (const id of [...ids].sort((a, b) => a - b)) {
    const response = await fetch(`${origin}/api/v1/boards/meme/posts/${id}`);
    assert.equal(response.status, 200);
    const { data } = await response.json();
    posts.push({ id, blocks: data.post.blocks });
  }
  return createHash('sha256').update(JSON.stringify(posts)).digest('hex');
}
const before = await fingerprint();
const fixture = await (await fetch(`${origin}/api/v1/boards/meme/posts/25`)).json();
const browser = await chromium.launch({ headless: true });
const report = { live: [], simulated: [], errors: [], before };
async function settled(card) {
  await card.scrollIntoViewIfNeeded();
  await card
    .page()
    .waitForFunction(
      (element) => !['idle', 'loading'].includes(element?.getAttribute('data-state')),
      await card.elementHandle(),
      { timeout: 30000 }
    );
  return card.getAttribute('data-state');
}
async function fixturePage(blocks, configure) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const payload = structuredClone(fixture);
  payload.data.post.blocks = blocks;
  payload.data.post.title = 'SNS 임베드 브라우저 검증';
  await page.route('**/api/v1/boards/meme/posts/25*', (route) => route.fulfill({ json: payload }));
  if (configure) await configure(page);
  await page.goto(origin + '/meme', { waitUntil: 'domcontentloaded' });
  await page.locator('a[href="/meme/posts/25"]').first().click();
  return page;
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', (error) => report.errors.push(error.message.slice(0, 300)));
  for (const id of [2, 5, 23, 25]) {
    await page.goto(`${origin}/meme/posts/${id}`, { waitUntil: 'domcontentloaded' });
    const cards = page.locator('.social-post');
    assert.ok(await cards.count());
    for (const card of await cards.all()) {
      const state = await settled(card);
      const provider = await card.getAttribute('data-provider');
      const socialId = await card.getAttribute('data-social-id');
      const evidence = {
        postId: id,
        provider,
        id: socialId,
        state,
        iframeCount: await card.locator('iframe').count(),
      };
      report.live.push(evidence);
      console.log(JSON.stringify(evidence));
      if (state === 'embedded') {
        // A native frame is inspected separately; frame load alone is not content availability.
        evidence.frameText = (
          await card.frameLocator('iframe').locator('body').innerText({ timeout: 10000 })
        ).slice(0, 220);
      }
      await card.screenshot({ path: new URL(`${provider}-${socialId}.png`, directory).pathname });
    }
  }
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(origin + '/meme/posts/25', { waitUntil: 'domcontentloaded' });
  for (const card of await mobile.locator('.social-post').all()) await settled(card);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile
    .locator('.social-post')
    .first()
    .screenshot({ path: new URL('instagram-mobile.png', directory).pathname });

  // The imported batch has no TikTok URL. Supply the official documentation's example
  // through a browser-only API fixture; the application database is not changed.
  const tikTok = await fixturePage([
    { type: 'TEXT', text: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' },
  ]);
  const tikTokCard = tikTok.locator('.social-post');
  const tikTokState = await settled(tikTokCard);
  const tikTokEvidence = {
    provider: 'TIKTOK',
    source: 'official-example-browser-fixture',
    state: tikTokState,
  };
  report.live.push(tikTokEvidence);
  console.log(JSON.stringify(tikTokEvidence));
  if (tikTokState === 'embedded') {
    await tikTokCard
      .frameLocator('iframe')
      .locator('video')
      .waitFor({ state: 'attached', timeout: 20000 })
      .catch(() => {});
    tikTokEvidence.frameText = (
      await tikTokCard.frameLocator('iframe').locator('body').innerText()
    ).slice(0, 220);
    tikTokEvidence.videoElements = await tikTokCard.frameLocator('iframe').locator('video').count();
  }
  await tikTokCard.screenshot({ path: new URL('tiktok-mobile.png', directory).pathname });
  assert.ok(await tikTok.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  for (const [code, expected] of [
    [100, 'unavailable'],
    [101, 'restricted'],
    [153, 'failed'],
  ]) {
    const simulated = await fixturePage(
      [{ type: 'TEXT', text: 'https://youtu.be/Jk5P8d5z8-I' }],
      async (page) => {
        await page.route('https://www.youtube.com/embed/**', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<html><body>Player fixture</body></html>',
          })
        );
        await page.route('https://www.youtube.com/iframe_api', (route) =>
          route.fulfill({
            contentType: 'application/javascript',
            body: `window.YT={Player:class {constructor(element,options){this.element=element;setTimeout(()=>options.events.onError({data:${code}}),20)}destroy(){this.element.remove()}}};`,
          })
        );
      }
    );
    const card = simulated.locator('.social-post');
    assert.equal(await settled(card), expected);
    assert.equal(await card.locator('iframe').count(), 0);
    assert.ok(await card.getByRole('link', { name: 'YouTube에서 보기' }).isVisible());
    report.simulated.push({ provider: 'YOUTUBE', code, state: expected, result: 'PASS' });
    await simulated.close();
  }
  const unavailable = await fixturePage(
    [{ type: 'TEXT', text: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' }],
    async (page) => {
      await page.route('https://www.tiktok.com/player/v1/**', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<script>parent.postMessage({'x-tiktok-player':true,type:'onPlayerError',value:{errorCode:1001}},'${origin}')</script>`,
        })
      );
    }
  );
  await unavailable.waitForFunction(
    () => document.querySelector('.social-post')?.getAttribute('data-state') === 'unavailable',
    undefined,
    { timeout: 10000 }
  );
  report.simulated.push({ provider: 'TIKTOK', code: 1001, state: 'unavailable', result: 'PASS' });

  const blocked = await fixturePage(
    [{ type: 'TEXT', text: 'https://www.instagram.com/p/DdWryEimgTl/' }],
    async (page) => {
      await page.route('https://www.instagram.com/embed.js', (route) => route.abort());
    }
  );
  assert.equal(await settled(blocked.locator('.social-post')), 'failed');
  assert.ok(await blocked.getByRole('link', { name: 'Instagram에서 보기' }).isVisible());
  report.simulated.push({ provider: 'INSTAGRAM', condition: 'SDK_BLOCKED', result: 'PASS' });
  await blocked.unroute('https://www.instagram.com/embed.js');
  await blocked.getByRole('button', { name: '다시 불러오기' }).click();
  report.simulated.push({
    provider: 'INSTAGRAM',
    condition: 'RETRY_WITH_LIVE_SDK',
    state: await settled(blocked.locator('.social-post')),
  });
  report.after = await fingerprint();
  assert.equal(report.before, report.after);
  report.databaseBlocksUnchanged = true;
} finally {
  await browser.close();
  report.verifiedAt = new Date().toISOString();
  await writeFile(new URL('verification.json', directory), JSON.stringify(report, null, 2) + '\n', {
    mode: 0o600,
  });
}
console.log(JSON.stringify(report, null, 2));
