import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';

await test('D01/D02 browser: expired original closes text, image, links and actions on 410 and deadline', {timeout:120000},async t=>{
 const f=await browserFixture(t,{batchReview:true}),browser=await launchBrowser();t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:320,height:900}}),page=await context.newPage();
 await context.addCookies([{name:'BLARIYO_ADMIN_SESSION',value:f.adminToken,url:f.origin}]);
 await context.route('**/*',async route=>{
  if(route.request().url()==='https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3')
   return route.fulfill({status:200,contentType:'application/javascript',body:'/* isolated loader */'});
  if(!route.request().url().startsWith(f.origin+'/'))return route.abort();
  return route.continue();
 });
 const run=randomUUID();
 await f.pool.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('expiry-browser','example.invalid','fixture')");
 await f.pool.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'expiry-browser','manual','WRITE_DB','COMPLETED',1,1,10000)",[run]);
 const bytes=await sharp({create:{width:120,height:60,channels:3,background:'#00a19b'}}).png().toBuffer();
 async function seed(title:string){
  const id=randomUUID(),url='https://example.invalid/'+id,key=`collect/media/${id}/1`;
  await f.pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,version,fetched_at)
   VALUES($1::uuid,$2,'expiry-browser',$1::text,$3,$4,'FETCHED',$5,$6,1,clock_timestamp())`,
  [id,run,url,createHash('sha256').update(url).digest(),title,JSON.stringify([{type:'TEXT',text:'EXPIRED_BROWSER_ORIGINAL_CANARY'},{type:'IMAGE',imagePosition:1,alt:'기한 확인 이미지'}])]);
  await mkdir(`${f.collectRoot}/collect/media/${id}`,{recursive:true});await writeFile(`${f.collectRoot}/${key}`,bytes);
  await f.pool.query("INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key) VALUES($1,$2,1,'IMAGE',$3,'image/png',$4,$5)",[randomUUID(),id,createHash('sha256').update(bytes).digest(),bytes.length,key]);
  return id;
 }
 const first=await seed('410 원문 회수'),second=await seed('기한 원문 회수');
 await page.goto(f.origin+'/admin/batch');
 const release=Promise.withResolvers<void>(),requested=Promise.withResolvers<void>();
 await page.route(`**/batch-items/${first}/media/1/preview`,async route=>{requested.resolve();await release.promise;await route.continue();});
 await page.locator('.batch-list').getByRole('button',{name:'410 원문 회수',exact:true}).click();
 const detail=page.getByRole('region',{name:'수집 결과 상세'});
 await expect(detail).toContainText('EXPIRED_BROWSER_ORIGINAL_CANARY');
 await detail.getByRole('img').scrollIntoViewIfNeeded();await requested.promise;
 await f.pool.query('UPDATE collect.batch_retention SET expires_at=clock_timestamp() WHERE item_id=$1',[first]);release.resolve();
 await expect(detail).toHaveCount(0);await expect(page.getByText('원문 보관 기한이 지나 본문과 미리보기를 닫았습니다.')).toBeVisible();
 await expect(page.getByText('EXPIRED_BROWSER_ORIGINAL_CANARY')).toHaveCount(0);
 await expect(page.locator('.batch-list').getByRole('button',{name:'410 원문 회수',exact:true})).toHaveCount(0);
 assert.equal((await context.request.get(f.origin+`/api/v1/admin/collect/batch-items/${first}/media/1/preview`)).status(),410);
 await f.pool.query("UPDATE collect.batch_retention SET expires_at=clock_timestamp()+interval '3 seconds' WHERE item_id=$1",[second]);
 await page.locator('.batch-list').getByRole('button',{name:'기한 원문 회수',exact:true}).click();
 await expect(detail).toContainText('EXPIRED_BROWSER_ORIGINAL_CANARY');
 await expect(detail).toHaveCount(0,{timeout:6000});
 await expect(page.getByRole('button',{name:'게시글 초안 만들기'})).toHaveCount(0);
 await expect(page.getByRole('img',{name:'기한 확인 이미지'})).toHaveCount(0);
 await expect(page.locator('.batch-list li')).toHaveCount(0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await mkdir('test-results/browser',{recursive:true});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'test-results/browser/batch-expired-320.png',fullPage:true});
});
