import test from 'node:test';
import assert from 'node:assert/strict';
import { expect, type Page, type Locator } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
async function choose(page: Page, control: Locator, label: string) {
  const name = await control.getAttribute('aria-label');assert.ok(name);
  await control.click();
  await page.getByRole('listbox',{name,exact:true}).getByRole('option',{name:label,exact:true}).click();
}
await test('source auto publication: opt-in, OFF, stale edit, reload and responsive owner controls',{timeout:90000},async t=>{
  const f=await browserFixture(t,{batchReview:true});
  const browser=await launchBrowser();t.after(()=>browser.close());
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto(f.origin+'/admin/batch');await page.getByRole('button',{name:'개발 관리자 로그인'}).click();
  await expect(page.getByText('출처별 자동 발행 설정',{exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'수집처 관리',exact:true}).click();
  await expect(page).toHaveURL(f.origin+'/admin/sources');
  await expect(page.getByRole('heading',{name:'수집처 관리',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'수집처 관리',exact:true})).toHaveAttribute('aria-current','page');
  const panel=page.locator('.source-publish-policies'),sourceRow=panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'더쿠',exact:true})}),toggle=sourceRow.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true});
  await expect(panel.getByRole('combobox',{name:'수집처',exact:true})).toHaveCount(0);
  await expect(toggle).toHaveText('사용 안 함');
  await choose(page,toggle,'사용');await sourceRow.getByRole('button',{name:'더쿠 저장',exact:true}).click();
  await expect(sourceRow.getByRole('status')).toContainText('저장했습니다');
  await page.reload();await expect(toggle).toHaveText('사용');
  const endpoint=f.origin+'/api/v1/admin/collect/source-publish-policies/theqoo';
  assert.equal((await context.request.post(endpoint,{headers:{Origin:f.origin},data:{autoPublishEnabled:true,lockVersion:1}})).status(),200);
  await choose(page,toggle,'사용 안 함');await sourceRow.getByRole('button',{name:'더쿠 저장',exact:true}).click();
  await expect(sourceRow.getByRole('status')).toContainText('다른 관리자가 변경');await expect(toggle).toHaveText('사용');
  await choose(page,toggle,'사용 안 함');await sourceRow.getByRole('button',{name:'더쿠 저장',exact:true}).click();await expect(sourceRow.getByRole('status')).toContainText('저장했습니다');
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.reload();
  await expect(panel.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true})).toHaveText('사용 안 함');
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:'worklog/2026-10-10/collection-failure-diagnostics/settings-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:'worklog/2026-10-10/collection-failure-diagnostics/settings-desktop.png'});
});
await test('source auto publication: EDITOR can inspect but cannot enable',{timeout:90000},async t=>{
  const f=await browserFixture(t,{batchReview:true,adminRole:'EDITOR'});
  const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();
  await page.goto(f.origin+'/admin/batch');await page.getByRole('button',{name:'개발 관리자 로그인'}).click();
  await expect(page.getByText('출처별 자동 발행 설정',{exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'수집처 관리',exact:true}).click();
  await expect(page).toHaveURL(f.origin+'/admin/sources');
  await expect(page.getByRole('heading',{name:'수집처 관리',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'수집처 관리',exact:true})).toHaveAttribute('aria-current','page');
  const panel=page.locator('.source-publish-policies');await expect(panel.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true})).toBeDisabled();
  await expect(panel.getByRole('button',{name:'더쿠 저장',exact:true})).toHaveCount(0);
  await expect(panel).toContainText('설정 변경은 소유자만');
});

