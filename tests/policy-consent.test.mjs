import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../apps/api/src/db.mjs';
import { migrate } from '../apps/api/src/migrate.mjs';
import { publishPolicy, artifactChecksum, assertLegalConfig } from '../apps/api/src/policies.mjs';
import { publicService } from '../apps/api/src/public.mjs';
import { readConsent, saveConsent, analyticsRuntime } from '../apps/web/app/utils/consent.mjs';
import { description } from '../apps/web/app/utils/metadata.mjs';
import { localStorage } from '../apps/api/src/storage.mjs';
const database = process.env.TEST_POLICY_DATABASE_URL;
test(
  'policy artifact verification, atomic release, history and rollback',
  { skip: !database },
  async (t) => {
    const pool = createPool(database);
    t.after(() => pool.end());
    await migrate(pool);
    const now = new Date();
    const artifact = (version, offset, body = '<p>로컬 검증 정책</p>') => {
      const a = {
        type: 'terms',
        version,
        title: '테스트 이용약관',
        body,
        effectiveAt: new Date(+now + offset).toISOString(),
      };
      return { ...a, checksum: artifactChecksum(a) };
    };
    await assert.rejects(publishPolicy(pool, artifact('future', 1000), { now }), /WINDOW/);
    await assert.rejects(publishPolicy(pool, artifact('old', -300001), { now }), /WINDOW/);
    await assert.rejects(
      publishPolicy(pool, { ...artifact('bad', -1000), checksum: 'bad' }, { now }),
      /CHECKSUM/
    );
    await publishPolicy(
      pool,
      artifact(
        'v1',
        -2000,
        '<p>허용<script>alert(1)</script><a href="javascript:alert(1)">링크</a></p>'
      ),
      { now }
    );
    const service = publicService(pool);
    assert.ok(!(await service.policy('terms')).policy.bodyHtml.includes('script'));
    await publishPolicy(pool, artifact('v2', -1000), { now });
    const result = await service.policy('terms');
    assert.equal(result.policy.version, 'v2');
    assert.equal(result.history[1].endedAt, result.history[0].effectiveAt);
    const count = Number((await pool.query('SELECT count(*) FROM ops.outbox_task')).rows[0].count);
    assert.equal(count, 2);
    await assert.rejects(publishPolicy(pool, artifact('v3', -2500), { now }), /ORDER/);
    assert.equal((await service.policy('terms')).policy.version, 'v2');
    const brokenDb = {
      connect: async () => {
        const client = await pool.connect();
        return {
          release: () => client.release(),
          query: (sql, params) => {
            if (sql.includes('INSERT INTO ops.outbox_task'))
              throw new Error('fixture outbox failure');
            return client.query(sql, params);
          },
        };
      },
    };
    await assert.rejects(publishPolicy(brokenDb, artifact('rollback', -500), { now }));
    assert.equal((await service.policy('terms')).policy.version, 'v2');
    await publishPolicy(pool, artifact('v2', -1000), { now });
    assert.equal(
      Number((await pool.query('SELECT count(*) FROM ops.outbox_task')).rows[0].count),
      2
    );
    assert.equal((await service.policy('terms', 'v1')).policy.version, 'v1');
    assert.throws(() => assertLegalConfig({}), /LEGAL_CONFIG_REQUIRED/);
    assert.throws(() => localStorage('/private/tmp/example', { production: true }), /forbidden/);
  }
);
test('consent expiration, corrupted state, withdrawal, no external adapter before grant', () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  assert.equal(readConsent(storage, true), null);
  saveConsent(storage, true, true, new Date('2025-09-07T00:00:00Z'));
  assert.equal(readConsent(storage, true, new Date('2026-09-07T00:00:00Z')), null);
  map.set('blariyo_consent', 'broken');
  assert.equal(readConsent(storage, true), null);
  const scripts = [],
    win = {},
    doc = {
      cookie: '',
      location: { hostname: 'localhost' },
      head: { appendChild: (s) => scripts.push(s) },
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
  saveConsent(storage, false, true);
  runtime.sync();
  assert.equal(scripts.length, 0);
  saveConsent(storage, true, true);
  runtime.sync();
  assert.equal(scripts.length, 1);
  scripts[0].onload();
  runtime.send('share', { share_method: 'copy', board_slug: 'meme', postId: 123, title: 'secret' });
  const events = win.dataLayer.map((a) => Array.from(a));
  assert.ok(!JSON.stringify(events).includes('secret'));
  assert.ok(!JSON.stringify(events).includes('postId'));
  saveConsent(storage, false, true);
  runtime.sync();
  assert.equal(win['ga-disable-G-TEST'], true);
  assert.equal(win.dataLayer.length, 0);
  runtime.send('page_view');
  assert.equal(win.dataLayer.length, 0);
  saveConsent(storage, true, true);
  runtime.setStorageFailed(true);
  runtime.send('page_view');
  assert.equal(win.dataLayer.length, 0);
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
test('SSR summary preserves graphemes, normalizes whitespace and never pads', () => {
  assert.equal(description([{ type: 'TEXT', text: ' \u2003짧은\n\t본문 ' }]), '짧은 본문');
  const emoji = '👨‍👩‍👦';
  const result = description([{ type: 'TEXT', text: emoji.repeat(121) }]);
  assert.equal(result, emoji.repeat(119) + '…');
  assert.equal(description([]), '블라리요에서 블라블라블라');
});

test('late analytics load and error callbacks cannot cancel a newer consent generation', () => {
  for (const callback of ['onload', 'onerror']) {
    const map = new Map();
    const storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
    const scripts = [],
      win = {};
    const runtime = analyticsRuntime({
      window: win,
      document: {
        cookie: '',
        location: { hostname: 'localhost' },
        head: { appendChild: (s) => scripts.push(s) },
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
    scripts[0][callback]();
    scripts[1].onload();
    assert.equal(win['ga-disable-G-TEST'], false);
    const events = win.dataLayer.map((args) => Array.from(args));
    assert.equal(events.filter((args) => args[0] === 'event' && args[1] === 'page_view').length, 1);
    saveConsent(storage, false, true);
    runtime.sync();
    scripts[1].onload();
    assert.equal(win['ga-disable-G-TEST'], true);
    assert.equal(win.dataLayer.length, 0);
  }
});

test('analytics sends one page view per navigation and keeps a later route revisit', () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    scripts = [],
    win = {},
    doc = {
      cookie: '',
      location: { hostname: 'localhost' },
      head: { appendChild: (s) => scripts.push(s) },
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
  scripts[0].onload();
  runtime.pageView('/meme');
  path = '/meme/posts/1';
  runtime.pageView('/meme/posts/1');
  path = '/meme';
  runtime.pageView('/meme');
  const pageViews = win.dataLayer
    .map((args) => Array.from(args))
    .filter((args) => args[0] === 'event' && args[1] === 'page_view');
  assert.equal(pageViews.length, 3);
  assert.deepEqual(
    pageViews.map((args) => args[2].page_location),
    ['http://localhost/analytics/list', 'http://localhost/analytics/detail', 'http://localhost/analytics/list']
  );
});

test('analytics waits for a delayed script with only the latest route page view', () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    scripts = [],
    win = {},
    doc = {
      cookie: '',
      location: { hostname: 'localhost' },
      head: { appendChild: (s) => scripts.push(s) },
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
  scripts[0].onload();
  const pageViews = win.dataLayer
    .map((args) => Array.from(args))
    .filter((args) => args[0] === 'event' && args[1] === 'page_view');
  assert.equal(pageViews.length, 1);
  assert.equal(pageViews[0][2].page_location, 'http://localhost/analytics/detail');
});
