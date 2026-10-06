import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { object } from '../helpers/browser-values.ts';

await test('batch completion is per-item KST time, never retention or failed-at time', { timeout: 120000 }, async (t) => {
  const f = await browserFixture(t, { batchReview: true });
  const run = randomUUID();
  const completedAt = '2026-10-06T15:30:45.000Z';
  await f.pool.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('completion','example.invalid','fixture')");
  await f.pool.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'completion','manual','WRITE_DB','COMPLETED',1,3,10000)", [run]);
  const items = [
    { id: randomUUID(), title: '완료 시각 있는 글', state: 'FETCHED', time: completedAt },
    { id: randomUUID(), title: '과거 시각 미기록 글', state: 'FETCHED', time: null },
    { id: randomUUID(), title: '실패한 글', state: 'FAILED', time: completedAt },
  ];
  for (const item of items) {
    await f.pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,version,fetched_at)
      VALUES($1::uuid,$2,'completion',$1::text,$3,sha256(convert_to($3,'UTF8')),$4,$5,'[{"type":"TEXT","text":"완료 시각 확인 본문"}]',1,$6)`,
    [item.id, run, 'https://example.invalid/' + item.id, item.state, item.title, item.time]);
  }
  const browser = await launchBrowser();
  t.after(() => browser.close());
  await mkdir('.local-data/batch-completion-time/screenshots', { recursive: true });
  for (const width of [390, 1280]) {
    await t.test(`${width}px list/detail display KST even in a different browser timezone`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
      const errors: string[] = [];
      await context.addCookies([{ name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin }]);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(f.origin + '/admin/batch');
      const listResponse = await context.request.get(f.origin + '/api/v1/admin/collect/batch-items');
      assert.equal(listResponse.status(), 200);
      const listed = object(object(await listResponse.json()).data).items;
      assert.ok(Array.isArray(listed));
      for (const item of items) {
        const row = object(listed.find((value: unknown) => object(value).itemId === item.id));
        assert.equal(row.fetchedAt, item.state === 'FETCHED' ? item.time : null);
      }
      const list = page.locator('.batch-list');
      await expect(list.locator('time')).toHaveText('2026. 10. 07. 00:30:45');
      await expect(list.locator('time')).toHaveAttribute('datetime', completedAt);
      await expect(list.getByText('수집 완료 시각 미기록', { exact: true })).toHaveCount(1);
      for (const item of items) {
        await page.goto(f.origin + '/admin/batch?itemId=' + item.id);
        const detail = page.getByRole('region', { name: '수집 결과 상세' });
        await expect(detail.getByRole('heading', { name: item.title, exact: true })).toBeVisible();
        if (item.state === 'FAILED') {
          await expect(detail.locator('.batch-completion-time')).toHaveCount(0);
        } else if (item.time) {
          await expect(detail.locator('time')).toHaveText('2026. 10. 07. 00:30:45');
          await expect(detail.locator('time')).toHaveAttribute('datetime', completedAt);
          await page.screenshot({ path: `.local-data/batch-completion-time/screenshots/${width}.png` });
        } else {
          await expect(detail.getByText('수집 완료 시각 미기록', { exact: true })).toBeVisible();
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
});
