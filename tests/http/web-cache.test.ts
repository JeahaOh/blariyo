import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

await test(
  'built Web preserves assets and never caches JSON/HTML errors',
  { timeout: 30000 },
  async (t) => {
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    assert.ok(address && typeof address !== 'string');
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    const origin = `http://127.0.0.1:${address.port}`;
    const child = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: String(address.port),
        NUXT_CORE_ORIGIN: 'http://127.0.0.1:1',
        NUXT_ADMIN_AUTH_MODE: 'access',
        NUXT_PUBLIC_SITE_ORIGIN: origin,
      },
      stdio: 'ignore',
    });
    const exited = once(child, 'exit');
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
        try {
          await exited;
        } finally {
          clearTimeout(timer);
        }
      }
    });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      assert.equal(child.exitCode, null, 'Web exited before ready');
      try {
        const response = await fetch(origin + '/health/live', { signal: AbortSignal.timeout(500) });
        await response.arrayBuffer();
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.ok(ready, 'Web did not start');

    await t.test(
      '404 format negotiation and query variants preserve status and disable caching',
      async () => {
        for (const path of [
          '/_nuxt/cache-test-missing.js',
          '/_nuxt/cache-test-missing.css',
          '/missing-cache-test/route/unmatched',
        ]) {
          for (const accept of ['application/json', 'text/html']) {
            for (const query of ['', '?test=cache']) {
              const response = await fetch(origin + path + query, { headers: { Accept: accept } });
              assert.equal(response.status, 404, `${path} ${accept}`);
              assert.equal(response.headers.get('cache-control'), 'no-store', `${path} ${accept}`);
              assert.ok(response.headers.get('content-type')?.startsWith(accept));
              if (accept === 'application/json') {
                const body: unknown = await response.json();
                assert.ok(body && typeof body === 'object' && 'statusCode' in body);
                assert.equal(body.statusCode, 404);
                assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
              } else {
                assert.match(await response.text(), /페이지를 찾을 수 없습니다/);
              }
            }
          }
        }
      }
    );
    await t.test(
      'GET, HEAD and query variants retain real JS/CSS bytes and immutable policy',
      async () => {
        const directory = 'apps/web/.output/public/_nuxt';
        const assets = (await readdir(directory)).filter((name) => /\.(js|css)$/.test(name));
        assert.ok(
          assets.some((name) => name.endsWith('.js')) &&
            assets.some((name) => name.endsWith('.css'))
        );
        for (const name of assets) {
          const expected = createHash('sha256')
            .update(await readFile(`${directory}/${name}`))
            .digest('hex');
          for (const [method, suffix] of [
            ['GET', ''],
            ['GET', '?test=cache'],
            ['HEAD', ''],
          ] as const) {
            const response = await fetch(`${origin}/_nuxt/${name}${suffix}`, { method });
            assert.equal(response.status, 200);
            assert.equal(
              response.headers.get('cache-control'),
              'public, max-age=31536000, immutable'
            );
            const body = Buffer.from(await response.arrayBuffer());
            if (method === 'HEAD') assert.equal(body.length, 0);
            else assert.equal(createHash('sha256').update(body).digest('hex'), expected, name);
          }
        }
      }
    );
    await t.test(
      'health, authentication failure and unavailable Core preserve response contracts',
      async () => {
        for (const [path, status] of [
          ['/health/live', 200],
          ['/api/v1/admin/posts', 401],
          ['/api/v1/boards/meme/posts', 503],
        ] as const) {
          const response = await fetch(origin + path, { headers: { Accept: 'application/json' } });
          assert.equal(response.status, status, path);
          assert.match(response.headers.get('cache-control') || '', /no-store/);
          assert.ok(response.headers.get('content-type')?.includes('application/json'));
          await response.arrayBuffer();
        }
      }
    );
  }
);
