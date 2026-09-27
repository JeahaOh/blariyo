import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { firstRow } from '../helpers/browser-values.ts';

await test('D02 browser: EDITOR direct-only input, exact URL, lost response recovery, polling and mobile keyboard', { timeout: 120000 }, async t => {
 const f=await browserFixture(t,{directInput:true,adminRole:'EDITOR'}),browser=await launchBrowser();
 t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 await context.addCookies([{name:'BLARIYO_ADMIN_SESSION',value:f.adminToken,url:f.origin}]);
 await f.pool.query("INSERT INTO collect.batch_source(source_key,host,policy_version,enabled,identity_parser) VALUES('browser-direct','www.dogdrip.net','fixture',true,'DOGDRIP')");
 const external:string[]=[];
 await context.route('**/*',async route=>{
  if(route.request().url()==='https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3'&&route.request().resourceType()==='script'){
   await route.fulfill({status:200,contentType:'application/javascript',body:'/* Existing GTM loader is isolated locally; no provider call. */'});return;
  }
  if(!route.request().url().startsWith(f.origin+'/')){external.push(route.request().url());await route.abort();return;}
  await route.continue();
 });
 await page.goto(f.origin+'/admin/batch');
 await expect(page.getByRole('heading',{name:'원문 URL 수집 요청'})).toBeVisible();
 const input=page.getByLabel('원문 HTTPS 주소');
 await input.fill('https://www.dogdrip.net:443/123');await input.press('Enter');
 await expect(page.getByRole('alert')).toContainText('HTTPS 원문 주소를 확인');
 await expect(input).toBeFocused();
 assert.equal(firstRow(await f.pool.query('SELECT count(*) n FROM collect.web_collection_request')).n,'0');
 const keys:string[]=[];let lose=true;
 await page.route('**/api/admin/collect/requests',async route=>{
  keys.push(route.request().headers()['idempotency-key']??'');
  if(lose){lose=false;const result=await route.fetch();assert.equal(result.status(),202);await route.abort('failed');}
  else await route.continue();
 });
 await input.fill('https://www.dogdrip.net/123');await input.press('Enter');
 await expect(page.getByRole('button',{name:'같은 요청으로 결과 확인'})).toBeVisible();
 await expect(input).toBeDisabled();
 await page.getByRole('button',{name:'같은 요청으로 결과 확인'}).click();
 await expect(page.getByRole('heading',{name:'요청 상태'})).toBeFocused();
 await expect(page.getByRole('status')).toHaveText('접수됨');
 assert.equal(keys.length,2);assert.ok(keys[0]);assert.equal(keys[0],keys[1]);
 assert.equal(firstRow(await f.pool.query('SELECT count(*) n FROM collect.web_collection_request')).n,'1');
 assert.equal(firstRow(await f.pool.query('SELECT count(*) n FROM collect.batch_queue')).n,'0');
 await expect(page).toHaveURL(/request=[a-f0-9-]{36}/);
 await page.reload();await expect(page.getByRole('status')).toHaveText('접수됨');
 let polls=0;
 page.on('request',request=>{if(request.method()==='GET'&&/\/api\/admin\/collect\/requests\/[a-f0-9-]+$/.test(request.url()))polls++;});
 await expect.poll(()=>polls,{timeout:10000}).toBeGreaterThan(0);
 await page.getByText('출처 실행 설정 확인',{exact:true}).click();
 await expect(page.getByText('적용 중인 설정을 아직 확인하지 못했습니다.')).toBeVisible();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 const forged=await context.request.post(f.origin+'/api/admin/collect/requests',{headers:{Origin:f.origin,'Idempotency-Key':'forged-role',
  'X-Blariyo-Admin-Role':'OWNER','X-Blariyo-Service-Token':'untrusted-client-value'},data:{url:'https://www.dogdrip.net/123'}});
 assert.equal(forged.status(),202); // Verified EDITOR identity replaces both client supplied headers.
 assert.equal((await context.request.post(f.origin+'/api/admin/collect/requests',{headers:{Origin:'https://other.invalid','Idempotency-Key':'csrf'},data:{url:'https://www.dogdrip.net/123'}})).status(),403);
 assert.equal((await context.request.get(f.origin+'/api/admin/collect/sources')).status(),404);
 assert.deepEqual(external,[]);
 await mkdir('worklog/2026-09-27/m0-implementation/artifacts',{recursive:true});
 await page.screenshot({path:'worklog/2026-09-27/m0-implementation/artifacts/direct-input-390.png',fullPage:true});
 for(const width of [320,1280]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:`worklog/2026-09-27/m0-implementation/artifacts/direct-input-${width}.png`,fullPage:true});
 }
 // An authentication failure keeps the pending command's URL and key in memory until recovery.
 await context.clearCookies();await input.fill('https://www.dogdrip.net/124');await input.press('Enter');
 await expect(page.getByRole('button',{name:'같은 요청으로 결과 확인'})).toBeVisible();await expect(input).toBeDisabled();
 const deniedKey=keys.at(-1);assert.ok(deniedKey);
 assert.equal(firstRow(await f.pool.query('SELECT count(*) n FROM collect.web_collection_request')).n,'1');
 await context.addCookies([{name:'BLARIYO_ADMIN_SESSION',value:f.adminToken,url:f.origin}]);
 await page.getByRole('button',{name:'같은 요청으로 결과 확인'}).click();
 await expect(input).toBeEnabled();assert.equal(keys.at(-1),deniedKey);
 assert.equal(firstRow(await f.pool.query('SELECT count(*) n FROM collect.web_collection_request')).n,'2');
 const runtimePath=f.origin+'/api/admin/collect/runtime-sources',released=Promise.withResolvers<void>();
 let runtimeCalls=0;
 await page.route(runtimePath,async route=>{
  runtimeCalls++;await released.promise;
  await route.fulfill({status:503,json:{success:false,error:{code:'COLLECTION_UNAVAILABLE'}}});
 });
 await page.getByRole('button',{name:'실행 설정 다시 조회'}).click();
 await expect(page.getByText('실행 설정을 확인하고 있습니다.')).toBeVisible();
 released.resolve();await expect(page.getByRole('alert')).toContainText('수집 설정이나 연결을 확인하지 못했습니다.');
 await page.unroute(runtimePath);
 await page.route(runtimePath,route=>route.fulfill({status:200,json:{success:true,data:{items:[]}}}));
 await page.getByRole('button',{name:'실행 설정 다시 조회'}).click();
 await expect(page.getByText('등록된 출처가 없습니다.')).toBeVisible();assert.equal(runtimeCalls,1);
 await page.unroute(runtimePath);await page.getByRole('button',{name:'실행 설정 다시 조회'}).click();
 await expect(page.getByText('적용 중인 설정을 아직 확인하지 못했습니다.')).toBeVisible();
 await page.getByRole('navigation',{name:'관리 메뉴'}).getByRole('link',{name:'게시글 관리',exact:true}).click();
 await expect(page).toHaveURL(f.origin+'/admin');
 const stopped=polls;await new Promise(resolve=>setTimeout(resolve,5200));assert.equal(polls,stopped,'polling must stop on unmount');
 assert.deepEqual(external,[]);
});
