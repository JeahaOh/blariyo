import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { originalDirectory } from './original-import.mjs';

const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const id of [9, 8, 16, 17]) {
    const response = await page.goto(`http://127.0.0.1:59689/meme/posts/${id}`, {
      waitUntil: 'networkidle',
    });
    assert.equal(response.status(), 200);
    await page.locator('main').waitFor();
    const images = page.locator('main img');
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((node) => node.decode());
    }
    const imageStates = await images.evaluateAll((items) =>
      items.map((image) => ({ src: image.src, loaded: image.complete && image.naturalWidth > 0 }))
    );
    assert.ok(imageStates.length && imageStates.every((image) => image.loaded));
    checks.push({
      url: page.url(),
      httpStatus: response.status(),
      title: await page.title(),
      textCharacters: (await page.locator('main').innerText()).length,
      images: imageStates,
      stylesheets: await page
        .locator('link[rel="stylesheet"]')
        .evaluateAll((items) =>
          items.map((link) => ({ url: link.href, loaded: Boolean(link.sheet) }))
        ),
    });
    assert.ok(checks.at(-1).stylesheets.length);
    assert.ok(
      checks.at(-1).stylesheets.every((style) => style.loaded),
      'Stylesheet did not load'
    );
    if (id === 9) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: new URL('preview-post-9-styled.png', originalDirectory).pathname,
        fullPage: true,
      });
      await page.screenshot({
        path: new URL('preview-post-9-desktop.png', originalDirectory).pathname,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: new URL('preview-post-9-mobile.png', originalDirectory).pathname,
      });
      const width = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      assert.ok(width.document <= width.viewport, 'Mobile horizontal overflow');
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  new URL('browser-check.json', originalDirectory),
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      checks,
      visualReview: {
        contentAndImages: 'PASS',
        layout: checks.every(
          (check) => check.stylesheets.length && check.stylesheets.every((style) => style.loaded)
        )
          ? 'STYLES_LOADED'
          : 'FAIL_MISSING_STYLESHEET',
      },
    },
    null,
    2
  ) + '\n',
  { mode: 0o600 }
);
console.log(
  JSON.stringify({
    pages: checks.length,
    loadedImages: checks.reduce((n, check) => n + check.images.length, 0),
    screenshot: 'preview-post-9-styled.png',
    result: 'PASS',
  })
);
