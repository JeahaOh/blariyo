import test from 'node:test';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { object } from '../helpers/browser-values.ts';
import { chooseSetting as choose } from '../helpers/choose-setting.ts';
import { waitForWebReady } from '../helpers/web-ready.ts';
await test(
  'keyword menu: add, row save, preserve other edits, filters, conflict, reload and responsive layout',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext(),
      page = await context.newPage();
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    await expect(page.getByRole('heading', { name: '키워드 관리', exact: true })).toHaveCount(1);
    await expect(page.getByRole('link', { name: '키워드 관리', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    const density = await page.evaluate(() => {
      const table = document.querySelector('.keyword-table');
      const rows = [...document.querySelectorAll('.keyword-table tbody tr')];
      return {
        top: table?.getBoundingClientRect().top ?? Infinity,
        height: rows[0]?.getBoundingClientRect().height ?? Infinity,
        visible: rows.filter((row) => row.getBoundingClientRect().bottom <= innerHeight).length,
      };
    });
    assert.ok(density.top < 330, `table starts at ${density.top}px`);
    assert.ok(density.height <= 56, `row height ${density.height}px`);
    assert.ok(density.visible >= 8, `only ${density.visible} full rows visible`);
    await page.screenshot({ path: 'worklog/2026-10-10/keyword-compact-ui/initial-desktop.png' });
    const search = page.getByRole('searchbox', { name: '검색', exact: true });
    await search.fill('커피');
    await page.getByRole('textbox', { name: '커피 키워드', exact: true }).fill('커피수정대기');
    await search.fill('출근');
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('textbox', { name: '출근 키워드', exact: true }) });
    await choose(
      page,
      row.getByRole('combobox', { name: '출근 사용 여부', exact: true }),
      '사용 안 함'
    );
    await row.getByRole('button', { name: '출근 저장', exact: true }).click();
    await expect(row.getByRole('status')).toContainText('저장했습니다');
    await search.fill('커피');
    await expect(page.getByRole('textbox', { name: '커피 키워드', exact: true })).toHaveValue(
      '커피수정대기'
    );
    const persisted = await context.request.get(
      f.origin + '/api/v1/admin/collect/auto-publish-keywords'
    );
    assert.equal(persisted.status(), 200);
    const data: unknown = await persisted.json();
    assert.ok(typeof data === 'object' && data && 'data' in data);
    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    await waitForWebReady(page);
    await expect(search).toHaveValue('');
    await search.fill('커피');
    await expect(page.getByRole('textbox', { name: '커피 키워드', exact: true })).toHaveValue(
      '커피'
    );
    await search.fill('출근');
    await expect(row.getByRole('combobox', { name: '출근 사용 여부', exact: true })).toHaveText(
      '사용 안 함'
    );
    await page.getByText('키워드 추가', { exact: true }).click();
    await page.getByRole('textbox', { name: '새 키워드', exact: true }).fill('키워드관리검증');
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('추가했습니다');
    await search.fill('키워드관리검증');
    const added = page
      .getByRole('row')
      .filter({ has: page.getByRole('textbox', { name: '키워드관리검증 키워드', exact: true }) });
    await expect(added).toBeVisible();
    // A second writer advances the global revision while this browser retains the old one.
    const external = await context.request.get(
      f.origin + '/api/v1/admin/collect/auto-publish-keywords'
    );
    const body: unknown = await external.json();
    assert.ok(
      typeof body === 'object' &&
        body !== null &&
        'data' in body &&
        typeof body.data === 'object' &&
        body.data !== null &&
        'ruleVersion' in body.data &&
        typeof body.data.ruleVersion === 'string'
    );
    assert.equal(
      (
        await context.request.post(f.origin + '/api/v1/admin/collect/auto-publish-keywords', {
          headers: { Origin: f.origin },
          data: {
            ruleVersion: body.data.ruleVersion,
            keyword: '동시변경검증',
            group: 'LIFE',
            scope: 'TITLE',
            matchMode: 'CONTAINS',
            enabled: true,
          },
        })
      ).status(),
      200
    );
    await choose(
      page,
      added.getByRole('combobox', { name: '키워드관리검증 사용 여부', exact: true }),
      '사용 안 함'
    );
    await added.getByRole('button', { name: '키워드관리검증 저장', exact: true }).click();
    await expect(added.getByRole('status')).toContainText('다른 관리자가 변경');
    await expect(
      added.getByRole('combobox', { name: '키워드관리검증 사용 여부', exact: true })
    ).toHaveText('사용');
    await search.fill('');
    await choose(page, page.getByRole('combobox', { name: '분류 필터', exact: true }), '생활');
    await choose(
      page,
      page.getByRole('combobox', { name: '사용 여부 필터', exact: true }),
      '사용 안 함'
    );
    await expect(page.getByRole('textbox', { name: '출근 키워드', exact: true })).toBeVisible();
    await choose(
      page,
      page.getByRole('combobox', { name: '사용 여부 필터', exact: true }),
      '전체 상태'
    );
    await page.getByText('키워드 추가', { exact: true }).click();
    for (const width of [1280, 1024, 900, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true
      );
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: 'worklog/2026-10-10/keyword-compact-ui/desktop.png' });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: 'worklog/2026-10-10/keyword-compact-ui/mobile.png' });
    let fail = true;
    await page.route('**/api/v1/admin/collect/auto-publish-keywords', (route) =>
      fail
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.continue()
    );
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다');
    fail = false;
    await page.getByRole('button', { name: '다시 조회', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: '검색', exact: true })).toBeVisible();
  }
);
await test(
  'keyword menu: EDITOR sees filters and read-only controls',
  { timeout: 90000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true, adminRole: 'EDITOR' }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(f.origin + '/admin/keywords');
    await page.getByRole('button', { name: '개발 관리자 로그인' }).click();
    await expect(page.getByText('설정 변경은 소유자만 할 수 있습니다.')).toBeVisible();
    await page.getByRole('searchbox', { name: '검색', exact: true }).fill('커피');
    await expect(page.getByRole('textbox', { name: '커피 키워드', exact: true })).toBeDisabled();
    await expect(
      page.getByRole('combobox', { name: '커피 사용 여부', exact: true })
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: '커피 저장', exact: true })).toHaveCount(0);
    await expect(page.getByText('키워드 추가', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '일괄 저장', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /선택한 \d+개 삭제/ })).toHaveCount(0);
  }
);
await test(
  'keyword bulk: filter defaults, checked targets, one-click save, retained drafts, deletion and version conflict',
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
    const search = page.getByRole('searchbox', { name: '검색', exact: true }),
      selection = page.getByRole('region', { name: '키워드 일괄 작업' });
    await expect(selection).toContainText('전체 125개');
    await expect(page.getByRole('button', { name: '일괄 저장', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '선택 행에 적용', exact: true })).toHaveCount(0);
    await page.getByRole('checkbox', { name: '현재 페이지 선택', exact: true }).check();
    await expect(selection).toContainText('선택한 25개');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(selection).toContainText('선택한 25개');
    await page.getByRole('checkbox', { name: '현재 페이지 선택', exact: true }).check();
    await expect(selection).toContainText('선택한 50개');
    await page.getByRole('button', { name: '이전', exact: true }).click();
    await page.getByRole('checkbox', { name: '현재 페이지 선택', exact: true }).uncheck();
    await expect(selection).toContainText('선택한 25개');
    await search.fill('고양이');
    await expect(selection).toContainText('검색 결과 1개');
    await page.getByRole('textbox', { name: '고양이 키워드', exact: true }).fill('고양이미저장');
    await search.fill('');
    await choose(page, page.getByRole('combobox', { name: '분류 필터', exact: true }), '생활');
    await expect(selection).toContainText('검색 결과 20개');
    await choose(
      page,
      page.getByRole('combobox', { name: '일괄 일치 방식', exact: true }),
      '단어 일치'
    );
    await expect(selection).toContainText('변경 20개');
    await page.getByRole('button', { name: '일괄 저장', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('20개 키워드를 저장');
    const persisted = object(
      object(await (await context.request.get(f.origin + path)).json()).data
    );
    assert.ok(Array.isArray(persisted.items));
    assert.ok(
      persisted.items
        .map(object)
        .filter((item) => item.group === 'LIFE')
        .every((item) => item.matchMode === 'WORD')
    );
    assert.ok(persisted.items.map(object).some((item) => item.keyword === '고양이'));
    await choose(page, page.getByRole('combobox', { name: '분류 필터', exact: true }), '유머');
    await expect(selection).toContainText('검색 결과 10개');
    await expect(page.getByRole('textbox', { name: '고양이 키워드', exact: true })).toHaveValue(
      '고양이미저장'
    );
    await page.getByRole('checkbox', { name: '강아지 선택', exact: true }).check();
    await expect(selection).toContainText('선택한 1개');
    await choose(
      page,
      page.getByRole('combobox', { name: '일괄 일치 방식', exact: true }),
      '단어 일치'
    );
    await page.getByRole('button', { name: '일괄 저장', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('1개 키워드를 저장');
    await expect(page.getByRole('combobox', { name: '강아지 일치 방식', exact: true })).toHaveText(
      '단어 일치'
    );
    await expect(page.getByRole('textbox', { name: '고양이 키워드', exact: true })).toHaveValue(
      '고양이미저장'
    );
    await expect(page.getByRole('combobox', { name: '고양이 일치 방식', exact: true })).toHaveText(
      '부분 일치'
    );
    await page.getByRole('button', { name: '선택 해제', exact: true }).click();
    await expect(selection).toContainText('검색 결과 10개');
    await expect(page.getByRole('combobox', { name: '일괄 일치 방식', exact: true })).toHaveText(
      '일치 방식 유지'
    );
    await expect(page.getByRole('button', { name: '선택한 0개 삭제', exact: true })).toBeDisabled();
    await page.getByRole('checkbox', { name: '현재 페이지 선택', exact: true }).check();
    await page.getByRole('button', { name: '선택한 10개 삭제', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('10개 키워드를 삭제할까요');
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    // A second writer changes the global version before the confirmed deletion.
    const snapshot = object(object(await (await context.request.get(f.origin + path)).json()).data);
    assert.equal(typeof snapshot.ruleVersion, 'string');
    assert.equal(
      (
        await context.request.post(f.origin + path, {
          headers: { Origin: f.origin },
          data: {
            ruleVersion: snapshot.ruleVersion,
            keyword: '일괄동시변경',
            group: 'LIFE',
            scope: 'TITLE',
            matchMode: 'CONTAINS',
            enabled: true,
          },
        })
      ).status(),
      200
    );
    await page.getByRole('button', { name: '선택한 10개 삭제', exact: true }).click();
    await page.getByRole('button', { name: '10개 삭제 확인', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('다른 관리자가 변경');
    await expect(page.getByRole('checkbox', { name: '고양이 선택', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '선택한 10개 삭제', exact: true }).click();
    await page.getByRole('button', { name: '10개 삭제 확인', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('10개 키워드를 삭제');
    await expect(page.getByText('조건에 맞는 키워드가 없습니다.', { exact: true })).toBeVisible();
    await choose(page, page.getByRole('combobox', { name: '분류 필터', exact: true }), '생활');
    await search.fill('일괄동시변경');
    await page.getByRole('button', { name: '일괄동시변경 삭제', exact: true }).click();
    await page.getByRole('button', { name: '1개 삭제 확인', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('1개 키워드를 삭제');
    await search.fill('');
    await choose(
      page,
      page.getByRole('combobox', { name: '일괄 일치 방식', exact: true }),
      '부분 일치'
    );
    for (const width of [1280, 1024, 900, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true
      );
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: 'worklog/2026-10-10/keyword-compact-ui/bulk-desktop.png',
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: 'worklog/2026-10-10/keyword-compact-ui/bulk-mobile.png',
    });
  }
);
