import { contractData } from '../../apps/api/test/contract-response.ts';
import { firstRow } from '../helpers/browser-values.ts';
import { launchBrowser } from '../helpers/launch-browser.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { browserFixture } from '../helpers/browser-fixture.ts';
await test(
  'Chromium operational event authorization, acknowledgement and replay',
  { timeout: 120000 },
  async (t) => {
    const f = await browserFixture(t, { collection: true, spring: true });
    const event = {
      collectorId: 'collector-aaaaaaaaaaaaaaaa',
      deliveryId: randomUUID(),
      jobRequestId: null,
      candidateId: null,
      eventCode: 'NOTIFICATION_FINAL_FAILED',
      severity: 'WARN',
      occurredAt: new Date().toISOString(),
      attemptCount: 4,
    };
    const created = await fetch(f.origin + '/api/collector/v1/operational-events', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + f.collectorToken,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(event),
    });
    assert.equal(created.status, 202);
    const eventId = contractData(
      'collectorOperationalEvent',
      '/api/collector/v1/operational-events',
      created.status,
      await created.json(),
      'POST'
    ).eventId;
    assert.equal((await fetch(f.origin + '/api/v1/admin/collect/operational-events')).status, 401);
    const browser = await launchBrowser();
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'BLARIYO_ADMIN_SESSION', value: f.adminToken, url: f.origin },
    ]);
    const errors: string[] = [];
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === f.origin ? r.continue() : r.abort()
    );
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(f.origin + '/admin/collect');
    await expect(page.getByRole('region', { name: '수집 운영 알림' })).toContainText(
      '결과 알림 전송 실패'
    );
    await mkdir('test-results/m0-browser', { recursive: true });
    await page.screenshot({
      path: 'test-results/m0-browser/collector-events-desktop.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true
    );
    await page.screenshot({
      path: 'test-results/m0-browser/collector-events-mobile.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: '확인 처리' }).click();
    await expect(page.getByRole('region', { name: '수집 운영 알림' })).toHaveCount(0);
    const before = firstRow(
      await f.pool.query(
        'SELECT acknowledged_at,delivery_status FROM collect.collector_operational_event WHERE id=$1',
        [eventId]
      )
    );
    assert.ok(before.acknowledged_at instanceof Date);
    assert.equal(before.delivery_status, 'ACKNOWLEDGED');
    const replay = await context.request.post(
      f.origin + '/api/v1/admin/collect/operational-events/' + eventId + '/acknowledge',
      { headers: { Origin: f.origin, 'Idempotency-Key': randomUUID() }, data: {} }
    );
    assert.equal(replay.status(), 200);
    assert.equal(
      contractData(
        'acknowledgeCollectorOperationalEvent',
        '/api/v1/admin/collect/operational-events/' + eventId + '/acknowledge',
        replay.status(),
        await replay.json(),
        'POST'
      ).acknowledgedAt,
      before.acknowledged_at.toISOString()
    );
    assert.deepEqual(errors, []);
  }
);
