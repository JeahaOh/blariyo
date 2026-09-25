import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { object } from '../helpers/browser-values.ts';

await test(
  'uncertain saves survive authentication failures without duplicate writes',
  { timeout: 180000 },
  async (t) => {
    const fixture = await browserFixture(t);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: fixture.adminToken, url: fixture.origin },
    ]);
    const page = await context.newPage();
    await page.goto(fixture.origin + '/admin');
    await page.waitForFunction(() => '__vue_app__' in document.querySelector('#__nuxt')!);
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const title = page.getByLabel('제목', { exact: true });
    const feedback = page.locator('main > [role="status"]').first();
    for (const loss of ['response', 'detail']) {
      for (const denial of [401, 403]) {
        await t.test(`${loss} loss -> ${denial} twice -> authenticated replay`, async () => {
          await button('새 초안').click();
          const name = `${loss}-${denial} 입력 보존`;
          await title.fill(name);
          await page.getByLabel('본문 1', { exact: true }).fill('저장한 원문');
          const keys: string[] = [],
            bodies: string[] = [];
          let stage = 'loss';
          // Only the first response is lost. It is sent to the actual API and committed first.
          await page.route('**/api/v1/admin/posts', async (route) => {
            if (route.request().method() !== 'POST') return route.continue();
            keys.push(route.request().headers()['idempotency-key'] || '');
            bodies.push(route.request().postData() || '');
            if (stage === 'loss' && loss === 'response') {
              const result = await route.fetch();
              assert.equal(result.status(), 201);
              return route.abort('connectionreset');
            }
            if (stage === 'denied' && denial === 403) {
              // Local auth has no role-denial mode; simulate the Access/BFF rejection at this boundary.
              return route.fulfill({
                status: 403,
                json: { success: false, error: { code: 'FORBIDDEN' } },
              });
            }
            return route.continue();
          });
          if (loss === 'detail')
            await page.route(/\/api\/v1\/admin\/posts\/\d+$/, (route) =>
              route.fulfill({
                status: 503,
                json: { success: false, error: { code: 'DEPENDENCY_UNAVAILABLE' } },
              })
            );
          await button('초안 생성').click();
          await expect(feedback).toContainText('처리하지 못했습니다');
          await page.unroute(/\/api\/v1\/admin\/posts\/\d+$/);
          stage = 'denied';
          if (denial === 401) await context.clearCookies();
          for (let attempt = 0; attempt < 2; attempt++) {
            const response = page.waitForResponse(
              (r) => r.request().method() === 'POST' && r.url().endsWith('/api/v1/admin/posts')
            );
            await button('저장 결과 다시 확인').click();
            assert.equal((await response).status(), denial);
            await expect(feedback).toContainText('인증 또는 접근 권한');
            await expect(title).toHaveValue(name);
            await expect(title).toBeDisabled();
            await expect(button('새 초안')).toBeDisabled();
            await expect(page.getByLabel('본문 1', { exact: true })).toHaveValue('저장한 원문');
            await expect(button('저장 결과 다시 확인')).toBeEnabled();
          }
          stage = 'recovered';
          await context.addCookies([
            { name: 'BLARIYO_ADMIN_SESSION', value: fixture.adminToken, url: fixture.origin },
          ]);
          await button('저장 결과 다시 확인').click();
          await expect(feedback).toHaveText('저장했습니다.');
          assert.equal(keys.length, 4);
          assert.ok(keys[0]);
          assert.equal(new Set(keys).size, 1);
          assert.equal(new Set(bodies).size, 1);
          const stored = await fixture.pool.query(
            'SELECT id,status FROM content.board_post WHERE title=$1',
            [name]
          );
          assert.equal(stored.rowCount, 1);
          assert.equal(stored.rows[0]?.status, 'DRAFT');
          const history = await fixture.pool.query(
            'SELECT to_status FROM content.board_post_status_history WHERE post_id=$1',
            [stored.rows[0]?.id]
          );
          assert.deepEqual(history.rows, [{ to_status: 'DRAFT' }]);
          await page.unroute('**/api/v1/admin/posts');
        });
      }
    }
    await t.test(
      'a first definitive auth failure preserves editable input and permits a fresh save',
      async () => {
        await button('새 초안').click();
        await title.fill('최초 인증 실패');
        await page.getByLabel('본문 1', { exact: true }).fill('새 제출');
        await context.clearCookies();
        await button('초안 생성').click();
        await expect(feedback).toContainText('인증 또는 접근 권한');
        await expect(button('저장 결과 다시 확인')).toHaveCount(0);
        await expect(title).toBeEnabled();
        await expect(title).toHaveValue('최초 인증 실패');
        assert.equal(
          (
            await fixture.pool.query('SELECT id FROM content.board_post WHERE title=$1', [
              '최초 인증 실패',
            ])
          ).rowCount,
          0
        );
        await context.addCookies([
          { name: 'BLARIYO_ADMIN_SESSION', value: fixture.adminToken, url: fixture.origin },
        ]);
        await button('초안 생성').click();
        await expect(feedback).toHaveText('저장했습니다.');
      }
    );
    await t.test(
      'an uncommitted uncertain edit can resolve to a definitive version conflict',
      async () => {
        const row = (
          await fixture.pool.query('SELECT id FROM content.board_post WHERE title=$1', [
            '최초 인증 실패',
          ])
        ).rows[0];
        assert.ok(row);
        const path = `/api/v1/admin/posts/${String(row.id)}`;
        const detail = object(
          object(await (await context.request.get(fixture.origin + path)).json()).data
        );
        await title.fill('내가 편집한 제목');
        await page.route(fixture.origin + path, (route) =>
          route.request().method() === 'PATCH' ? route.abort('connectionreset') : route.continue()
        );
        await button('수정 저장').click();
        await expect(feedback).toContainText('저장 결과가 불확실');
        await page.unroute(fixture.origin + path);
        const other = await context.request.patch(fixture.origin + path, {
          headers: { 'Idempotency-Key': crypto.randomUUID(), Origin: fixture.origin },
          data: {
            title: '다른 운영자가 저장함',
            source: detail.source,
            blocks: [{ type: 'TEXT', text: '다른 운영자 본문' }],
            lockVersion: detail.lockVersion,
          },
        });
        assert.equal(other.status(), 200);
        await button('저장 결과 다시 확인').click();
        await expect(feedback).toContainText('다른 변경이 반영되었습니다');
        await expect(title).toHaveValue('내가 편집한 제목');
        await expect(title).toBeEnabled();
        await expect(button('저장 결과 다시 확인')).toHaveCount(0);
      }
    );
    await t.test(
      'unsaved selection, route departure and tab close preserve input; double click creates once',
      async () => {
        page.once('dialog', async (dialog) => {
          assert.match(dialog.message(), /저장하지 않은 변경/);
          await dialog.dismiss();
        });
        await page.locator('.admin-result').last().click();
        await expect(title).toHaveValue('내가 편집한 제목');
        page.once('dialog', async (dialog) => {
          assert.match(dialog.message(), /저장하지 않은 변경/);
          await dialog.dismiss();
        });
        await page
          .locator('.admin-sidebar-bottom')
          .getByRole('link', { name: '공개 사이트 보기' })
          .click();
        await expect(page).toHaveURL(fixture.origin + '/admin');
        await expect(title).toHaveValue('내가 편집한 제목');
        const unload = page.waitForEvent('dialog');
        await page.close({ runBeforeUnload: true });
        const dialog = await unload;
        assert.equal(dialog.type(), 'beforeunload');
        await dialog.dismiss();
        assert.equal(page.isClosed(), false);
        await expect(title).toHaveValue('내가 편집한 제목');
        page.once('dialog', (d) => d.accept());
        await button('새 초안').click();
        await title.fill('중복 클릭 보존');
        await page.getByLabel('본문 1', { exact: true }).fill('한 번만 저장');
        const started = Promise.withResolvers<void>(),
          held = Promise.withResolvers<void>();
        let submissions = 0;
        await page.route('**/api/v1/admin/posts', async (route) => {
          if (route.request().method() !== 'POST') return route.continue();
          submissions++;
          started.resolve();
          await held.promise;
          return route.continue();
        });
        const doubleClick = button('초안 생성').dblclick();
        await started.promise;
        try {
          await expect(button('초안 생성')).toBeDisabled();
          await expect(button('새 초안')).toBeDisabled();
          await expect(page.locator('.admin-result').last()).toBeDisabled();
          await expect(title).toHaveValue('중복 클릭 보존');
        } finally {
          held.resolve();
        }
        await doubleClick;
        await expect(feedback).toHaveText('저장했습니다.');
        assert.equal(submissions, 1);
        assert.equal(
          (
            await fixture.pool.query('SELECT id FROM content.board_post WHERE title=$1', [
              '중복 클릭 보존',
            ])
          ).rowCount,
          1
        );
        await page.unroute('**/api/v1/admin/posts');
      }
    );
  }
);
