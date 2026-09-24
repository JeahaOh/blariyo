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
  saveConsent(storage, true, true, new Date('2025-09-07T00:00:00Z'));
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
