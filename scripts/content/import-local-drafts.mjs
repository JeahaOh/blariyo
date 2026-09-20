// One-off, source-backed editorial drafts. This tool cannot target production.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';
import { migrationContext } from '../../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../../apps/api/dist/commands/migrations.service.js';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { PostsService } from '../../apps/api/dist/features/posts/posts.service.js';

if (process.argv.slice(2).join(' ') !== '--apply')
  throw new Error('Use --apply for local draft import');
const databaseUrl = 'postgresql://blariyo_local@127.0.0.1:55439/blariyo_local';
const bundle = JSON.parse(
  await readFile(new URL('./community-hot-20260920.json', import.meta.url), 'utf8')
);
assert.equal(bundle.items.length, 25);
assert.equal(new Set(bundle.items.map((item) => item.sourceUrl)).size, 25);
for (const item of bundle.items) {
  assert.match(item.sourceUrl, /^https:\/\/theqoo\.net\/hot\/\d+$/);
  assert.ok(item.summary && item.title && item.observedAt);
  assert.equal(item.rightsStatus, 'UNVERIFIED_NO_REPUBLICATION');
}
const migration = await migrationContext(databaseUrl);
try {
  await migration.get(MigrationsService).migrate();
} finally {
  await migration.close();
}
const db = await createDataSource(databaseUrl).initialize();
const lock = db.createQueryRunner();
await lock.connect();
let app;
try {
  // Serializes repeated runs without deleting or replacing existing editor work.
  await lock.query("SELECT pg_advisory_lock(hashtext('blariyo-local-hot-20260920'))");
  app = await createNestApplication({
    databaseUrl,
    serviceToken: randomBytes(32).toString('hex'),
    localMedia: true,
    siteOrigin: 'http://localhost:3000',
    imageOrigin: 'http://localhost:3000/media',
  });
  const posts = app.get(PostsService);
  let inserted = 0;
  for (const item of bundle.items) {
    const existing = await db.query('SELECT id FROM content.board_post WHERE source_url=$1', [
      item.sourceUrl,
    ]);
    if (existing.length) continue;
    await posts.command(
      {
        action: 'create',
        params: {},
        body: {
          boardSlug: 'meme',
          title: item.title.slice(0, 180),
          pinnedPosition: null,
          source: { name: item.sourceName, url: item.sourceUrl },
          blocks: [{ type: 'TEXT', text: item.summary }],
        },
      },
      'system:collector',
      item.sourceUrl.split('/').at(-1),
      'hot-20260920'
    );
    inserted++;
  }
  const rows = await db.query(
    'SELECT id::text, title, status, source_url FROM content.board_post WHERE source_url=ANY($1::text[]) ORDER BY id',
    [bundle.items.map((item) => item.sourceUrl)]
  );
  assert.equal(rows.length, 25);
  assert.ok(
    rows.every((row) => row.status === 'DRAFT'),
    'Existing draft status changed; do not overwrite'
  );
  await mkdir('.local-data/content-review', { recursive: true });
  await writeFile(
    '.local-data/content-review/import-result.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        target: 'loopback:55439/blariyo_local',
        inserted,
        retained: 25 - inserted,
        rows,
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  );
  console.log(
    `PASS local DB: inserted=${inserted}, retained=${25 - inserted}, DRAFT=25, PUBLISHED=0`
  );
} finally {
  await app?.close();
  await lock.query("SELECT pg_advisory_unlock(hashtext('blariyo-local-hot-20260920'))");
  await lock.release();
  await db.destroy();
}
