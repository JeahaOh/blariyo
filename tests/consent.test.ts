import test from 'node:test';
import assert from 'node:assert/strict';
import { readConsent, saveConsent, analyticsRuntime } from '../apps/web/app/utils/consent.mjs';
import { description } from '../apps/web/app/utils/metadata.mjs';
import {
  events as recordedEvents,
  fire,
  type AnalyticsWindow,
  type AnalyticsScript,
} from './helpers/analytics.ts';
import { object } from './helpers/browser-values.ts';
await test('consent expiration, corrupted state, withdrawal, no external adapter before grant', () => {
  const map = new Map<string, string>(),
    storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    };
  assert.equal(readConsent(storage, true), null);
  map.set(
    'blariyo_consent',
    JSON.stringify({
      version: 2,
      scope: 'analytics',
      analytics: true,
      ads: false,
      savedAt: new Date().toISOString(),
    })
  );
  assert.equal(readConsent(storage, true), null);
  saveConsent(storage, true, true, new Date('2025-09-07T00:00:00Z'));
  const saved: unknown = JSON.parse(map.get('blariyo_consent') || '{}');
  assert.ok(saved && typeof saved === 'object' && 'version' in saved && 'scope' in saved);
  assert.equal(saved.version, 3);
  assert.equal(saved.scope, 'analytics_v1');
  assert.equal(readConsent(storage, true, new Date('2026-09-07T00:00:00Z')), null);
  map.set('blariyo_consent', 'broken');
  assert.equal(readConsent(storage, true), null);
  const gtmStart = { 'gtm.start': Date.now(), event: 'gtm.js' };
  const dataLayer: NonNullable<AnalyticsWindow['dataLayer']> = [gtmStart];
  const push = dataLayer.push;
  const scripts: AnalyticsScript[] = [],
    win: AnalyticsWindow = { dataLayer },
    doc = {
      cookie: '',
      location: { hostname: 'localhost' },
      head: { appendChild: (s: AnalyticsScript) => scripts.push(s) },
      createElement: () => ({ remove() {} }),
      getElementById: () => null,
    };
  let path = '/meme';
  const runtime = analyticsRuntime({
    window: win,
    document: doc,
    storage,
    enabled: true,
    measurementId: 'G-TEST',
    origin: 'http://localhost',
    getPath: () => path,
  });
  runtime.sync();
  runtime.send('page_view');
  assert.equal(scripts.length, 0);
  assert.equal(win.dataLayer, dataLayer, 'GA4 must preserve the GTM queue before consent');
  assert.deepEqual(dataLayer, [gtmStart]);
  saveConsent(storage, false, true);
  runtime.sync();
  assert.equal(scripts.length, 0);
  saveConsent(storage, true, true);
  runtime.sync();
  assert.equal(scripts.length, 1);
  fire(scripts, 0);
  runtime.send('share', { share_method: 'copy', board_slug: 'meme', postId: 123, title: 'secret' });
  const events = recordedEvents(win);
  assert.ok(!JSON.stringify(events).includes('secret'));
  assert.ok(!JSON.stringify(events).includes('postId'));
  saveConsent(storage, false, true);
  runtime.sync();
  assert.equal(win['ga-disable-G-TEST'], true);
  assert.equal(recordedEvents(win).length, 0);
  assert.equal(win.dataLayer, dataLayer, 'withdrawal must preserve the shared GTM queue');
  assert.equal(dataLayer.push, push);
  assert.deepEqual(dataLayer, [gtmStart]);
  runtime.send('page_view');
  assert.equal(recordedEvents(win).length, 0);
  saveConsent(storage, true, true);
  runtime.setStorageFailed(true);
  runtime.send('page_view');
  assert.equal(recordedEvents(win).length, 0);
  path = '/admin';
  saveConsent(storage, true, true);
  runtime.sync();
  assert.equal(scripts.length, 1);
  const disabled = analyticsRuntime({
    window: win,
    document: doc,
    storage,
    enabled: false,
    measurementId: 'G-TEST',
    origin: 'http://localhost',
    getPath: () => '/meme',
  });
  disabled.sync();
  assert.equal(scripts.length, 1);
});
await test('SSR summary preserves graphemes, normalizes whitespace and never pads', () => {
  assert.equal(description([{ type: 'TEXT', text: ' \u2003짧은\n\t본문 ' }]), '짧은 본문');
  const emoji = '👨‍👩‍👦';
  const result = description([{ type: 'TEXT', text: emoji.repeat(121) }]);
  assert.equal(result, emoji.repeat(119) + '…');
  assert.equal(description([]), '블라리요에서 블라블라블라');
});

