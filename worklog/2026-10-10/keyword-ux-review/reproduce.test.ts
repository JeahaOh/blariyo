import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { browserFixture } from '../../../tests/helpers/browser-fixture.ts';
import { launchBrowser } from '../../../tests/helpers/launch-browser.ts';

await test('audit reproduction: failed row save, bulk draft retention, navigation loss and selection scope', {timeout:90000}, async t => {
  const f = await browserFixture(t,{batchReview:true});
  const browser = await launchBrowser();t.after(()=>browser.close());
  const context = await browser.newContext(),page = await context.newPage();
  const path='/api/v1/admin/collect/auto-publish-keywords';
  const read=async()=> (await (await context.request.get(f.origin+path)).json()).data;
  await page.goto(f.origin+'/admin/keywords');
  await page.getByRole('button',{name:'개발 관리자 로그인'}).click();
  await expect(page.getByRole('heading',{name:'키워드 관리',exact:true})).toBeVisible();
  const search=page.getByRole('searchbox',{name:'검색',exact:true});
  const field=page.getByRole('textbox',{name:'출근 키워드',exact:true});
  const before=await read();
  await search.fill('출근');await field.fill('퇴근');
  const rowResponse=page.waitForResponse(r=>r.url().startsWith(f.origin+path+'/')&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'출근 저장',exact:true}).click();
  assert.equal((await rowResponse).status(),409);
  await expect(page.getByRole('status')).toContainText('동일한 키워드와 조건');
  await expect(field).toHaveValue('출근');
  assert.deepEqual(await read(),before);
  await page.screenshot({path:'worklog/2026-10-10/keyword-ux-review/row-error.png'});
  const failedRow={httpStatus:409,inputBefore:'퇴근',inputAfter:await field.inputValue(),databaseUnchanged:true};

  await field.fill('퇴근');
  const bulkResponse=page.waitForResponse(r=>r.url()===f.origin+path+'/bulk'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'일괄 저장',exact:true}).click();
  assert.equal((await bulkResponse).status(),409);
  await expect(page.getByRole('status').first()).toContainText('일괄 저장하지 않았습니다');
  await expect(field).toHaveValue('퇴근');
  assert.deepEqual(await read(),before);
  const failedBulk={httpStatus:409,inputAfter:await field.inputValue(),databaseUnchanged:true};

  await field.fill('출근미저장검토');let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss();});
  await page.getByRole('link',{name:'게시글 관리',exact:true}).click();
  await expect(page).toHaveURL(f.origin+'/admin');
  await page.getByRole('link',{name:'키워드 관리',exact:true}).click();
  await expect(page.getByRole('heading',{name:'키워드 관리',exact:true})).toBeVisible();
  await search.fill('출근');await expect(field).toHaveValue('출근');
  assert.equal(dialogs,0);assert.deepEqual(await read(),before);
  const navigation={inputBefore:'출근미저장검토',inputAfter:await field.inputValue(),confirmations:dialogs};

  await search.fill('');const region=page.getByRole('region',{name:'키워드 일괄 작업'});
  const first=page.getByRole('checkbox',{name:'정치 선택',exact:true});
  await first.check();await expect(region).toContainText('선택한 1개');
  await first.uncheck();await expect(region).toContainText('전체 125개');
  await page.getByRole('button',{name:'일괄 삭제',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('125개 키워드를 삭제할까요');
  await page.screenshot({path:'worklog/2026-10-10/keyword-ux-review/selection-clear.png'});
  await page.getByRole('button',{name:'취소',exact:true}).click();assert.deepEqual(await read(),before);
  const scope={checkedTargetCount:1,afterUncheckTargetCount:125,deleteConfirmationCount:125,deleteExecuted:false};
  await writeFile('worklog/2026-10-10/keyword-ux-review/reproduction.json',JSON.stringify({failedRow,failedBulk,navigation,scope},null,2)+'\n');
});
