// Use the existing loopback development credential without printing or copying it.
// This is local test authentication, never a replacement for production Access.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const args = process.argv.slice(2);
const verify = args.includes('--verify');
const sandbox = args.find((arg) => arg.startsWith('--sandbox='));
assert.ok(
  new Set(args).size === args.length && args.every((arg) => arg === '--verify' || arg === sandbox),
  'Use --verify and/or --sandbox=<directory>'
);
const directory = sandbox?.slice('--sandbox='.length);
if (sandbox) {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const config = JSON.parse(await readFile(resolve(directory, 'sandbox.json'), 'utf8'));
  const database = new URL(config.databaseUrl);
  assert.ok(
    config.version === 1 &&
      ['127.0.0.1', 'localhost'].includes(database.hostname) &&
      /^\/blariyo_sandbox_[a-f0-9]{12}$/.test(database.pathname),
    'Invalid isolated sandbox'
  );
}
const origin = 'http://localhost:3000';
const browser = await chromium.launch({ headless: verify });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const response = await page.goto(origin + '/admin/login?returnTo=%2Fadmin');
  assert.equal(response.status(), 200, 'Start the local development server first');
  await expect(page.getByRole('button', { name: '개발 관리자 로그인' })).toBeVisible();
  await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
  await expect(page.getByRole('heading', { name: '게시글 관리', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '새 초안', exact: true })).toBeEnabled();
  if (verify) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin + '/admin/login?returnTo=%2Fadmin');
    const adminLink = page.getByRole('link', { name: '관리 화면으로' });
    const logoutButton = page.getByRole('button', { name: '로그아웃' });
    await expect(adminLink).toBeVisible();
    await expect(logoutButton).toBeVisible();
    const buttonGap = await page.evaluate(() => {
      const primary = document.querySelector('.login-actions .admin-button');
      const signout = document.querySelector('.login-actions .login-signout');
      if (!primary || !signout) return -1;
      return signout.getBoundingClientRect().top - primary.getBoundingClientRect().bottom;
    });
    assert.ok(buttonGap >= 12, `login actions must have a visible gap, got ${buttonGap}px`);
    await mkdir('.local-data/verification', { recursive: true });
    await page.screenshot({
      path: '.local-data/verification/admin-login-authenticated-3000.png',
      fullPage: true,
    });
    await adminLink.click();
    await expect(page.getByRole('heading', { name: '게시글 관리', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '새 초안', exact: true }).click();
    await expect(page.getByRole('heading', { name: '새 초안 작성' })).toBeFocused();
    await mkdir('.local-data/verification', { recursive: true });
    await page.screenshot({ path: '.local-data/verification/admin-core-3000.png', fullPage: true });
    const list = await context.request.get(origin + '/api/v1/admin/posts');
    assert.equal(list.status(), 200);
    const body = await list.json();
    assert.ok(Array.isArray(body.data.items));
    assert.equal(await page.locator('.admin-result').count(), body.data.items.length);
    const features = await context.request.get(origin + '/api/admin/features');
    assert.equal(features.status(), 200);
    assert.equal((await features.json()).batchReview, true);
    await page.getByRole('link', { name: '수집 결과 검수' }).click();
    await expect(page.getByRole('heading', { name: '수집 결과 검수', exact: true })).toBeVisible();
    const batchItems = page.locator('.batch-list [data-item-id]');
    await expect(batchItems).not.toHaveCount(0);
    const batchItemCount = await batchItems.count();
    await batchItems.first().click();
    await expect(page.locator('.batch-detail h2')).toBeVisible();
    await mkdir('.local-data/verification', { recursive: true });
    await page.screenshot({
      path: '.local-data/verification/admin-batch-3000.png',
      fullPage: true,
    });
    const anonymous = await browser.newContext();
    assert.equal((await anonymous.request.get(origin + '/api/v1/admin/posts')).status(), 401);
    await anonymous.close();
    assert.deepEqual(errors, []);
    await writeFile(
      '.local-data/verification/admin-core-3000.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          origin,
          authentication: 'local-test-session',
          operatorAccess: 'not-verified',
          writes: 0,
          listItems: body.data.items.length,
          batchItems: batchItemCount,
          batchDetailOpened: true,
          anonymousStatus: 401,
          browserErrors: errors,
        },
        null,
        2
      )
    );
    console.log(
      'localhost:3000 admin UI/API verified; no content writes; local test authentication only.'
    );
  } else {
    console.log('Local test-authenticated administrator browser: http://localhost:3000/admin');
    await new Promise((resolve) => browser.on('disconnected', resolve));
  }
} finally {
  await browser.close();
}
