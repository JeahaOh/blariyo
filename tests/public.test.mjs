import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../apps/api/src/db.mjs';
import { migrate } from '../apps/api/src/migrate.mjs';
import { createApp } from '../apps/api/src/app.mjs';
const database = process.env.TEST_DATABASE_URL;
test('fresh PostgreSQL migration and public API boundaries', { skip: !database }, async (t) => {
  const pool = createPool(database);
  await migrate(pool);
  const server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await pool.end();
  });
  const get = async (path, options) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  };
  await t.test('empty page one, excess page, invalid page and invalid board', async () => {
    assert.equal((await get('/api/v1/boards/meme/posts')).status, 200);
    assert.equal((await get('/api/v1/boards/meme/posts?page=2')).body.error.code, 'PAGE_NOT_FOUND');
    assert.equal((await get('/api/v1/boards/meme/posts?page=1.2')).status, 400);
    assert.equal((await get('/api/v1/boards/INVALID/posts')).body.error.code, 'BOARD_NOT_FOUND');
  });
  await pool.query(`INSERT INTO content.board_post(board_id,title,status,published_at,created_by,created_at,updated_by,updated_at)
 SELECT (SELECT id FROM content.board WHERE slug='meme'),'공개 '||n,'PUBLISHED',now()-n*interval '1 second','system:migration',now(),'system:migration',now() FROM generate_series(1,21)n`);
  await pool.query(`INSERT INTO content.board_post_block(post_id,position,type,text_content,created_by,created_at,updated_by,updated_at)
 SELECT id,1,'TEXT','<script>plain text</script>','system:migration',now(),'system:migration',now() FROM content.board_post`);
  const post = (
    await pool.query('SELECT * FROM content.board_post ORDER BY published_at DESC LIMIT 1')
  ).rows[0];
  await t.test(
    'pagination, detail context, schema response and concurrent view increments',
    async () => {
      const first = await get('/api/v1/boards/meme/posts');
      assert.equal(first.status, 200);
      assert.equal(first.body.data.items.length, 20);
      assert.equal(first.body.meta.totalPages, 2);
      assert.equal((await get('/api/v1/boards/meme/posts?page=2')).body.data.items.length, 1);
      const detail = await get(`/api/v1/boards/meme/posts/${post.id}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.data.context.items[0].current, true);
      assert.equal(detail.body.data.post.blocks[0].text, '<script>plain text</script>');
      assert.ok(!('status' in detail.body.data.post));
      const endpoint = `/api/v1/boards/meme/posts/${post.id}/views`;
      assert.equal(
        (
          await get(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
        ).status,
        400
      );
      const results = await Promise.all(
        Array.from({ length: 12 }, () => get(endpoint, { method: 'POST' }))
      );
      assert.ok(results.every((r) => r.status === 204));
      const row = (await pool.query('SELECT * FROM content.board_post WHERE id=$1', [post.id]))
        .rows[0];
      assert.equal(Number(row.view_count), 12);
      assert.equal(row.lock_version, post.lock_version);
      assert.equal(+row.updated_at, +post.updated_at);
    }
  );
  await t.test('hidden and missing posts have identical errors', async () => {
    await pool.query("UPDATE content.board_post SET status='HIDDEN_REVIEW' WHERE id=$1", [post.id]);
    for (const suffix of [post.id, '9999999', 'abc', '0'])
      assert.equal(
        (await get(`/api/v1/boards/meme/posts/${suffix}`)).body.error.code,
        'POST_NOT_FOUND'
      );
    assert.equal(
      (await get(`/api/v1/boards/no-board/posts/${post.id}`)).body.error.code,
      'POST_NOT_FOUND'
    );
  });
});
