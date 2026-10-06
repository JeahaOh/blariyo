import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';

await test(
  'batch selection follows URL and history without a back-to-list button',
  { timeout: 120000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true });
    const run = randomUUID();
    await f.pool.query(
      "INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('navigation','example.invalid','fixture')"
    );
    await f.pool.query(
      "INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'navigation','manual','WRITE_DB','COMPLETED',1,2,10000)",
      [run]
    );
    const items = [
      { id: randomUUID(), title: '주소 검증 첫 번째' },
      { id: randomUUID(), title: '주소 검증 두 번째' },
    ];
    for (const item of items)
      await f.pool.query(
        `INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,version,fetched_at)
    VALUES($1::uuid,$2,'navigation',$1::text,$3,sha256(convert_to($3,'UTF8')),'FETCHED',$4,'[{"type":"TEXT","text":"주소 검증 본문"}]',1,clock_timestamp())`,
        [item.id, run, 'https://example.invalid/' + item.id, item.title]
      );
    const first = items[0],
      second = items[1];
    assert.ok(first && second);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    for (const width of [390, 1280])
      await t.test(
        `${width}px: selection, refresh, history, direct link and busy guards`,
        async () => {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          const errors: string[] = [];
          await context.addCookies([
            { name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin },
          ]);
          const page = await context.newPage();
          page.on('pageerror', (error) => errors.push(error.message));
          const detail = page.getByRole('region', { name: '수집 결과 상세', includeHidden: true });
          const firstUrl = f.origin + '/admin/batch?itemId=' + first.id;
          const secondUrl = f.origin + '/admin/batch?itemId=' + second.id;
          await page.goto(f.origin + '/admin/batch');
          await expect(detail).toHaveCount(0);
          await expect(page.getByRole('navigation', { name: '수집 결과 페이지' })).toHaveCount(0);
          const listBox = await page.locator('.batch-list-panel').boundingBox();
          const splitBox = await page.locator('.batch-split').boundingBox();
          assert.ok(listBox && splitBox);
          assert.ok(Math.abs(listBox.width - splitBox.width) < 2);
          await page.getByLabel('출처', { exact: true }).selectOption('navigation');
          await page.getByRole('button', { name: '조회', exact: true }).click();
          await expect(page.getByRole('button', { name: '조회', exact: true })).toBeEnabled();
          await page
            .locator('.batch-list')
            .getByRole('button', { name: first.title, exact: true })
            .click();
          await expect(page).toHaveURL(firstUrl);
          await expect(
            detail.getByRole('heading', { name: first.title, exact: true })
          ).toBeVisible();
          await expect(page.getByRole('button', { name: /목록으로/ })).toHaveCount(0);
          await page.reload();
          await expect(
            detail.getByRole('heading', { name: first.title, exact: true })
          ).toBeVisible();
          await expect(page.getByLabel('출처', { exact: true })).toHaveValue('navigation');
          await page
            .locator('.batch-list')
            .getByRole('button', { name: second.title, exact: true })
            .click();
          await expect(page).toHaveURL(secondUrl);
          await expect(
            detail.getByRole('heading', { name: second.title, exact: true })
          ).toBeVisible();
          await page.goBack();
          await expect(page).toHaveURL(firstUrl);
          await expect(
            detail.getByRole('heading', { name: first.title, exact: true })
          ).toBeVisible();
          await page.goBack();
          await expect(page).toHaveURL(f.origin + '/admin/batch');
          await expect(detail.getByRole('heading', { name: first.title, exact: true })).toHaveCount(
            0
          );
          await expect(
            page.locator('.batch-list').getByRole('button', { name: first.title, exact: true })
          ).toBeFocused();
          await page.goForward();
          await expect(page).toHaveURL(firstUrl);
          await expect(
            detail.getByRole('heading', { name: first.title, exact: true })
          ).toBeVisible();

          // A committed but lost review response must still block same-page history changes.
          const reviewPath = `**/batch-items/${first.id}/review`;
          await page.route(reviewPath, async (route) => {
            await route.fetch();
            await route.abort('connectionreset');
          });
          await page.getByRole('button', { name: '반려', exact: true }).click();
          await expect(page.getByRole('button', { name: '처리 결과 다시 확인' })).toBeEnabled();
          await page.goBack();
          await expect(page).toHaveURL(firstUrl);
          await expect(
            detail.getByRole('heading', { name: first.title, exact: true })
          ).toBeVisible();
          await page.unroute(reviewPath);
          await page.getByRole('button', { name: '처리 결과 다시 확인' }).click();
          await expect(page.getByRole('button', { name: '처리 결과 다시 확인' })).toHaveCount(0);
          await expect(page.getByRole('progressbar')).toHaveCount(0);
          await page.goBack();
          await expect(page).toHaveURL(f.origin + '/admin/batch');
          await page.reload();
          await expect(detail.getByRole('heading', { name: first.title, exact: true })).toHaveCount(
            0
          );
          await page.goto(f.origin + '/admin/batch?itemId=invalid');
          await expect(
            page.getByText('올바른 수집 항목 주소가 아닙니다.', { exact: true })
          ).toBeVisible();
          await expect(detail.getByRole('heading', { name: first.title, exact: true })).toHaveCount(
            0
          );
          assert.deepEqual(errors, []);
          await context.close();
        }
      );
    await t.test('a fresh login restores a copied item URL', async () => {
      const context = await browser.newContext(),
        page = await context.newPage();
      const url = f.origin + '/admin/batch?itemId=' + second.id;
      await page.goto(url);
      await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
      await expect(page).toHaveURL(url);
      await expect(
        page.locator('.batch-detail').getByRole('heading', { name: second.title, exact: true })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: /목록으로/ })).toHaveCount(0);
      await context.close();
    });
  }
);