await test('analytics-v1 keeps only declared event fields and drops invalid values', () => {
  const map = new Map<string, string>(),
    storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    },
    scripts: AnalyticsScript[] = [],
    win: AnalyticsWindow = { dataLayer: [] },
    doc = {
      cookie: '',
      location: { hostname: 'localhost' },
      head: { appendChild: (s: AnalyticsScript) => scripts.push(s) },
      createElement: () => ({ remove() {} }),
      getElementById: () => null,
    };
  const key = 'p1_' + 'a'.repeat(64);
  const runtime = analyticsRuntime({
    window: win,
    document: doc,
    storage,
    enabled: true,
    measurementId: 'G-TEST',
    origin: 'http://localhost',
    getPath: () => '/meme/posts/1',
  });
  saveConsent(storage, true, true);
  runtime.sync();
  fire(scripts, 0);
  const viewToken = runtime.captureView();
  const attemptKey = '33333333-3333-4333-8333-333333333333';
  const fallbackKey = '44444444-4444-4444-8444-444444444444';
  runtime.send('list_impression', {
    board_slug: 'meme',
    list_instance_key: '11111111-1111-4111-8111-111111111111',
    list_area: 'main',
    list_kind: 'regular',
    list_page: 1,
    list_position: 3,
    content_key: key,
    content_type: 'post',
    impression_key: '22222222-2222-4222-8222-222222222222',
    title: 'secret',
    postId: 123,
  });
  runtime.send('scroll', { page_content_key: key, depth_percent: 75, scroll_depth_bucket: '75' });
  runtime.send('select_content', {
    board_slug: 'meme',
    list_instance_key: '11111111-1111-4111-8111-111111111111',
    list_area: 'detail_footer',
    list_kind: 'regular',
    list_page: 1,
    list_position: 3,
    content_key: key,
    content_type: 'post',
    exposure_state: 'qualified',
    impression_key: '22222222-2222-4222-8222-222222222222',
    open_mode: 'new_context',
  });
  runtime.send('list_page_change', {
    list_area: 'detail_footer',
    from_list_page: 1,
    to_list_page: 2,
    list_instance_key: '11111111-1111-4111-8111-111111111111',
  });
  runtime.send('share', {
    page_content_key: key,
    board_slug: 'meme',
    share_method: 'native',
    share_attempt_key: attemptKey,
  });
  runtime.send('share_result', {
    page_content_key: key,
    board_slug: 'meme',
    share_method: 'native',
    share_outcome: 'unavailable',
    share_attempt_key: attemptKey,
  });
  runtime.send('share', {
    page_content_key: key,
    board_slug: 'meme',
    share_method: 'copy',
    share_attempt_key: fallbackKey,
    parent_attempt_key: attemptKey,
  });
  runtime.send('share_result', {
    page_content_key: key,
    board_slug: 'meme',
    share_method: 'copy',
    share_outcome: 'copied',
    share_attempt_key: fallbackKey,
    parent_attempt_key: attemptKey,
  });
  const sent = recordedEvents(win).filter((args) => args[0] === 'event');
  assert.deepEqual(
    sent.map((args) => args[1]),
    [
      'list_impression',
      'scroll',
      'select_content',
      'list_page_change',
      'share',
      'share_result',
      'share',
      'share_result',
    ]
  );
  for (const args of sent) {
    const params = object(args[2]);
    assert.equal(params.schema_version, 1);
    assert.match(String(params.event_key), /^[a-f0-9-]{36}$/);
    assert.ok(!('title' in params));
    assert.ok(!('postId' in params));
    assert.ok(!('scroll_depth_bucket' in params));
    assert.ok(Object.keys(params).length <= 25);
  }
  const qualifiedClick = sent.find((args) => args[1] === 'select_content');
  assert.ok(qualifiedClick);
  assert.equal(object(qualifiedClick[2]).exposure_state, 'qualified');
  assert.equal(object(qualifiedClick[2]).open_mode, 'new_context');
  assert.equal(object(qualifiedClick[2]).impression_key, '22222222-2222-4222-8222-222222222222');
  const fallbackResult = sent.filter((args) => args[1] === 'share_result')[1];
  assert.ok(fallbackResult);
  assert.equal(object(fallbackResult[2]).share_attempt_key, fallbackKey);
  assert.equal(object(fallbackResult[2]).parent_attempt_key, attemptKey);
  runtime.send('share', {
    page_content_key: key,
    board_slug: 'meme',
    share_method: 'copy',
    share_attempt_key: 'not-a-uuid',
  });
  runtime.send('share_result', {
    page_content_key: key,
    board_slug: 'meme',
    share_method: 'native',
    share_outcome: 'copied',
    share_attempt_key: attemptKey,
  });
  assert.equal(recordedEvents(win).filter((args) => args[0] === 'event').length, sent.length);
  saveConsent(storage, false, true);
  runtime.sync();
  assert.equal(
    viewToken?.isCurrent(),
    false,
    'withdrawal invalidates captured async share results'
  );
});

