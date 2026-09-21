import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { digest, originalDirectory } from './original-import.mjs';

const read = async (name) => JSON.parse(await readFile(new URL(name, originalDirectory), 'utf8'));
const snapshot = await read('snapshot.json');
const preview = await read('preview-result-2026-09-20T07-15-47-431Z.json');
const completion = await read('completion-result-2026-09-20T07-21-42-656Z.json');
const replaced = completion.databases.find((database) => database.database === 'preview');
const expectedPreview = preview.rows.map(
  (row) => replaced.rows.find((entry) => entry.sourceUrl === row.sourceUrl) || row
);
const database = new pg.Client({
  connectionString: 'postgresql://blariyo_local@127.0.0.1:55439/blariyo_local',
});
const report = { verifiedAt: new Date().toISOString(), posts: [], issues: [], social: {} };
await database.connect();
try {
  await database.query('BEGIN READ ONLY');
  for (const source of snapshot.posts) {
    const row = (
      await database.query(
        `SELECT p.id,p.title,p.status,s.capture,s.capture_sha256 FROM content.board_post p
      JOIN LATERAL (SELECT * FROM scrape_archive.source_capture WHERE post_id=p.id ORDER BY id DESC LIMIT 1) s ON true
      WHERE p.source_url=$1`,
        [source.sourceUrl]
      )
    ).rows;
    assert.equal(row.length, 1);
    const stored = row[0];
    assert.equal(stored.status, 'DRAFT');
    assert.equal(stored.title, source.title);
    assert.equal(stored.capture_sha256, digest(JSON.stringify(source)));
    assert.equal(stored.capture.articleHtml, source.articleHtml);
    assert.equal(source.status, 'FETCHED');
    assert.deepEqual(source.issues, []);
    const blocks = (
      await database.query(
        `SELECT b.*,encode(i.content_sha256,'hex') hash,i.status image_status
      FROM content.board_post_block b LEFT JOIN content.board_post_image i ON i.id=b.image_id
      WHERE b.post_id=$1 ORDER BY b.position`,
        [stored.id]
      )
    ).rows;
    assert.equal(blocks.length, stored.capture.appliedBlocks.length);
    for (const [index, expected] of stored.capture.appliedBlocks.entries()) {
      const actual = blocks[index];
      assert.equal(actual.position, index + 1);
      assert.equal(actual.type, expected.type);
      if (expected.type === 'TEXT') assert.equal(actual.text_content, expected.text.trim());
      else {
        assert.equal(actual.image_id, String(expected.imageId));
        assert.equal(actual.image_status, 'STAGED');
        const mapping = stored.capture.imageMappings.find(
          (image) => image.imageId === actual.image_id
        );
        assert.equal(actual.hash, mapping.storedSha256);
      }
    }
    for (const block of source.blocks.filter((block) => block.asset))
      assert.equal(
        digest(await readFile(new URL(block.asset.filename, originalDirectory))),
        block.asset.sha256
      );
    const expected = expectedPreview.find((post) => post.sourceUrl === source.sourceUrl);
    const response = await fetch(
      `http://127.0.0.1:59689/api/v1/boards/meme/posts/${expected.postId}`,
      { signal: AbortSignal.timeout(15000) }
    );
    assert.equal(response.status, 200);
    const actual = (await response.json()).data.post;
    assert.equal(actual.source.url, source.sourceUrl);
    assert.equal(actual.title, source.title);
    assert.equal(actual.blocks.length, expected.blocks.length);
    for (const [index, block] of expected.blocks.entries()) {
      assert.equal(actual.blocks[index].type, block.type);
      if (block.type === 'TEXT') assert.equal(actual.blocks[index].text, block.text.trim());
    }
    report.posts.push({
      localId: stored.id,
      previewId: expected.postId,
      sourceUrl: source.sourceUrl,
      blocks: blocks.length,
      images: stored.capture.imageMappings.length,
      dbReadback: 'PASS',
      previewApi: 'PASS',
    });
    for (const social of source.social) {
      assert.equal(social.status, 'FETCHED');
      report.social[social.provider] = (report.social[social.provider] || 0) + 1;
    }
  }
  report.applicationMigrations = (
    await database.query('SELECT version FROM ops.schema_migration ORDER BY version')
  ).rows.map((row) => row.version);
  await database.query('ROLLBACK');
} finally {
  await database.end();
}
const previewDb = new pg.Client({
  connectionString: 'postgresql://postgres@127.0.0.1:55449/m0_browser_f3351c5d9ee9',
});
await previewDb.connect();
try {
  await previewDb.query('BEGIN READ ONLY');
  const images = (
    await previewDb.query(`SELECT public_storage_key,mime_type,encode(content_sha256,'hex') hash
    FROM content.board_post_image WHERE status='PUBLIC' ORDER BY id`)
  ).rows;
  assert.equal(images.length, 105);
  for (const image of images) {
    const response = await fetch(`http://127.0.0.1:59689/media/${image.public_storage_key}`, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.startsWith(image.mime_type));
    assert.equal(digest(Buffer.from(await response.arrayBuffer())), image.hash);
  }
  report.previewMedia = { images: images.length, httpStatusAndFileHashes: 'PASS' };
  await previewDb.query('ROLLBACK');
} finally {
  await previewDb.end();
}
report.summary = {
  posts: report.posts.length,
  blocks: report.posts.reduce((n, post) => n + post.blocks, 0),
  images: report.posts.reduce((n, post) => n + post.images, 0),
  unresolvedCaptureIssues: 0,
  localStatus: 'DRAFT',
  previewStatus: 'PUBLISHED',
  browserVisual: 'NOT_RUN',
};
try {
  const browser = await read('browser-check.json');
  report.browser = browser;
  report.summary.browserVisual = browser.visualReview?.layout || 'CONTENT_IMAGES_CHECKED';
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const output = new URL('final-verification.json', originalDirectory);
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(
  JSON.stringify({
    ...report.summary,
    social: report.social,
    previewMedia: report.previewMedia,
    report: output.pathname,
  })
);