await test('source management: failed initial load can recover without saving policy',{timeout:90000},async t=>{
  const f=await browserFixture(t,{batchReview:true});
  const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();
  await page.goto(f.origin+'/admin/sources');await page.getByRole('button',{name:'개발 관리자 로그인'}).click();
  const panel=page.locator('.source-publish-policies');
  await expect(panel.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true})).toBeEnabled();
  let fail=true;
  await page.route('**/api/v1/admin/collect/source-publish-policies',async route=>{
    if(fail)await route.fulfill({status:503,contentType:'application/json',body:'{}'});
    else await route.continue();
  });
  await page.reload();
  await expect(panel.getByRole('alert')).toContainText('다시 조회');
  await expect(panel.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true})).toHaveCount(0);
  fail=false;await panel.getByRole('button',{name:'다시 조회',exact:true}).click();
  await expect(panel.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true})).toBeEnabled();
  await expect(panel.getByRole('button',{name:'더쿠 저장',exact:true})).toBeDisabled();
  assert.deepEqual(await f.database.query('SELECT count(*)::int n FROM collect.batch_source_publish_policy'),[{n:0}]);
});
await test('source management: disabled feature hides menu and settings',{timeout:90000},async t=>{
  const f=await browserFixture(t);
  const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();
  await page.goto(f.origin+'/admin/sources');await page.getByRole('button',{name:'개발 관리자 로그인'}).click();
  await expect(page.getByText('수집처 관리 기능이 활성화되어 있지 않습니다.',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'수집처 관리',exact:true})).toHaveCount(0);
  await expect(page.locator('.source-publish-policies')).toHaveCount(0);
});

await test('source management: temporary stop, URL and both selects persist after reload',{timeout:90000},async t=>{
  const f=await browserFixture(t,{batchReview:true});const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();
  await page.goto(f.origin+'/admin/sources');await page.getByRole('button',{name:'개발 관리자 로그인'}).click();
  const panel=page.locator('.source-publish-policies');
  const sourceRow=panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'인벤',exact:true})});
  const collect=sourceRow.getByRole('combobox',{name:'인벤 수집 여부',exact:true}),publish=sourceRow.getByRole('combobox',{name:'인벤 자동 발행 여부',exact:true});
  await expect(collect).toHaveText('수집 안 함');await expect(publish).toHaveText('사용 안 함');
  await expect(sourceRow.getByRole('link')).toHaveAttribute('href',/^https:\/\/www\.inven\.co\.kr\//);
  const other=panel.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true});
  await choose(page,other,'사용');
  await choose(page,collect,'수집함');await choose(page,publish,'사용');await sourceRow.getByRole('button',{name:'인벤 저장',exact:true}).click();
  await expect(sourceRow.getByRole('status')).toContainText('저장했습니다');
  await expect(other).toHaveText('사용');
  assert.deepEqual(await f.database.query("SELECT count(*)::int n FROM collect.batch_source_publish_policy WHERE source_key='theqoo'"),[{n:0}]);
  await page.reload();
  await expect(collect).toHaveText('수집함');await expect(publish).toHaveText('사용');
  await choose(page,collect,'수집 안 함');await sourceRow.getByRole('button',{name:'인벤 저장',exact:true}).click();
  await expect(sourceRow.getByRole('status')).toContainText('저장했습니다');await expect(publish).toHaveText('사용');
  await page.reload();
  await expect(collect).toHaveText('수집 안 함');await expect(publish).toHaveText('사용');
});

