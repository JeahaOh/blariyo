import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { firstRow } from '../helpers/browser-values.ts';

await test('batch list bulk rejection preserves item isolation and recovers uncertain responses', { timeout: 180000 }, async t => {
  const f = await browserFixture(t, { batchReview: true });
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addCookies([{ name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin }]);
  const page = await context.newPage();
  const run = randomUUID();
  await f.pool.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','example.invalid','fixture-v1')");
  await f.pool.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'fixture','hot','WRITE_DB','COMPLETED',2,100,10000)", [run]);
  async function seed(title: string, state = 'FETCHED') {
    const id = randomUUID(), url = 'https://example.invalid/' + id;
    await f.pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,version,fetched_at)
      VALUES($1::uuid,$2,'fixture',$1::text,$3,$4,$5,$6,$7,1,now())`,
    [id, run, url, createHash('sha256').update(url).digest(), state, title, JSON.stringify(state === 'FETCHED' ? [{ type: 'TEXT', text: '일괄 반려 검증 본문' }] : [])]);
    return { id, title };
  }
  const checkbox = (title: string) => page.getByRole('checkbox', { name: title + ' 선택', exact: true });
  const all = page.getByRole('checkbox', { name: '이 페이지 전체 선택', exact: true });
  const reject = page.getByRole('button', { name: '선택 반려', exact: true });
  const query = page.getByRole('button', { name: '조회', exact: true });
  const result = page.locator('.batch-bulk-result');
  async function load() {
    await page.goto(f.origin + '/admin/batch');
    await expect(query).toBeEnabled();
    await page.waitForFunction(() => '__vue_app__' in document.querySelector('#__nuxt')!);
  }
  async function review(id: string) {
    return (await f.pool.query('SELECT status,lock_version FROM collect.batch_review WHERE item_id=$1', [id])).rows[0];
  }
  const one = await seed('일괄 대상 하나');
  const two = await seed('일괄 대상 둘');
  const untouched = await seed('보존 대상');
  const failed = await seed('수집 실패 항목', 'FAILED');

  await t.test('checkboxes are separate from detail selection, clear on query, and align responsively', async () => {
    await load();
    await expect(reject).toBeDisabled();
    await expect(checkbox(failed.title)).toBeEnabled();
    await all.check();
    await expect(page.locator('.batch-selected-count')).toHaveText('4건 선택');
    await checkbox(failed.title).uncheck();
    await checkbox(two.title).uncheck();
    assert.equal(await all.evaluate((element: HTMLInputElement) => element.indeterminate), true);
    await expect(page.getByRole('region', { name: '수집 결과 상세' })).toHaveCount(0);
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const toolbar = await page.locator('.batch-selection-toolbar').boundingBox();
      const button = await reject.boundingBox();
      assert.ok(toolbar && button && button.y >= toolbar.y && button.y + button.height <= toolbar.y + toolbar.height);
      assert.ok(button.height >= 44);
      await page.screenshot({ path: `.local-data/admin-ux-rework/screenshots/batch-bulk-${width}.png`, fullPage: true });
    }
    await query.click();
    await expect(page.locator('.batch-selected-count')).toHaveText('0건 선택');
    await expect(reject).toBeDisabled();
  });

  await t.test('a stale item fails independently while a checked item is rejected and unselected data stays intact', async () => {
    await checkbox(one.title).check();
    await checkbox(two.title).check();
    await f.pool.query('UPDATE collect.batch_item SET version=version+1 WHERE id=$1', [two.id]);
    await reject.click();
    await expect(result).toContainText('완료 1건 · 실패 1건 · 결과 미확인 0건');
    await expect(result).toContainText(two.title + ': 수집 내용 또는 검수 상태가 바뀌었습니다.');
    assert.equal((await review(one.id))?.status, 'REJECTED');
    assert.equal(await review(two.id), undefined);
    assert.equal(await review(untouched.id), undefined);
    assert.equal(await review(failed.id), undefined);
    await expect(checkbox(one.title)).toBeDisabled();
    await expect(checkbox(two.title)).toBeEnabled();
    await expect(reject).toBeDisabled();
  });

  await t.test('lost POST response repeats the original key and body without another transition', async () => {
    await checkbox(two.title).check();
    const path = `**/batch-items/${two.id}/review`;
    let originalKey = '', originalBody = '';
    await page.route(path, async route => {
      originalKey = route.request().headers()['idempotency-key'] ?? '';
      originalBody = route.request().postData() ?? '';
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort('connectionreset');
    }, { times: 1 });
    await reject.click();
    await expect(result).toContainText('완료 0건 · 실패 0건 · 결과 미확인 1건');
    await expect(query).toBeDisabled();
    assert.ok(originalKey);
    await page.route(path, async route => {
      assert.equal(route.request().headers()['idempotency-key'], originalKey);
      assert.equal(route.request().postData(), originalBody);
      await route.continue();
    }, { times: 1 });
    await page.getByRole('button', { name: '반려 결과 다시 확인', exact: true }).click();
    await expect(result).toContainText('완료 1건 · 실패 0건 · 결과 미확인 0건');
    const saved = await review(two.id);
    assert.equal(saved?.status, 'REJECTED');
    assert.equal(Number(saved?.lock_version), 1);
    await expect(query).toBeEnabled();
  });

  await t.test('successful rejection remains successful when list refresh fails and closes details', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: untouched.title, exact: true }).click();
    await expect(page.getByRole('region', { name: '수집 결과 상세' })).toBeVisible();
    await checkbox(untouched.title).check();
    await page.route('**/batch-items?*', route => route.abort('connectionreset'));
    await reject.click();
    await expect(result).toContainText('완료 1건 · 실패 0건 · 결과 미확인 0건');
    await expect(page.getByRole('region', { name: '수집 결과 상세' })).toHaveCount(0);
    assert.equal(new URL(page.url()).searchParams.has('itemId'), false);
    assert.equal((await review(untouched.id))?.status, 'REJECTED');
    await expect(page.getByRole('alert')).toContainText('목록을 갱신하지 못해');
    await page.unroute('**/batch-items?*');
    await page.getByRole('button', { name: '목록 다시 조회', exact: true }).click();
    await expect(checkbox(untouched.title)).toBeDisabled();
  });

  await t.test('select all stays on the current page and page navigation clears selection', async () => {
    for (let index = 0; index < 21; index++) await seed('페이지 검증 ' + index);
    await query.click();
    await expect(all).toBeEnabled();
    await all.check();
    await expect(page.locator('.batch-selected-count')).toHaveText('20건 선택');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.locator('.batch-selected-count')).toHaveText('0건 선택');
    await expect(reject).toBeDisabled();
    await all.check();
    await expect(page.locator('.batch-selected-count')).toHaveText('2건 선택');
    await reject.click();
    await expect(result).toContainText('완료 1건 · 실패 0건 · 결과 미확인 0건');
    assert.equal(Number(firstRow(await f.pool.query("SELECT count(*) n FROM collect.batch_review WHERE status='REJECTED'")).n), 4);
    assert.equal(Number(firstRow(await f.pool.query('SELECT count(*) n FROM content.board_post')).n), 0);
  });
});
