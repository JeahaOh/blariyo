import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { browserFixture } from '../helpers/browser-fixture.mjs';
test(
  'Chromium collection review through BFF and private preview to draft',
  { timeout: 120000 },
  async (t) => {
    const f = await browserFixture(t, { collection: true });
    await f.pool.query(
      "INSERT INTO collect.source(name,base_url,host,is_active,robots_allowed,robots_checked_at,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES('Fixture','https://fixture.example','fixture.example',true,true,now(),1000,100,'system:migration','system:migration')"
    );
    await f.posts.command(
      'create',
      {},
      {
        boardSlug: 'meme',
        title: '기존 출처 게시글',
        source: { name: 'Fixture', url: 'https://fixture.example/123' },
        pinnedPosition: null,
        blocks: [{ type: 'TEXT', text: '중복 확인 fixture' }],
      },
      'system:scheduler'
    );
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin },
    ]);
    const external = [],
      errors = [];
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== f.origin) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(f.origin + '/admin/collect');
    await expect(page.getByRole('heading', { name: '수집 후보 검수' })).toBeVisible();
    await page.getByLabel('상세 글 URL').fill('https://fixture.example/123');
    await page.getByRole('button', { name: '수집 요청', exact: true }).click();
    await expect(page.getByRole('button', { name: /#1 Fixture/ })).toBeVisible();
    const machine = async (path, body) => {
      const r = await fetch(f.origin + '/api/collector/v1' + path, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + f.collectorToken,
          'Idempotency-Key': randomUUID(),
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      const result = await r.json();
      assert.equal(r.status, 200, JSON.stringify(result));
      return result.data;
    };
    const job = (
      await machine('/candidates/claim', { collectorId: 'fixture', maxItems: 1, leaseSeconds: 60 })
    ).items[0];
    const result = await machine(`/candidates/${job.candidateId}/result`, {
      collectorId: 'fixture',
      lockVersion: job.lockVersion,
      status: 'NEW',
      title: '브라우저 검수 후보',
      canonicalUrl: 'https://fixture.example/123',
      parserVersion: 'fixture-v1',
      sourcePublishedAt: null,
      warnings: [],
      imageCandidates: [{ position: 1, remoteUrl: 'https://images.example/1.png' }],
    });
    const image = result.imageCandidates[0];
    const bytes = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#fda54e' },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set('collectorId', 'fixture');
    form.set('lockVersion', String(result.lockVersion));
    form.set('file', new Blob([bytes], { type: 'image/png' }), 'test.png');
    await machine(`/candidates/${job.candidateId}/images/${image.candidateImageId}/preview`, form);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await page.getByRole('button', { name: /브라우저 검수 후보/ }).click();
    await expect(page.getByRole('img', { name: '검수용 미리보기' })).toBeVisible();
    assert.equal(
      await page
        .getByRole('img', { name: '검수용 미리보기' })
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true
    );
    await mkdir('test-results/m0-browser', { recursive: true });
    await page.screenshot({
      path: 'test-results/m0-browser/collection-desktop.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true
    );
    await page.screenshot({
      path: 'test-results/m0-browser/collection-mobile.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByLabel('초안에 포함').check();
    await page.getByLabel('이미지 설명').fill('주황색 테스트 이미지');
    await expect(page.getByRole('button', { name: '검수 완료 · 초안 만들기' })).toBeDisabled();
    await page.getByLabel('원문과 이미지의 중복 가능성을 확인했습니다.').check();
    await expect(page.getByRole('button', { name: '검수 완료 · 초안 만들기' })).toBeEnabled();
    await page.getByRole('button', { name: '검수 완료 · 초안 만들기' }).click();
    await page.waitForURL(/\/admin\?postId=/);
    await expect(page.getByLabel('제목', { exact: true })).toHaveValue('브라우저 검수 후보');
    assert.equal(
      (await f.pool.query('SELECT status FROM collect.candidate')).rows[0].status,
      'APPROVED'
    );
    await page.goto(f.origin + '/admin/collect/sources');
    await expect(page.getByRole('heading', { name: '수집 출처' })).toBeVisible();
    await page.getByLabel('수집 활성화').uncheck();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('main').getByRole('status')).toContainText('저장했습니다.');
    assert.equal(
      (await f.pool.query('SELECT is_active FROM collect.source')).rows[0].is_active,
      false
    );
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
  }
);