await test('source management: custom menu keyboard, disabled option, filters and stored history',{timeout:90000},async t=>{
  const f=await browserFixture(t,{batchReview:true}),browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();
  const run=randomUUID(),old=randomUUID(),item=randomUUID();
  await f.database.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('theqoo','theqoo.net','history-fixture') ON CONFLICT DO NOTHING");
  for (const [id,state,time] of [[old,'COMPLETED','2026-01-01T00:00:00Z'],[run,'PARTIAL','2026-01-02T00:00:00Z']])
    await f.database.query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms,started_at)
      VALUES($1,'theqoo','hot','WRITE_DB',$2,1,10,10000,$3)`,[id,state,time]);
  await f.database.query(`INSERT INTO collect.batch_item(id,run_id,source_key,canonical_url,canonical_url_hash,state,fetched_at)
    VALUES($1,$2,'theqoo','https://theqoo.net/history-fixture',$3,'FETCHED','2026-01-01T00:01:00Z')`,[item,old,createHash('sha256').update(item).digest()]);
  await f.database.query("INSERT INTO collect.batch_failure(id,run_id,phase,code,detail,occurred_at) VALUES($1,$2,'FETCH','SOURCE_HTTP_UNAVAILABLE',$3,'2026-01-02T00:01:00Z')",
    [randomUUID(),run,JSON.stringify({diagnosticReason:'HTTP_RETRY_EXHAUSTED',requestHost:'theqoo.net',httpStatus:503,rawBody:'fixture-secret'})]);
  await page.goto(f.origin+'/admin/sources');await page.getByRole('button',{name:'개발 관리자 로그인'}).click();
  const panel=page.locator('.source-publish-policies'),sourceRow=panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'더쿠',exact:true})});
  await expect(sourceRow).toContainText('마지막 수집');await expect(sourceRow).toContainText('2026. 01. 01. 09:01');await expect(sourceRow).toContainText('부분 실패');await expect(sourceRow).toContainText('SOURCE_HTTP_UNAVAILABLE');
  const publish=page.getByRole('combobox',{name:'더쿠 자동 발행 여부',exact:true});
  await publish.focus();await publish.press('ArrowDown');await expect(publish).toHaveAttribute('aria-expanded','true');
  await page.screenshot({path:'worklog/2026-10-10/collection-failure-diagnostics/custom-options.png'});
  await publish.press('ArrowUp');await publish.press('Enter');await expect(publish).toHaveText('사용');await expect(publish).toBeFocused();
  await publish.press('Enter');await publish.press('ArrowDown');await publish.press('Escape');await expect(publish).toHaveText('사용');await expect(page.getByRole('listbox')).toHaveCount(0);
  const search=page.getByRole('searchbox',{name:'수집처 검색'});await search.fill('inven.co.kr');await expect(panel.getByRole('rowheader')).toHaveCount(1);await expect(panel.getByRole('rowheader')).toHaveText('인벤');
  await search.fill('theqoo');await expect(publish).toHaveText('사용'); // Filtering must keep the unsaved draft.
  await choose(page,page.getByRole('combobox',{name:'자동 발행 필터',exact:true}),'사용');await expect(panel).toContainText('조건에 맞는 수집처가 없습니다.'); // Filters use persisted values.
  await panel.getByRole('button',{name:'초기화',exact:true}).click();await expect(publish).toHaveText('사용');
  await choose(page,page.getByRole('combobox',{name:'최근 수집 오류 필터',exact:true}),'오류 있음');await expect(panel.getByRole('rowheader')).toHaveCount(1);await expect(sourceRow).toBeVisible();
  await panel.getByRole('button',{name:'초기화',exact:true}).click();
  await choose(page,page.getByRole('combobox',{name:'수집 여부 필터',exact:true}),'수집 안 함');await expect(panel.getByRole('rowheader',{name:'더쿠',exact:true})).toHaveCount(0);await expect(panel.getByRole('rowheader',{name:'인벤',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'초기화',exact:true}).click();
  const limited=page.getByRole('combobox',{name:'뽐뿌 수집 여부',exact:true});await limited.click();
  await expect(page.getByRole('option',{name:'수집함',exact:true})).toHaveAttribute('aria-disabled','true');await page.getByRole('option',{name:'수집함',exact:true}).click({force:true});await expect(limited).toHaveText('수집 안 함');
  await limited.press('Escape');
  await publish.click();await search.click();await expect(page.getByRole('listbox')).toHaveCount(0);
  await publish.press('Enter');await publish.press('Tab');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(publish).not.toBeFocused();
  await sourceRow.locator('summary').click();
  await expect(sourceRow).toContainText('서버 오류·재시도 또는 대기 한도 도달');await expect(sourceRow).toContainText('대상: theqoo.net');await expect(sourceRow).toContainText('HTTP 503');
  await expect(sourceRow).toContainText('2026. 01. 02. 09:01');await expect(sourceRow).not.toContainText('fixture-secret');
  for(const width of [1280,390,320]) {await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await sourceRow.locator('summary').press('Enter');await expect(sourceRow.locator('details')).not.toHaveAttribute('open','');
  await sourceRow.locator('summary').press('Enter');await expect(sourceRow.locator('details')).toHaveAttribute('open','');
  await choose(page,publish,'사용 안 함'); // Restore the unsaved value; no settings are written.
  await page.setViewportSize({width:1280,height:900});await page.getByRole('heading',{name:'수집처 관리',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'worklog/2026-10-10/collection-failure-diagnostics/fixture-desktop.png'});
  await page.setViewportSize({width:390,height:900});await page.getByRole('heading',{name:'수집처 관리',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'worklog/2026-10-10/collection-failure-diagnostics/fixture-mobile.png'});
  assert.deepEqual(await f.database.query('SELECT count(*)::int n FROM collect.batch_source_publish_policy'),[{n:0}]);
});
