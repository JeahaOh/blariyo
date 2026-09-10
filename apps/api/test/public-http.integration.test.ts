import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow, decimalId } from '../dist/persistence/rows.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { contractJson } from './contract-response.js';

const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
assert.ok(databaseUrl);
await test('original PostgreSQL public API boundaries with canonical response narrowing', async (t) => {
  const migration = await migrationContext(databaseUrl);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const pool = await createDataSource(databaseUrl).initialize();
  t.after(() => pool.destroy());
  const app = await createNestApplication({ databaseUrl });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const get = (path: string, options?: RequestInit) => fetch(origin + path, options);
  await t.test('empty page one, excess page, invalid page and invalid board', async () => {
    const empty = await get('/api/v1/boards/meme/posts');
    assert.equal(empty.status, 200);
    await empty.body?.cancel();
    const excess = await contractJson('listPosts', await get('/api/v1/boards/meme/posts?page=2'));
    assert.equal(excess.success, false);
    assert.equal(excess.error.code, 'PAGE_NOT_FOUND');
    const invalid = await get('/api/v1/boards/meme/posts?page=1.2');
    assert.equal(invalid.status, 400);
    await invalid.body?.cancel();
    const board = await contractJson('listPosts', await get('/api/v1/boards/INVALID/posts'));
    assert.equal(board.success, false);
    assert.equal(board.error.code, 'BOARD_NOT_FOUND');
  });
  await pool.query(`INSERT INTO content.board_post(board_id,title,status,published_at,created_by,created_at,updated_by,updated_at)
 SELECT (SELECT id FROM content.board WHERE slug='meme'),'공개 '||n,'PUBLISHED',now()-n*interval '1 second','system:migration',now(),'system:migration',now() FROM generate_series(1,21)n`);
  await pool.query(`INSERT INTO content.board_post_block(post_id,position,type,text_content,created_by,created_at,updated_by,updated_at)
 SELECT id,1,'TEXT','<script>plain text</script>','system:migration',now(),'system:migration',now() FROM content.board_post`);
  const post = requiredRow(
    await pool.query('SELECT * FROM content.board_post ORDER BY published_at DESC LIMIT 1')
  );
  const id = decimalId(post.id);
  await t.test(
    'pagination, detail context, schema response and concurrent view increments',
    async () => {
      const firstResponse = await get('/api/v1/boards/meme/posts');
      assert.equal(firstResponse.status, 200);
      const first = await contractJson('listPosts', firstResponse);
      assert.equal(first.success, true);
      assert.equal(first.data.items.length, 20);
      assert.equal(first.meta.totalPages, 2);
      const second = await contractJson('listPosts', await get('/api/v1/boards/meme/posts?page=2'));
      assert.equal(second.success, true);
      assert.equal(second.data.items.length, 1);
      const detailResponse = await get(`/api/v1/boards/meme/posts/${id}`);
      assert.equal(detailResponse.status, 200);
      const detail = await contractJson('getPost', detailResponse);
      assert.equal(detail.success, true);
      const context = detail.data.context.items[0];
      assert.ok(context);
      assert.equal(context.current, true);
      const block = detail.data.post.blocks[0];
      assert.ok(block);
      assert.equal(block.type, 'TEXT');
      assert.equal(block.text, '<script>plain text</script>');
      assert.ok(!('status' in detail.data.post));
      const endpoint = `/api/v1/boards/meme/posts/${id}/views`;
      const invalid = await get(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(invalid.status, 400);
      await invalid.body?.cancel();
      const results = await Promise.all(
        Array.from({ length: 12 }, () => get(endpoint, { method: 'POST' }))
      );
      assert.ok(results.every((response) => response.status === 204));
      for (const response of results) assert.equal(await response.text(), '');
      const row = requiredRow(
        await pool.query('SELECT * FROM content.board_post WHERE id=$1', [id])
      );
      assert.equal(Number(row.view_count), 12);
      assert.equal(row.lock_version, post.lock_version);
      assert.ok(row.updated_at instanceof Date);
      assert.ok(post.updated_at instanceof Date);
      assert.equal(row.updated_at.getTime(), post.updated_at.getTime());
    }
  );
  await t.test('hidden and missing posts have identical errors', async () => {
    await pool.query("UPDATE content.board_post SET status='HIDDEN_REVIEW' WHERE id=$1", [id]);
    for (const suffix of [id, '9999999', 'abc', '0']) {
      const body = await contractJson('getPost', await get(`/api/v1/boards/meme/posts/${suffix}`));
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'POST_NOT_FOUND');
    }
    const body = await contractJson('getPost', await get(`/api/v1/boards/no-board/posts/${id}`));
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'POST_NOT_FOUND');
  });
});
