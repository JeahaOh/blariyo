import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { firstRow } from '../helpers/browser-values.ts';

await test('operator deletes only selected failed items with confirmation and replay', { timeout: 120000 }, async t => {
  const f = await browserFixture(t, { batchReview: true, batchDeletion: true });
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addCookies([{ name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin }]);
  const page = await context.newPage(), run = randomUUID();
  await f.pool.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','example.invalid','test')");
  async function seedMany(entries: {title: string; state?: string; id?: string}[], batchRun = randomUUID()) {
    return f.database.transaction(async manager => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('collector-source:fixture',0))");
      await manager.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'fixture','hot','WRITE_DB','RUNNING',1,20,10000)", [batchRun]);
      const seeded = [];
      for (const value of entries) {
        const id = value.id ?? randomUUID(), state = value.state ?? 'FAILED', title = value.title;
        const url = 'https://example.invalid/' + id, raw = `collect/raw/${batchRun}/${id}.html`;
        if (value.id) await manager.query("UPDATE collect.batch_item SET run_id=$2,state='FETCHING',version=version+1 WHERE id=$1", [id, batchRun]);
        else await manager.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks)
          VALUES($1::uuid,$2,'fixture',$1::text,$3,$4,'FETCHING',$5,'[]')`, [id, batchRun, url, createHash('sha256').update(url).digest(), title]);
        await mkdir(`${f.collectRoot}/collect/raw/${batchRun}`, { recursive: true });
        await writeFile(`${f.collectRoot}/${raw}`, 'fixture only');
        await manager.query(`UPDATE collect.batch_item SET state=$2,raw_object_key=$3,title=$4,body_blocks=$5,
          version=version+1,fetched_at=now(),failure_code=$6 WHERE id=$1`, [id, state, raw, title,
          JSON.stringify(state === 'FETCHED' ? [{type:'TEXT',text:'정상 본문'}] : []), state === 'FETCHED' ? null : 'SOURCE_GONE']);
        await manager.query("INSERT INTO collect.batch_failure(id,run_id,item_id,phase,code) VALUES($1,$2,$3,'DETAIL','SOURCE_GONE')", [randomUUID(), batchRun, id]);
        seeded.push({id, title, raw});
      }
      const report = `collect/report/${batchRun}.jsonl`;
      await manager.query("INSERT INTO collect.batch_report(run_id,object_key,sha256,jsonl_count) VALUES($1,$2,$3,1)", [batchRun, report, createHash('sha256').update('report').digest()]);
      await manager.query("INSERT INTO collect.batch_checkpoint(run_id,state) VALUES($1,'{}')", [batchRun]);
      await manager.query("UPDATE collect.batch_run SET state='COMPLETED',finished_at=now(),report_object_key=$2,checkpoint='{}',version=version+1 WHERE id=$1", [batchRun, report]);
      return seeded;
    });
  }
  const initial = await seedMany([{title:'삭제할 실패 글'}, {title:'삭제할 차단 글',state:'BLOCKED'}, {title:'정상 글 보존',state:'FETCHED'}, {title:'선택하지 않은 실패 글'}], run);
  const [one, two, normal, untouched] = initial;
  assert.ok(one && two && normal && untouched);
  const checkbox = (title: string) => page.getByRole('checkbox', { name: title + ' 선택', exact: true });
  const result = page.locator('.batch-bulk-result');
  const dialog = page.getByRole('dialog', { name: '수집 실패 항목 삭제' });
  const selectDelete = page.getByRole('button', { name: '선택 삭제', exact: true });
  async function load() {
    await page.goto(f.origin + '/admin/batch');
    await page.waitForFunction(() => '__vue_app__' in document.querySelector('#__nuxt')!);
  }
  const exists = async (id: string) => Number(firstRow(await f.pool.query('SELECT count(*) n FROM collect.batch_item WHERE id=$1', [id])).n) === 1;
  const apiDelete = (id: string, itemVersion = 1, lockVersion = 0, key: string = randomUUID()) => context.request.post(f.origin + `/api/v1/admin/collect/batch-items/${id}/delete`, {
    headers: { Origin: f.origin, 'Idempotency-Key': key }, data: { itemVersion, lockVersion },
  });

  await t.test('mixed selection counts only failed deletions, cancellation preserves data, responsive controls fit', async () => {
    await load();
    await checkbox(one.title).check();
    await checkbox(two.title).check();
    await checkbox(normal.title).check();
    await selectDelete.click();
    await expect(dialog).toContainText('항목 2건');
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await exists(one.id), true);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `.local-data/admin-ux-rework/screenshots/batch-delete-${width}.png`, fullPage: true });
    }
  });
  await t.test('bulk deletion removes payload, preserves other items and schedules exact object cleanup', async () => {
    await selectDelete.click();
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(result).toContainText('삭제 결과 · 완료 2건 · 실패 0건 · 결과 미확인 0건');
    for (const item of [one, two]) {
      assert.equal(await exists(item.id), false);
      assert.equal(Number(firstRow(await f.pool.query('SELECT count(*) n FROM collect.batch_manual_cleanup WHERE item_id=$1 AND completed_at IS NULL', [item.id])).n), 1);
      assert.equal(firstRow(await f.pool.query('SELECT collect.image_cleanup_allowed($1,$2,$3) allowed', [item.id, run, item.raw])).allowed, true);
      assert.equal(firstRow(await f.pool.query('SELECT collect.image_cleanup_allowed($1,$2,$3) allowed', [item.id, run, untouched.raw])).allowed, false);
      assert.equal(Number(firstRow(await f.pool.query('SELECT count(*) n FROM collect.batch_failure WHERE item_id=$1', [item.id])).n), 0);
    }
    for (const item of [normal, untouched]) assert.equal(await exists(item.id), true);
    assert.equal(Number(firstRow(await f.pool.query('SELECT count(*) n FROM collect.batch_failure WHERE run_id=$1', [run])).n), 2);
    assert.equal(Number(firstRow(await f.pool.query('SELECT count(*) n FROM collect.batch_run WHERE id=$1', [run])).n), 1);
  });
  await t.test('stale versions and collected items cannot be deleted through API', async () => {
    assert.equal((await apiDelete(normal.id)).status(), 409);
    assert.equal((await apiDelete(untouched.id, 2)).status(), 409);
    assert.equal(await exists(untouched.id), true);
    const unauthenticated = await browser.newContext();
    const denied = await unauthenticated.request.post(f.origin + `/api/v1/admin/collect/batch-items/${untouched.id}/delete`, { headers: { Origin: f.origin, 'Idempotency-Key': randomUUID() }, data: { itemVersion: 1, lockVersion: 0 } });
    assert.equal(denied.status(), 401);
    await unauthenticated.close();
  });
  await t.test('lost delete response reuses key after physical row removal and succeeds once', async () => {
    await checkbox(untouched.title).check();
    let originalKey = '';
    await page.route(`**/batch-items/${untouched.id}/delete`, async route => {
      originalKey = route.request().headers()['idempotency-key'] ?? '';
      const response = await route.fetch();
      assert.equal(response.status(), 200, await response.text());
      await route.abort('connectionreset');
    }, { times: 1 });
    await selectDelete.click();
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(result).toContainText('결과 미확인 1건');
    assert.equal(await exists(untouched.id), false);
    await page.route(`**/batch-items/${untouched.id}/delete`, async route => {
      assert.equal(route.request().headers()['idempotency-key'], originalKey);
      await route.continue();
    }, { times: 1 });
    await page.getByRole('button', { name: '삭제 결과 다시 확인', exact: true }).click();
    await expect(result).toContainText('삭제 결과 · 완료 1건 · 실패 0건 · 결과 미확인 0건');
    assert.equal(Number(firstRow(await f.pool.query('SELECT count(*) n FROM collect.batch_manual_deletion WHERE item_id=$1', [untouched.id])).n), 1);
    assert.equal((await apiDelete(untouched.id, 2, 0, originalKey)).status(), 409);
  });
  await t.test('active collection, restore fences and reviewed failures are protected', async () => {
    const [protectedItem] = await seedMany([{ title: '검수 기록 보호' }]);
    assert.ok(protectedItem);
    const holder = f.database.createQueryRunner();
    await holder.connect();
    try {
      await holder.query("SELECT pg_advisory_lock(hashtextextended('collector-source:fixture',0))");
      assert.equal((await apiDelete(protectedItem.id)).status(), 409);
      await holder.query("SELECT pg_advisory_unlock(hashtextextended('collector-source:fixture',0))");
      await holder.query('SELECT collect.lock_retention_restore()');
      assert.equal((await apiDelete(protectedItem.id)).status(), 409);
      await holder.query('SELECT collect.unlock_retention_restore()');
    } finally {
      await holder.query('SELECT pg_advisory_unlock_all()');
      await holder.release();
    }
    await f.pool.query(`INSERT INTO collect.batch_review(item_id,item_version,source_key,source_post_key,canonical_url_hash,status,updated_by,content_digest)
      SELECT id,version,source_key,source_post_key,canonical_url_hash,'REJECTED','admin:v1:'||repeat('a',43),sha256('fixture'::bytea) FROM collect.batch_item WHERE id=$1`, [protectedItem.id]);
    assert.equal((await apiDelete(protectedItem.id, 1, 1)).status(), 409);
    assert.equal(await exists(protectedItem.id), true);
    const [linked] = await seedMany([{ title: '게시글 원문 보호' }]);
    assert.ok(linked);
    const created = await context.request.post(f.origin + '/api/v1/admin/posts', {
      headers: { Origin: f.origin, 'Idempotency-Key': randomUUID() },
      data: { boardSlug: 'meme', title: '보존할 게시글', source: { name: 'fixture', url: 'https://example.invalid/' + linked.id },
        pinnedPosition: null, blocks: [{ type: 'TEXT', text: '보존할 본문' }] },
    });
    assert.equal(created.status(), 201, await created.text());
    assert.equal((await apiDelete(linked.id)).status(), 409);
    assert.equal(await exists(linked.id), true);

  });
  await t.test('single deletion closes detail and isolates a concurrent state change in bulk', async () => {
    const [stale, good] = await seedMany([{title:'다른 관리자가 변경한 글'}, {title:'상세에서 삭제할 글'}]);
    assert.ok(stale && good);
    await load();
    await checkbox(stale.title).check();
    await checkbox(good.title).check();
    await seedMany([{id:stale.id,title:stale.title}]);
    await selectDelete.click();
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(result).toContainText('완료 1건 · 실패 1건');
    assert.equal(await exists(stale.id), true);
    await page.getByRole('button', { name: stale.title, exact: true }).click();
    const detail = page.getByRole('region', { name: '수집 결과 상세' });
    await detail.getByRole('button', { name: '삭제', exact: true }).click();
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(result).toContainText('완료 1건 · 실패 0건');
    await expect(detail).toHaveCount(0);
    assert.equal(new URL(page.url()).searchParams.has('itemId'), false);
  });
});
