import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource, DatabaseContext } from '../dist/persistence/database.js';
import { TypeOrmSitemapRepository } from '../dist/persistence/sitemap.repository.js';
import { createNestApplication } from '../dist/bootstrap/application.js';

const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
assert.ok(databaseUrl);
await test(
  'PostgreSQL to built Web sitemaps exclude nonpublic data and preserve HTTP/noindex boundaries',
  { timeout: 60000 },
  async (t) => {
    const migration = await migrationContext(databaseUrl);
    try {
      await migration.get(MigrationsService).migrate();
    } finally {
      await migration.close();
    }
    const db = await createDataSource(databaseUrl).initialize();
    t.after(() => db.destroy());
    // 10001 visible rows cross the exact shard boundary. No bodies/images are required.
    await db.query(`INSERT INTO content.board_post(id,board_id,title,status,published_at,created_by,created_at,updated_by,updated_at)
    SELECT n,(SELECT id FROM content.board WHERE slug='meme'),'visible '||n,'PUBLISHED','2026-01-01','system:migration','2026-01-01','system:migration','2026-01-02'
    FROM generate_series(1,10001)n`);
    await db.query(`UPDATE content.board_post SET pinned_position=1 WHERE id=1`);
    await db.query(`INSERT INTO content.board(slug,display_name,posting_policy,is_active,display_order,created_by,created_at,updated_by,updated_at)
    VALUES('inactive','inactive','ADMIN',false,100,'system:migration',now(),'system:migration',now())`);
    await db.query(`INSERT INTO content.board_post(id,board_id,title,status,published_at,scheduled_at,created_by,created_at,updated_by,updated_at)
    SELECT 20000+n,(SELECT id FROM content.board WHERE slug='meme'),'excluded',state,
      CASE WHEN state IN ('DRAFT','SCHEDULED') THEN NULL WHEN n=5 THEN now()+interval '1 day' ELSE now() END,
      CASE WHEN state='SCHEDULED' THEN now()+interval '1 day' ELSE NULL END,
      'system:migration',now(),'system:migration',now()
    FROM (VALUES(1,'DRAFT'),(2,'SCHEDULED'),(3,'HIDDEN_REVIEW'),(4,'REMOVED'),(5,'PUBLISHED')) AS fixture(n,state)`);
    await db.query(`INSERT INTO content.board_post(id,board_id,title,status,published_at,created_by,created_at,updated_by,updated_at)
    VALUES(30001,(SELECT id FROM content.board WHERE slug='inactive'),'excluded','PUBLISHED',now(),'system:migration',now(),'system:migration',now())`);
    const repository = new TypeOrmSitemapRepository(new DatabaseContext(db));
    assert.deepEqual(await repository.shards(), ['0', '1']);
    assert.deepEqual(await repository.pages(), ['/meme']);
    assert.equal((await repository.posts('1', '10000')).length, 10000);
    assert.equal((await repository.posts('10001', '20000')).length, 1);
    assert.deepEqual(await repository.posts('20001', '40000'), []);
    const app = await createNestApplication({ databaseUrl, siteOrigin: 'https://blariyo.com' });
    t.after(() => app.close());
    await app.listen(0, '127.0.0.1');
    const coreOrigin = await app.getUrl();
    const reservation = createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    assert.ok(address && typeof address !== 'string');
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    const webOrigin = `http://127.0.0.1:${address.port}`;
    const child = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: String(address.port),
        NUXT_CORE_ORIGIN: coreOrigin,
        NUXT_ADMIN_AUTH_MODE: 'access',
        NUXT_PUBLIC_SITE_ORIGIN: 'https://blariyo.com',
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
      assert.equal(child.exitCode, null);
      try {
        const response = await fetch(webOrigin + '/health/live', {
          signal: AbortSignal.timeout(500),
        });
        await response.body?.cancel();
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.ok(ready);
    const index = await fetch(webOrigin + '/sitemap.xml');
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type') ?? '', /^application\/xml/);
    assert.equal(index.headers.get('cache-control'), 'no-store');
    assert.equal(index.headers.get('x-robots-tag'), null);
    const indexXml = await index.text();
    assert.equal([...indexXml.matchAll(/<sitemap>/g)].length, 3);
    assert.doesNotMatch(indexXml, /sitemap-posts-[23].xml/);
    const urls: string[] = [];
    for (const name of ['pages', 'posts-0', 'posts-1']) {
      const response = await fetch(`${webOrigin}/sitemap-${name}.xml`);
      assert.equal(response.status, 200);
      const xml = await response.text();
      urls.push(...[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1] ?? ''));
      if (name === 'posts-0') assert.equal([...xml.matchAll(/<url>/g)].length, 10000);
    }
    assert.equal(urls.length, 10002);
    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.includes('https://blariyo.com/meme/posts/1'));
    assert.ok(urls.includes('https://blariyo.com/meme/posts/10001'));
    assert.ok(urls.every((url) => url.startsWith('https://blariyo.com/meme')));
    for (const path of ['/sitemap.xml', '/sitemap-pages.xml', '/sitemap-posts-0.xml']) {
      const head = await fetch(webOrigin + path, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
    }
    for (const path of [
      '/sitemap-posts-2.xml',
      '/sitemap-posts-00.xml',
      '/sitemap-posts-999999999999999.xml',
    ]) {
      const missing = await fetch(webOrigin + path);
      assert.equal(missing.status, 404);
      await missing.body?.cancel();
    }
    const post = await fetch(webOrigin + '/sitemap.xml', { method: 'POST' });
    assert.equal(post.status, 405);
    await post.body?.cancel();
    for (const path of [
      '/admin',
      '/admin/collect',
      '/api/v1/boards',
      '/health/live',
      '/internal/test',
      '/__gateway_health',
    ]) {
      const response = await fetch(webOrigin + path);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex', path);
      await response.body?.cancel();
    }
    const robots = await fetch(webOrigin + '/robots.txt');
    assert.equal(robots.headers.get('x-robots-tag'), null);
    assert.match(await robots.text(), /Sitemap: https:\/\/blariyo.com\/sitemap.xml/);
    const publicPage = await fetch(webOrigin + '/meme');
    assert.equal(publicPage.status, 200);
    assert.equal(publicPage.headers.get('x-robots-tag'), null);
    assert.doesNotMatch(await publicPage.text(), /<meta[^>]+name="robots"[^>]+content="noindex/);
    // Read model reacts to hiding; cached XML deliberately has a bounded five-minute delay.
    await db.query("UPDATE content.board_post SET status='HIDDEN_REVIEW' WHERE id=10001");
    assert.deepEqual(await repository.shards(), ['0']);
    assert.deepEqual(await repository.posts('10001', '20000'), []);
    // A failed dependency must not turn into a successful empty sitemap.
    await app.close();
    const unavailable = await fetch(webOrigin + '/sitemap.xml');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('cache-control'), 'no-store');
    await unavailable.body?.cancel();
  }
);