await test('late analytics load and error callbacks cannot cancel a newer consent generation', () => {
  for (const callback of ['onload', 'onerror'] as const) {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    };
    const scripts: AnalyticsScript[] = [],
      win: AnalyticsWindow = { dataLayer: [] };
    const runtime = analyticsRuntime({
      window: win,
      document: {
        cookie: '',
        location: { hostname: 'localhost' },
        head: { appendChild: (s: AnalyticsScript) => scripts.push(s) },
        createElement: () => ({ remove() {} }),
        getElementById: () => null,
      },
      storage,
      enabled: true,
      measurementId: 'G-TEST',
      origin: 'http://localhost',
      getPath: () => '/meme',
    });
    saveConsent(storage, true, true);
    runtime.sync();
    saveConsent(storage, false, true);
    runtime.sync();
    saveConsent(storage, true, true);
    runtime.sync();
    runtime.pageView('/meme');
    assert.equal(scripts.length, 2);
    fire(scripts, 0, callback);
    fire(scripts, 1);
    assert.equal(win['ga-disable-G-TEST'], false);
    const events = recordedEvents(win);
    assert.equal(events.filter((args) => args[0] === 'event' && args[1] === 'page_view').length, 1);
    saveConsent(storage, false, true);
    runtime.sync();
    fire(scripts, 1);
    assert.equal(win['ga-disable-G-TEST'], true);
    assert.equal(recordedEvents(win).length, 0);
  }
});

await test('analytics sends one page view per navigation and keeps a later route revisit', () => {
  const map = new Map<string, string>(),
    storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    },
    scripts: AnalyticsScript[] = [],
    win: AnalyticsWindow = { dataLayer: [] },
    doc = {
      cookie: '',
      location: { hostname: 'localhost' },
      head: { appendChild: (s: AnalyticsScript) => scripts.push(s) },
      createElement: () => ({ remove() {} }),
      getElementById: () => null,
    };
  let path = '/meme';
  const runtime = analyticsRuntime({
    window: win,
    document: doc,
    storage,
    enabled: true,
    measurementId: 'G-TEST',
    origin: 'http://localhost',
    getPath: () => path,
  });
  saveConsent(storage, true, true);
  runtime.sync();
  runtime.pageView('/meme');
  fire(scripts, 0);
  runtime.pageView('/meme');
  path = '/meme/posts/1';
  runtime.pageView('/meme/posts/1');
  path = '/meme';
  runtime.pageView('/meme');
  const pageViews = recordedEvents(win).filter(
    (args) => args[0] === 'event' && args[1] === 'page_view'
  );
  assert.equal(pageViews.length, 3);
  assert.deepEqual(
    pageViews.map((args) => object(args[2]).page_location),
    [
      'http://localhost/analytics/list',
      'http://localhost/analytics/detail',
      'http://localhost/analytics/list',
    ]
  );
});

await test('analytics waits for a delayed script with only the latest route page view', () => {
  const map = new Map<string, string>(),
    storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    },
    scripts: AnalyticsScript[] = [],
    win: AnalyticsWindow = { dataLayer: [] },
    doc = {
      cookie: '',
      location: { hostname: 'localhost' },
      head: { appendChild: (s: AnalyticsScript) => scripts.push(s) },
      createElement: () => ({ remove() {} }),
      getElementById: () => null,
    };
  let path = '/meme';
  const runtime = analyticsRuntime({
    window: win,
    document: doc,
    storage,
    enabled: true,
    measurementId: 'G-TEST',
    origin: 'http://localhost',
    getPath: () => path,
  });
  saveConsent(storage, true, true);
  runtime.sync();
  runtime.pageView('/meme');
  path = '/meme/posts/1';
  runtime.pageView('/meme/posts/1');
  fire(scripts, 0);
  const pageViews = recordedEvents(win).filter(
    (args) => args[0] === 'event' && args[1] === 'page_view'
  );
  assert.equal(pageViews.length, 1);
  assert.equal(object(pageViews[0]?.[2]).page_location, 'http://localhost/analytics/detail');
});
