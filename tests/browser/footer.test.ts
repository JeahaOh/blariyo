import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';

await test('Footer rights inquiry and contrasting shell', { timeout: 90000 }, async (t) => {
  const fixture = await browserFixture(t, { rightsEmail: 'rights@example.test' });
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  t.after(() => page.close());
  const alerts: string[] = [];
  page.on('dialog', async (dialog) => {
    alerts.push(dialog.message());
    await dialog.accept();
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText(text: string) {
          if (document.documentElement.dataset.denyCopy)
            return Promise.reject(new Error('Clipboard denied'));
          document.documentElement.dataset.copied = text;
          document.documentElement.dataset.copyCount = String(
            Number(document.documentElement.dataset.copyCount || 0) + 1
          );
          return Promise.resolve();
        },
      },
    });
    // Preserve the component click handler but never launch an external mail client in tests.
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[href^="mailto:"]')) {
        event.preventDefault();
      }
    });
  });
  await page.goto(fixture.origin + '/meme');
  const rights = page.getByRole('link', { name: '권리 문의', exact: true });
  await expect(rights).toBeVisible();
  await page.clock.install();
  await t.test('responsive footer and header are distinct from the outer canvas', async () => {
    await expect(page.getByRole('button', { name: '이메일 주소 복사' })).toHaveCount(0);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => ({
        header: getComputedStyle(document.querySelector('.site-header')!).backgroundColor,
        canvas: getComputedStyle(document.body).backgroundColor,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.notEqual(layout.header, layout.canvas);
      assert.equal(layout.overflow, false);
      await expect(page.locator('footer nav a')).toHaveCount(4);
    }
  });
  await t.test('copies recipient, subject and current page template then alerts', async () => {
    await rights.click();
    await page.clock.fastForward(1700);
    await expect.poll(() => alerts.length).toBe(1);
    assert.match(alerts[0]!, /복사했습니다/);
    const copied = await page.evaluate(() => document.documentElement.dataset.copied);
    assert.match(copied!, /받는 사람: rights@example.test\n제목:/);
    assert.ok(copied!.includes(`대상 URL: ${fixture.origin}/meme`));
    assert.match(copied!, /요청 내용:.*\n권리자 확인 자료:.*\n회신 연락처:/);
  });
  await t.test('departure cancels fallback without claiming mail success', async () => {
    await rights.click();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.clock.fastForward(2000);
    assert.equal(alerts.length, 1);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.copyCount), '1');
  });
  await t.test('repeated clicks leave a single pending fallback', async () => {
    await rights.click();
    await rights.click();
    await page.clock.fastForward(1700);
    await expect.poll(() => alerts.length).toBe(2);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.copyCount), '2');
  });
  await t.test('clipboard denial exposes selectable template and restores focus', async () => {
    await page.evaluate(() => {
      document.documentElement.dataset.denyCopy = 'true';
    });
    await rights.click();
    await page.clock.fastForward(1700);
    const dialog = page.getByRole('dialog', { name: '권리 문의 양식' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => alerts.length).toBe(3);
    assert.match(alerts[2]!, /자동 복사가 허용되지/);
    const textarea = dialog.getByRole('textbox');
    await expect(textarea).toHaveValue(/받는 사람: rights@example.test/);
    assert.ok(
      await textarea.evaluate(
        (node: HTMLTextAreaElement) =>
          node.readOnly && node.selectionEnd === node.value.length && node.selectionStart === 0
      )
    );
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(rights).toBeFocused();
  });
  await t.test('route change cancels the pending fallback', async () => {
    await page.goto(fixture.origin + '/privacy');
    await expect(rights).toBeVisible();
    await rights.click();
    await page.locator('.footer-brand').click();
    await page.waitForURL(fixture.origin + '/meme');
    await page.clock.fastForward(2000);
    assert.equal(alerts.length, 3);
  });
});
