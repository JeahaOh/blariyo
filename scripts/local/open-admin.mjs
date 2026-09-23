// Use the existing loopback development credential without printing or copying it.
// This is local test authentication, never a replacement for production Access.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const args = process.argv.slice(2);
const verify = args.includes('--verify');
const sandbox = args.find((arg) => arg.startsWith('--sandbox='));
assert.ok(
  new Set(args).size === args.length && args.every((arg) => arg === '--verify' || arg === sandbox),
  'Use --verify and/or --sandbox=<directory>'
);
const directory = sandbox
  ? resolve(sandbox.slice('--sandbox='.length))
  : resolve('.local-data/development');
if (sandbox) {
  const config = JSON.parse(await readFile(resolve(directory, 'sandbox.json'), 'utf8'));
  const database = new URL(config.databaseUrl);
  assert.ok(
    config.version === 1 &&
      ['127.0.0.1', 'localhost'].includes(database.hostname) &&
      /^\/blariyo_sandbox_[a-f0-9]{12}$/.test(database.pathname),
    'Invalid isolated sandbox'
  );
}
const session = JSON.parse(await readFile(resolve(directory, 'session.json'), 'utf8'));
assert.equal(session.origin, 'http://localhost:3000');
assert.ok(
  typeof session.adminToken === 'string' && /^[a-f0-9]{64}$/.test(session.adminToken),
  'Invalid local session; restart the local server'
);
const browser = await chromium.launch({ headless: verify });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([
    {
      name: 'BLARIYO_ADMIN_SESSION',
      value: session.adminToken,
      url: session.origin,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  const response = await page.goto(session.origin + '/admin');
  assert.equal(
    response.status(),
    200,
    'Restart the local server if the development session expired'
  );
  await expect(page.getByRole('heading', { name: '게시글 관리', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '새 초안', exact: true })).toBeEnabled();
  if (verify) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.getByRole('button', { name: '새 초안', exact: true }).click();
    await expect(page.getByRole('heading', { name: '새 초안 작성' })).toBeFocused();
    await mkdir('.local-data/verification', { recursive: true });
    await page.screenshot({ path: '.local-data/verification/admin-core-3000.png', fullPage: true });
    const list = await context.request.get(session.origin + '/api/v1/admin/posts');
    assert.equal(list.status(), 200);
    const body = await list.json();
    assert.ok(Array.isArray(body.data.items));
    assert.equal(await page.locator('.admin-result').count(), body.data.items.length);
    const anonymous = await browser.newContext();
    assert.equal(
      (await anonymous.request.get(session.origin + '/api/v1/admin/posts')).status(),
      401
    );
    await anonymous.close();
    assert.deepEqual(errors, []);
    await writeFile(
      '.local-data/verification/admin-core-3000.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          origin: session.origin,
          authentication: 'local-test-session',
          operatorAccess: 'not-verified',
          writes: 0,
          listItems: body.data.items.length,
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
