import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import { firstRow, object } from '../helpers/browser-values.ts';

await test(
  'batch review menu is authenticated and hidden when disabled',
  { timeout: 60000 },
  async (t) => {
    const f = await browserFixture(t),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext(),
      page = await context.newPage();
    assert.equal((await context.request.get(f.origin + '/api/admin/features')).status(), 401);
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin },
    ]);
    const response = await context.request.get(f.origin + '/api/admin/features');
    assert.deepEqual(await response.json(), { batchReview: false });
    assert.equal(response.headers()['cache-control'], 'private, no-store');
    await page.goto(f.origin + '/admin');
    await expect(
      page
        .getByRole('navigation', { name: '관리 메뉴' })
        .getByRole('link', { name: '수집 결과 검수' })
    ).toHaveCount(0);
    assert.equal(
      (await context.request.get(f.origin + '/api/v1/admin/collect/batch-items')).status(),
      404
    );
  }
);

await test(
  'authenticated direct batch review preserves content and recovers uncertain commands',
  { timeout: 240000 },
  async (t) => {
    const f = await browserFixture(t, { batchReview: true }),
      browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext();
    const authenticate = () =>
      context.addCookies([{ name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin }]);
    await authenticate();
    const page = await context.newPage(),
      run = randomUUID();
    await f.pool.query(
      "INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','example.invalid','fixture-v1')"
    );
    await f.pool.query(
      "INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'fixture','hot','WRITE_DB','COMPLETED',2,100,10000)",
      [run]
    );
    const bytes = await sharp({
      create: { width: 240, height: 100, channels: 3, background: '#00a19b' },
    })
      .png()
      .toBuffer();
    async function seed(title: string, image = false, state = 'FETCHED') {
      const id = randomUUID(),
        url = 'https://example.invalid/' + id;
      const blocks = [
        { type: 'TEXT', text: '검수용 원문 첫 문단' },
        ...(image ? [{ type: 'IMAGE', imagePosition: 1, alt: '수집된 원본 이미지' }] : []),
        { type: 'LINK', url: 'https://x.com/example/status/123456789', label: '원문 SNS' },
      ];
      await f.pool.query(
        `INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,attachment_metadata,version,fetched_at,failure_code)
      VALUES($1::uuid,$2,'fixture',$1::text,$3,$4,$5,$6,$7,$8,1,now(),$9)`,
        [
          id,
          run,
          url,
          createHash('sha256').update(url).digest(),
          state,
          title,
          JSON.stringify(state === 'FETCHED' ? blocks : []),
          JSON.stringify([
            {
              position: 2,
              remoteUrl: 'https://example.invalid/document.pdf',
              label: '원문 첨부.pdf',
            },
          ]),
          state === 'FAILED' ? 'SOURCE_GONE' : null,
        ]
      );
      if (image) {
        const key = `collect/media/${id}/1`;
        await mkdir(`${f.collectRoot}/collect/media/${id}`, { recursive: true });
        await writeFile(`${f.collectRoot}/${key}`, bytes);
        await f.pool.query(
          "INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key) VALUES($1,$2,1,'IMAGE',$3,'image/png',$4,$5)",
          [randomUUID(), id, createHash('sha256').update(bytes).digest(), bytes.length, key]
        );
      }
      return { id, url, title };
    }
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const feedback = page.locator('main > [role="status"]');
    const detail = page.getByRole('region', { name: '수집 결과 상세' });
    async function open(title: string) {
      await page.goto(f.origin + '/admin/batch');
      await page.waitForFunction(() => '__vue_app__' in document.querySelector('#__nuxt')!);
      await page.locator('.batch-list').getByRole('button', { name: title, exact: true }).click();
      await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(button('검수 시작 / 다시 검수')).toBeEnabled();
    }
    async function approve() {
      await button('검수 시작 / 다시 검수').click();
      await expect(button('승인')).toBeEnabled();
      await button('승인').click();
      await expect(button('게시글 초안 만들기')).toBeEnabled();
    }
    await t.test(
      'enabled menu, private image retry, source attachments and selected draft editor',
      async () => {
        const item = await seed('이미지·첨부 검수', true);
        await page.goto(f.origin + '/admin');
        const menu = page.getByRole('navigation', { name: '관리 메뉴' });
        await menu.getByRole('link', { name: '수집 결과 검수' }).click();
        await expect(page).toHaveURL(f.origin + '/admin/batch');
        assert.equal(
          (await context.request.get(f.origin + '/api/v1/admin/collect/requests')).status(),
          404
        );
        const preview = `**/batch-items/${item.id}/media/1/preview`;
        await page.route(preview, (route) => route.abort('connectionreset'));
        await page
          .locator('.batch-list')
          .getByRole('button', { name: item.title, exact: true })
          .click();
        await expect(detail).toContainText('검수용 원문 첫 문단');
        await expect(
          detail.getByRole('link', { name: '원문 확인 ↗', exact: true })
        ).toHaveAttribute('href', item.url);
        await expect(detail.getByRole('link', { name: '원문 첨부.pdf' })).toHaveAttribute(
          'href',
          'https://example.invalid/document.pdf'
        );
        await expect(detail.getByRole('link', { name: '원문 SNS' })).toHaveAttribute(
          'href',
          'https://x.com/example/status/123456789'
        );
        await detail.locator('.preview-failure').scrollIntoViewIfNeeded();
        await expect(detail.locator('.preview-failure')).toContainText(
          '미리보기를 불러오지 못했습니다'
        );
        await page.unroute(preview);
        await button('다시 불러오기').click();
        await expect(detail.getByRole('img', { name: '수집된 원본 이미지' })).toBeVisible();
        await expect
          .poll(() =>
            detail
              .locator('img')
              .evaluate((img) => img instanceof HTMLImageElement && img.naturalWidth)
          )
          .toBe(240);
        const media = await context.request.get(
          f.origin + `/api/v1/admin/collect/batch-items/${item.id}/media/1/preview`
        );
        assert.equal(media.status(), 200);
        assert.equal(media.headers()['cache-control'], 'private, no-store');
        await context.clearCookies();
        assert.equal(
          (
            await context.request.get(
              f.origin + `/api/v1/admin/collect/batch-items/${item.id}/media/1/preview`
            )
          ).status(),
          401
        );
        await authenticate();
        await approve();
        await page.getByLabel('초안 제목', { exact: true }).fill('검수 후 선택 초안');
        const started = Promise.withResolvers<void>(),
          held = Promise.withResolvers<void>();
        let submissions = 0;
        await page.route(`**/batch-items/${item.id}/draft`, async (route) => {
          submissions++;
          started.resolve();
          await held.promise;
          return route.continue();
        });
        const click = button('게시글 초안 만들기').dblclick();
        await started.promise;
        try {
          await expect(button('게시글 초안 만들기')).toBeDisabled();
          await expect(page.getByLabel('초안 제목', { exact: true })).toBeDisabled();
        } finally {
          held.resolve();
        }
        await click;
        await expect(feedback).toContainText('초안');
        assert.equal(submissions, 1);
        await page.unroute(`**/batch-items/${item.id}/draft`);
        const row = firstRow(
          await f.pool.query(
            'SELECT r.post_id,p.status,p.title FROM collect.batch_review r JOIN content.board_post p ON p.id=r.post_id WHERE r.item_id=$1',
            [item.id]
          )
        );
        assert.equal(row.status, 'DRAFT');
        assert.equal(row.title, '검수 후 선택 초안');
        assert.equal((await f.storage.inventory('public')).length, 0);
        const stored = firstRow(
          await f.pool.query(
            'SELECT private_storage_key,public_storage_key FROM content.board_post_image WHERE post_id=$1',
            [row.post_id]
          )
        );
        assert.equal(stored.public_storage_key, null);
        const privateBytes = await f.storage.get('private', String(stored.private_storage_key));
        assert.equal((await sharp(privateBytes).metadata()).width, 240);
        const before = await sharp(bytes).raw().toBuffer(),
          after = await sharp(privateBytes).raw().toBuffer();
        assert.deepEqual(after, before);
        await mkdir('test-results/m0-browser', { recursive: true });
        for (const width of [320, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => window.scrollTo(0, 0));
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true
          );
          await page.screenshot({
            path: `test-results/m0-browser/batch-review-${width}.png`,
            fullPage: true,
          });
        }
        const link = detail.getByRole('link', { name: '게시글 관리에서 열기' });
        await expect(link).toHaveAttribute('href', '/admin?postId=' + String(row.post_id));
        await link.click();
        await expect(page.getByLabel('제목', { exact: true })).toHaveValue('검수 후 선택 초안');
        await expect(page.getByLabel('본문 1', { exact: true })).toHaveValue('검수용 원문 첫 문단');
        assert.equal(
          (
            await context.request.get(f.origin + '/api/v1/boards/meme/posts/' + String(row.post_id))
          ).status(),
          404
        );
      }
    );
    await t.test(
      'rejection persists when list refresh fails and a stale review requires reopening',
      async () => {
        const item = await seed('반려·충돌 확인');
        await open(item.title);
        await button('검수 시작 / 다시 검수').click();
        await expect(button('반려')).toBeEnabled();
        await page.route(/\/api\/v1\/admin\/collect\/batch-items\?/, (route) =>
          route.fulfill({
            status: 503,
            json: { success: false, error: { code: 'DEPENDENCY_UNAVAILABLE' } },
          })
        );
        await button('반려').click();
        await expect(feedback).toHaveText('검수 상태를 저장했습니다.');
        await expect(page.getByRole('alert')).toContainText('저장은 완료했지만 목록');
        await expect(button('처리 결과 다시 확인')).toHaveCount(0);
        assert.equal(
          firstRow(
            await f.pool.query('SELECT status FROM collect.batch_review WHERE item_id=$1', [
              item.id,
            ])
          ).status,
          'REJECTED'
        );
        await page.unroute(/\/api\/v1\/admin\/collect\/batch-items\?/);
        await button('목록 다시 조회').click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await button('검수 시작 / 다시 검수').click();
        await expect(button('승인')).toBeEnabled();
        await f.pool.query('UPDATE collect.batch_item SET version=version+1 WHERE id=$1', [
          item.id,
        ]);
        await button('승인').click();
        await expect(feedback).toContainText('수집 내용 또는 검수 상태가 바뀌었습니다');
        await expect(button('처리 결과 다시 확인')).toHaveCount(0);
        await page
          .locator('.batch-list')
          .getByRole('button', { name: item.title, exact: true })
          .click();
        await expect(button('검수 시작 / 다시 검수')).toBeEnabled();
        await approve();
        const review = firstRow(
          await f.pool.query(
            'SELECT status,item_version FROM collect.batch_review WHERE item_id=$1',
            [item.id]
          )
        );
        assert.equal(review.status, 'APPROVED');
        assert.equal(String(review.item_version), '2');
      }
    );
    await t.test(
      'a canonical duplicate leaves review approved and creates no additional draft',
      async () => {
        const item = await seed('중복 원문 확인');
        const saved = await context.request.post(f.origin + '/api/v1/admin/posts', {
          headers: { Origin: f.origin, 'Idempotency-Key': randomUUID() },
          data: {
            boardSlug: 'meme',
            title: '기존 원문 초안',
            source: { name: 'fixture', url: item.url },
            blocks: [{ type: 'TEXT', text: '기존 원문' }],
            pinnedPosition: null,
          },
        });
        assert.equal(saved.status(), 201, await saved.text());
        await open(item.title);
        await approve();
        await button('게시글 초안 만들기').click();
        await expect(feedback).toHaveText('이미 같은 원문의 게시글이 있습니다.');
        await expect(button('처리 결과 다시 확인')).toHaveCount(0);
        assert.equal(
          firstRow(
            await f.pool.query('SELECT post_id FROM collect.batch_review WHERE item_id=$1', [
              item.id,
            ])
          ).post_id,
          null
        );
        assert.equal(
          (await f.pool.query('SELECT id FROM content.board_post WHERE title=$1', [item.title]))
            .rowCount,
          0
        );
      }
    );
    for (const loss of ['response', 'detail'])
      for (const denial of [401, 403]) {
        await t.test(
          `draft ${loss} loss -> ${denial} -> same request and one private draft`,
          async () => {
            const item = await seed(`${loss}-${denial} 복구`);
            await open(item.title);
            await approve();
            const keys: string[] = [],
              bodies: string[] = [];
            let stage = 'loss';
            const path = `**/batch-items/${item.id}/draft`,
              detailPath = f.origin + `/api/v1/admin/collect/batch-items/${item.id}`;
            await page.route(path, async (route) => {
              keys.push(route.request().headers()['idempotency-key'] || '');
              bodies.push(route.request().postData() || '');
              if (stage === 'loss' && loss === 'response') {
                assert.equal((await route.fetch()).status(), 201);
                return route.abort('connectionreset');
              }
              if (stage === 'denied' && denial === 403)
                return route.fulfill({
                  status: 403,
                  json: { success: false, error: { code: 'FORBIDDEN' } },
                });
              return route.continue();
            });
            if (loss === 'detail')
              await page.route(detailPath, (route) =>
                route.fulfill({
                  status: 503,
                  json: { success: false, error: { code: 'DEPENDENCY_UNAVAILABLE' } },
                })
              );
            await button('게시글 초안 만들기').click();
            await expect(feedback).toContainText('처리 결과를 확인하지 못했습니다');
            await page.unroute(detailPath);
            stage = 'denied';
            if (denial === 401) await context.clearCookies();
            for (let attempt = 0; attempt < 2; attempt++) {
              const response = page.waitForResponse((r) =>
                r.url().endsWith(`/batch-items/${item.id}/draft`)
              );
              await button('처리 결과 다시 확인').click();
              assert.equal((await response).status(), denial);
              await expect(button('처리 결과 다시 확인')).toBeEnabled();
              await expect(page.getByLabel('초안 제목', { exact: true })).toBeDisabled();
              await expect(page.getByLabel('초안 제목', { exact: true })).toHaveValue(item.title);
              await expect(page.getByLabel('출처', { exact: true })).toBeDisabled();
              await expect(page.locator('.batch-list button').first()).toBeDisabled();
            }
            await page
              .getByRole('navigation', { name: '관리 메뉴' })
              .getByRole('link', { name: '게시글 관리', exact: true })
              .click();
            await expect(page).toHaveURL(f.origin + '/admin/batch');
            stage = 'recovered';
            await authenticate();
            await button('처리 결과 다시 확인').click();
            await expect(feedback).toContainText('초안');
            await expect(button('처리 결과 다시 확인')).toHaveCount(0);
            assert.equal(keys.length, 4);
            assert.ok(keys[0]);
            assert.equal(new Set(keys).size, 1);
            assert.equal(new Set(bodies).size, 1);
            const row = firstRow(
              await f.pool.query('SELECT id,status FROM content.board_post WHERE title=$1', [
                item.title,
              ])
            );
            assert.equal(row.status, 'DRAFT');
            assert.equal(
              (await f.pool.query('SELECT id FROM content.board_post WHERE title=$1', [item.title]))
                .rowCount,
              1
            );
            assert.equal(
              (
                await f.pool.query(
                  'SELECT id FROM content.board_post_status_history WHERE post_id=$1',
                  [row.id]
                )
              ).rowCount,
              1
            );
            await page.unroute(path);
          }
        );
      }
    await t.test(
      'lost review response repeats one transition and filtering moves off an emptied final page',
      async () => {
        const item = await seed('검수 시작 응답 복구');
        await open(item.title);
        const keys: string[] = [],
          bodies: string[] = [];
        let first = true;
        const path = `**/batch-items/${item.id}/review`;
        await page.route(path, async (route) => {
          keys.push(route.request().headers()['idempotency-key'] || '');
          bodies.push(route.request().postData() || '');
          if (first) {
            first = false;
            assert.equal((await route.fetch()).status(), 200);
            return route.abort('connectionreset');
          }
          return route.continue();
        });
        await button('검수 시작 / 다시 검수').click();
        await expect(button('처리 결과 다시 확인')).toBeEnabled();
        await button('처리 결과 다시 확인').click();
        await expect(feedback).toHaveText('검수 상태를 저장했습니다.');
        assert.equal(keys.length, 2);
        assert.equal(new Set(keys).size, 1);
        assert.equal(new Set(bodies).size, 1);
        assert.equal(
          String(
            firstRow(
              await f.pool.query('SELECT lock_version FROM collect.batch_review WHERE item_id=$1', [
                item.id,
              ])
            ).lock_version
          ),
          '1'
        );
        await page.unroute(path);
        for (let i = 0; i < 21; i++) await seed(`페이지 경계 검수 ${i + 1}`);
        await page.getByLabel('수집 상태', { exact: true }).selectOption('FETCHED');
        await page.getByLabel('검수 상태', { exact: true }).selectOption('UNREVIEWED');
        await button('조회').click();
        await expect(page.getByRole('navigation', { name: '수집 결과 페이지' })).toContainText(
          '1 / 2'
        );
        await button('다음').click();
        await expect(page.locator('.batch-list li')).toHaveCount(1);
        await page.locator('.batch-list button').click();
        await expect(button('검수 시작 / 다시 검수')).toBeEnabled();
        await button('검수 시작 / 다시 검수').click();
        await expect(feedback).toHaveText('검수 상태를 저장했습니다.');
        await expect(page.getByRole('navigation', { name: '수집 결과 페이지' })).toContainText(
          '1 / 1'
        );
        await expect(page.locator('.batch-list li')).toHaveCount(20);
      }
    );
    await t.test(
      'combined filters paginate failures, preserve current page on failure and show empty results',
      async () => {
        for (let i = 0; i < 21; i++) await seed(`수집 실패 ${i + 1}`, false, 'FAILED');
        await page.goto(f.origin + '/admin/batch');
        await page.getByLabel('출처', { exact: true }).fill('fixture');
        await page.getByLabel('수집 상태', { exact: true }).selectOption('FAILED');
        await page.getByLabel('검수 상태', { exact: true }).selectOption('UNREVIEWED');
        await button('조회').click();
        await expect(page.locator('.batch-list li')).toHaveCount(20);
        const pagination = page.getByRole('navigation', { name: '수집 결과 페이지' });
        await expect(pagination).toContainText('1 / 2');
        await page.getByLabel('수집 상태', { exact: true }).selectOption('FETCHED');
        // Pagination keeps the applied filter even while the form has an unsubmitted value.
        await button('다음').click();
        await expect(page.locator('.batch-list li')).toHaveCount(1);
        await expect(pagination).toContainText('2 / 2');
        await page.locator('.batch-list button').click();
        await expect(detail).toContainText('SOURCE_GONE');
        for (const name of ['검수 시작 / 다시 검수', '승인', '반려', '게시글 초안 만들기'])
          await expect(button(name)).toBeDisabled();
        await page.route(/\/api\/v1\/admin\/collect\/batch-items\?/, (route) =>
          route.abort('connectionreset')
        );
        await button('이전').click();
        await expect(page.getByRole('alert')).toContainText('현재 목록을 유지');
        await expect(pagination).toContainText('2 / 2');
        await page.unroute(/\/api\/v1\/admin\/collect\/batch-items\?/);
        await button('목록 다시 조회').click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await page.getByLabel('출처', { exact: true }).fill('missing');
        await button('조회').click();
        await expect(page.getByText('조건에 맞는 수집 결과가 없습니다.')).toBeVisible();
        await expect(pagination).toContainText('1 / 1');
        const features = object(
          await (await context.request.get(f.origin + '/api/admin/features')).json()
        );
        assert.equal(features.batchReview, true);
      }
    );
    assert.equal((await f.storage.inventory('public')).length, 0);
    assert.equal(
      Number(
        firstRow(
          await f.pool.query("SELECT count(*) FROM content.board_post WHERE status<>'DRAFT'")
        ).count
      ),
      0
    );
  }
);
