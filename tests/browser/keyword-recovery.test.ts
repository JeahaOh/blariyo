import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { chooseSetting } from '../helpers/choose-setting.ts';
import { object } from '../helpers/browser-values.ts';
import { waitForWebReady } from '../helpers/web-ready.ts';

await test(
  'keyword errors: row and bulk validation keep drafts and leave the database unchanged',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext(),
      page = await context.newPage(),
      path = '/api/v1/admin/collect/auto-publish-keywords';
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    await expect(page.getByRole('heading', { name: '키워드 관리', exact: true })).toBeVisible();
    const initial = object(object(await (await context.request.get(f.origin + path)).json()).data);
    const search = page.getByRole('searchbox', { name: '검색', exact: true });
    await search.fill('커피');
    await page.getByRole('textbox', { name: '커피 키워드', exact: true }).fill('커피다른수정');
    await search.fill('출근');
    const field = page.getByRole('textbox', { name: '출근 키워드', exact: true });
    const row = page.getByRole('row').filter({ has: field });
    await field.fill('퇴근');
    await row.getByRole('button', { name: '출근 저장', exact: true }).click();
    await expect(row.getByRole('status')).toContainText('동일한 키워드');
    await expect(field).toHaveValue('퇴근');
    assert.deepEqual(
      object(object(await (await context.request.get(f.origin + path)).json()).data),
      initial
    );
    await field.fill('출근');
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '출근 일치 방식', exact: true }),
      '단어 일치'
    );
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '일괄 일치 방식', exact: true }),
      '부분 일치'
    );
    // The bulk override restores the persisted value: the outgoing payload must contain no change.
    await expect(page.getByRole('button', { name: '일괄 저장', exact: true })).toBeDisabled();
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '일괄 일치 방식', exact: true }),
      '일치 방식 유지'
    );
    await expect(page.getByRole('button', { name: '일괄 저장', exact: true })).toBeEnabled();
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '출근 일치 방식', exact: true }),
      '부분 일치'
    );
    await field.fill('a\u200bb');
    await row.getByRole('button', { name: '출근 저장', exact: true }).click();
    await expect(row.getByRole('status')).toContainText('입력 조건');
    await expect(field).toHaveValue('a\u200bb');
    await field.fill('퇴근');
    await page.getByRole('button', { name: '일괄 저장', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('동일한 키워드');
    await expect(field).toHaveValue('퇴근');
    await field.fill('a\u200bb');
    await page.getByRole('button', { name: '일괄 저장', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('입력 조건');
    await expect(field).toHaveValue('a\u200bb');
    assert.deepEqual(
      object(object(await (await context.request.get(f.origin + path)).json()).data),
      initial
    );
    await search.fill('커피');
    await expect(page.getByRole('textbox', { name: '커피 키워드', exact: true })).toHaveValue(
      '커피다른수정'
    );
  }
);

await test(
  'keyword navigation: row, new keyword and bulk edits warn; cancel and refresh preserve input',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    let discard = false;
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.type());
      if (discard) await dialog.accept();
      else await dialog.dismiss();
    });

    const search = page.getByRole('searchbox', { name: '검색', exact: true });
    await search.fill('출근');
    const field = page.getByRole('textbox', { name: '출근 키워드', exact: true });
    await field.fill('출근미저장검토');
    await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
    await expect(page).toHaveURL(f.origin + '/admin/keywords');
    await expect(field).toHaveValue('출근미저장검토');
    assert.deepEqual(dialogs, ['confirm']);
    // Cancelled refresh can reject with ERR_ABORTED or time out before any navigation commits.
    const refreshed = await page.reload({ waitUntil: 'commit', timeout: 2000 }).then(
      () => true,
      () => false
    );
    assert.equal(refreshed, false);
    assert.equal(dialogs.at(-1), 'beforeunload');
    await expect(field).toHaveValue('출근미저장검토');
    discard = true;
    await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
    await expect(page).toHaveURL(f.origin + '/admin');
    await page.getByRole('link', { name: '키워드 관리', exact: true }).click();
    await waitForWebReady(page);
    await expect(search).toHaveValue('');
    await search.fill('출근');
    await expect(field).toHaveValue('출근');
    discard = false;
    await page.getByText('키워드 추가', { exact: true }).click();
    const newField = page.getByRole('textbox', { name: '새 키워드', exact: true });
    await newField.fill('새글미저장검토');
    const beforeNew = dialogs.length;
    await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
    assert.equal(dialogs.length, beforeNew + 1);
    await expect(newField).toHaveValue('새글미저장검토');
    await newField.fill('');
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '일괄 일치 방식', exact: true }),
      '단어 일치'
    );
    const beforeMode = dialogs.length;
    await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
    assert.equal(dialogs.length, beforeMode + 1);
    await expect(page).toHaveURL(f.origin + '/admin/keywords');
    await expect(page.getByRole('combobox', { name: '일괄 일치 방식', exact: true })).toHaveText(
      '단어 일치'
    );
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '일괄 일치 방식', exact: true }),
      '일치 방식 유지'
    );
    const clean = dialogs.length;
    await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
    await expect(page).toHaveURL(f.origin + '/admin');
    assert.equal(dialogs.length, clean);
  }
);

