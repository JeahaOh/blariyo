import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { object } from '../helpers/browser-values.ts';

await test(
  'admin login and detail history preserve the list and unsaved edits',
  { timeout: 120000 },
  async (t) => {
    const fixture = await browserFixture(t);
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const post = object(
        (
          await fixture.posts.command(
            {
              action: 'create',
              params: {},
              body: {
                boardSlug: 'meme',
                title: `이동 검증 ${i}`,
                source: null,
                pinnedPosition: null,
                blocks: [{ type: 'TEXT', text: `본문 ${i}` }],
              },
            },
            'system:scheduler'
          )
        ).data
      );
      ids.push(String(post.postId));
    }
    const browser = await launchBrowser();
    t.after(() => browser.close());
    for (const width of [390, 1280]) {
      await t.test(
        `${width}px: login replacement, back/forward, refresh, direct entry and dirty guard`,
        async () => {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          const hydrate = () =>
            page.waitForFunction(() => '__vue_app__' in document.querySelector('#__nuxt')!);
          await page.goto(fixture.origin + '/meme');
          await page.goto(fixture.origin + '/admin/login');
          await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
          await expect(page).toHaveURL(fixture.origin + '/admin');
          await page.goBack();
          await expect(page).toHaveURL(fixture.origin + '/meme');
          await page.goForward();
          await expect(page).toHaveURL(fixture.origin + '/admin');
          await hydrate();
          const list = page.getByRole('complementary', { name: '게시글 검색 목록' });
          const searchTitle = list.getByLabel('제목', { exact: true });
          const title = page
            .getByRole('group', { name: '게시글 내용', includeHidden: true })
            .getByLabel('제목', { exact: true });
          const row = (id: string) => page.locator(`[data-post-id="${id}"]`);
          await searchTitle.fill('이동 검증');
          await list.getByRole('button', { name: '검색', exact: true }).click();
          await row(ids[0]!).click();
          await expect(page).toHaveURL(`${fixture.origin}/admin?postId=${ids[0]}`);
          await expect(title).toHaveValue('이동 검증 0');
          await expect(page.locator('section')).toHaveAttribute('aria-busy', 'false');
          await page.goBack();
          await expect(page).toHaveURL(fixture.origin + '/admin');
          await expect(list).toBeVisible();
          await expect(row(ids[0]!)).toBeFocused();
          await expect(searchTitle).toHaveValue('이동 검증');
          await page.goForward();
          await expect(title).toBeVisible();
          await expect(title).toHaveValue('이동 검증 0');
          await page.reload();
          await hydrate();
          await expect(title).toHaveValue('이동 검증 0');
          await expect(page.locator('section')).toHaveAttribute('aria-busy', 'false');
          await title.fill('보존할 미저장 제목');
          await page.goBack();
          await expect(list).toBeVisible();
          await expect(title).toHaveValue('보존할 미저장 제목');
          page.once('dialog', (dialog) => dialog.dismiss());
          await row(ids[1]!).click();
          await expect(page).toHaveURL(fixture.origin + '/admin');
          await expect(title).toHaveValue('보존할 미저장 제목');
          page.once('dialog', (dialog) => dialog.accept());
          await row(ids[1]!).click();
          await expect(title).toHaveValue('이동 검증 1');
          await expect(page).toHaveURL(`${fixture.origin}/admin?postId=${ids[1]}`);
          await expect(page.locator('section')).toHaveAttribute('aria-busy', 'false');
          // A direct detail URL must provide a list fallback without a preceding list visit.
          await page.goto(`${fixture.origin}/admin?postId=${ids[0]}`);
          await hydrate();
          await expect(title).toHaveValue('이동 검증 0');
          await expect(page.locator('section')).toHaveAttribute('aria-busy', 'false');
          if (width < 768) {
            await page.getByRole('button', { name: '목록으로', exact: true }).click();
            await expect(page).toHaveURL(fixture.origin + '/admin');
            await expect(list).toBeVisible();
            await row(ids[0]!).click();
            await expect(title).toBeVisible();
            await expect(page.locator('section')).toHaveAttribute('aria-busy', 'false');
            await page.getByRole('button', { name: '목록으로', exact: true }).click();
          }
          await page.getByRole('button', { name: '새 초안', exact: true }).click();
          await expect(page).toHaveURL(fixture.origin + '/admin');
          await expect(title).toBeVisible();
          await expect(title).toHaveValue('');
          assert.deepEqual(errors, []);
          await context.close();
        }
      );
    }
  }
);