await test(
  'keyword deletion: clearing the last selection never enables whole-filter deletion',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext(),
      page = await context.newPage();
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    const deletion = page
      .getByRole('region', { name: '키워드 일괄 작업' })
      .getByRole('button', { name: /삭제/ });
    await expect(deletion).toBeDisabled();
    await expect(deletion).toHaveText('선택한 0개 삭제');
    const first = page.getByRole('checkbox', { name: '정치 선택', exact: true });
    await first.check();
    await expect(deletion).toBeEnabled();
    await expect(deletion).toHaveText('선택한 1개 삭제');
    await first.uncheck();
    await expect(deletion).toBeDisabled();
    await expect(deletion).toHaveText('선택한 0개 삭제');
    await first.check();
    await deletion.click();
    await expect(page.getByRole('alert')).toContainText('1개 키워드를 삭제할까요');
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await page.getByRole('button', { name: '선택 해제', exact: true }).click();
    await expect(deletion).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 900 });
    const mobilePage = page.getByRole('checkbox', { name: '현재 페이지 선택', exact: true });
    await expect(mobilePage).toBeVisible();
    await mobilePage.check();
    await expect(deletion).toHaveText('선택한 25개 삭제');
    await mobilePage.uncheck();
    await expect(deletion).toBeDisabled();
    const data = object(
      object(
        await (
          await context.request.get(f.origin + '/api/v1/admin/collect/auto-publish-keywords')
        ).json()
      ).data
    );
    assert.ok(Array.isArray(data.items));
    assert.equal(data.items.length, 125);
    assert.equal(data.ruleVersion, 'life-humor-v1');
  }
);

await test(
  'keyword saving: navigation stays blocked while a request is pending and unlocks after success',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    await page.getByRole('searchbox', { name: '검색', exact: true }).fill('출근');
    const field = page.getByRole('textbox', { name: '출근 키워드', exact: true });
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '출근 사용 여부', exact: true }),
      '사용 안 함'
    );
    let release = () => {},
      hit = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
      }),
      requested = new Promise<void>((resolve) => {
        hit = resolve;
      });
    await page.route('**/auto-publish-keywords/*', async (route) => {
      hit();
      await held;
      await route.continue();
    });
    let dialogs = 0;
    page.on('dialog', async (dialog) => {
      dialogs++;
      await dialog.dismiss();
    });
    try {
      await page.getByRole('button', { name: '출근 저장', exact: true }).click();
      await requested;
      await expect(field).toBeDisabled();
      await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
      await expect(page).toHaveURL(f.origin + '/admin/keywords');
      assert.equal(dialogs, 0);
    } finally {
      release();
    }
    await expect(page.getByRole('status')).toContainText('저장했습니다');
    await expect(field).toBeEnabled();
    await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
    await expect(page).toHaveURL(f.origin + '/admin');
    assert.equal(dialogs, 0);
  }
);

await test(
  'keyword recovery: lost response with failed readback blocks writes until latest values are confirmed',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext(),
      page = await context.newPage(),
      path = '/api/v1/admin/collect/auto-publish-keywords';
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    await page.getByRole('searchbox', { name: '검색', exact: true }).fill('출근');
    let failRead = false,
      mutations = 0;
    await page.route('**/auto-publish-keywords', (route) =>
      failRead
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.continue()
    );
    await page.route('**/auto-publish-keywords/*', async (route) => {
      mutations++;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      failRead = true;
      await route.abort('failed');
    });
    await chooseSetting(
      page,
      page.getByRole('combobox', { name: '출근 사용 여부', exact: true }),
      '사용 안 함'
    );
    await page.getByRole('button', { name: '출근 저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다');
    await expect(page.getByRole('button', { name: '출근 저장', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '일괄 저장', exact: true })).toBeDisabled();
    assert.equal(mutations, 1);
    failRead = false;
    await page.getByRole('button', { name: '다시 조회', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '출근 사용 여부', exact: true })).toHaveText(
      '사용 안 함'
    );
    const data = object(object(await (await context.request.get(f.origin + path)).json()).data);
    assert.ok(Array.isArray(data.items));
    assert.equal(data.ruleVersion, 'life-humor-v1-k2');
    assert.equal(data.items.map(object).find((item) => item.keyword === '출근')?.enabled, false);
    let dialogs = 0;
    page.on('dialog', async (dialog) => {
      dialogs++;
      await dialog.dismiss();
    });
    await page.getByRole('link', { name: '게시글 관리', exact: true }).click();
    await expect(page).toHaveURL(f.origin + '/admin');
    assert.equal(dialogs, 0);
  }
);

await test(
  'keyword reload: untouched rows follow the latest snapshot while edited rows keep their drafts',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext(),
      page = await context.newPage(),
      path = '/api/v1/admin/collect/auto-publish-keywords';
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    const search = page.getByRole('searchbox', { name: '검색', exact: true });
    await search.fill('커피');
    await page.getByRole('textbox', { name: '커피 키워드', exact: true }).fill('커피보존검토');
    const snapshot = object(object(await (await context.request.get(f.origin + path)).json()).data);
    assert.ok(Array.isArray(snapshot.items));
    const item = snapshot.items.map(object).find((row) => row.keyword === '출근');
    assert.ok(item);
    const { keywordId, ...draft } = item;
    assert.equal(typeof keywordId, 'string');
    assert.equal(
      (
        await context.request.patch(f.origin + path + '/' + String(keywordId), {
          headers: { Origin: f.origin },
          data: { ...draft, enabled: false, ruleVersion: snapshot.ruleVersion },
        })
      ).status(),
      200
    );
    await page.getByRole('button', { name: '다시 조회', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '커피 키워드', exact: true })).toHaveValue(
      '커피보존검토'
    );
    await search.fill('출근');
    await expect(page.getByRole('combobox', { name: '출근 사용 여부', exact: true })).toHaveText(
      '사용 안 함'
    );
    await expect(page.getByRole('button', { name: '출근 저장', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '일괄 저장', exact: true })).toBeDisabled();
  }
);
