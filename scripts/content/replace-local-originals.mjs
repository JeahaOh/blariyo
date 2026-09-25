import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { PostsService } from '../../apps/api/dist/features/posts/posts.service.js';
import { DatabaseContext } from '../../apps/api/dist/persistence/database.js';
import { UnitOfWork } from '../../apps/api/dist/shared/unit-of-work.js';
import { Storage } from '../../apps/api/dist/shared/storage.js';
import { contentMigrationChecksumMatches } from './migration-checksum.mjs';
import {
  ACTOR,
  digest,
  originalDirectory,
  prepareOriginals,
  stageOriginalBlocks,
} from './original-import.mjs';

assert.deepEqual(
  process.argv.slice(2),
  ['--apply'],
  'Use --apply for the fixed local 25-post replacement'
);
const databaseUrl = 'postgresql://blariyo_local@127.0.0.1:55439/blariyo_local';
const { snapshot, bundle, prepared } = await prepareOriginals();
const urls = bundle.items.map((post) => post.sourceUrl);
const byUrl = new Map(bundle.items.map((post) => [post.sourceUrl, post]));
const app = await createNestApplication({
  databaseUrl,
  serviceToken: randomBytes(32).toString('hex'),
  localMedia: true,
});
const db = app.get(DatabaseContext);
const work = app.get(UnitOfWork);
const storage = app.get(Storage);
const posts = app.get(PostsService);
const writtenKeys = [];
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = new URL(`backup-before-replace-${stamp}.json`, originalDirectory);
const report = {
  database: 'loopback:55439/blariyo_local',
  startedAt: new Date().toISOString(),
  backup: backup.pathname,
  rows: [],
  rights: snapshot.rights,
};
let committed = false;
try {
  await work.transaction(async () => {
    await db.manager.query(
      "SELECT pg_advisory_xact_lock(hashtext('blariyo-local-originals-20260920'))"
    );
    const targets = await db.manager.query(
      'SELECT * FROM content.board_post WHERE source_url=ANY($1::text[]) ORDER BY id FOR UPDATE',
      [urls]
    );
    assert.equal(targets.length, 25);
    assert.equal(new Set(targets.map((row) => row.source_url)).size, 25);
    const ids = targets.map((row) => row.id);
    const oldBlocks = await db.manager.query(
      'SELECT * FROM content.board_post_block WHERE post_id=ANY($1::bigint[]) ORDER BY post_id,position',
      [ids]
    );
    const oldImages = await db.manager.query(
      'SELECT * FROM content.board_post_image WHERE post_id=ANY($1::bigint[]) ORDER BY id',
      [ids]
    );
    await writeFile(
      backup,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          database: report.database,
          posts: targets,
          blocks: oldBlocks,
          images: oldImages,
        },
        null,
        2
      ) + '\n',
      { mode: 0o600 }
    );
    const migration = await readFile(
      new URL('./migrations/001_source_capture.sql', import.meta.url),
      'utf8'
    );
    const exists = await db.manager.query(
      "SELECT to_regclass('scrape_archive.schema_migration') AS table_name"
    );
    if (exists[0].table_name) {
      const ledger = await db.manager.query(
        'SELECT checksum_sha256 FROM scrape_archive.schema_migration WHERE version=1'
      );
      assert.ok(
        contentMigrationChecksumMatches(digest(migration), ledger[0]?.checksum_sha256),
        'Archive migration checksum mismatch'
      );
    } else {
      await db.manager.query(migration);
      await db.manager.query(
        'INSERT INTO scrape_archive.schema_migration(version,checksum_sha256) VALUES(1,$1)',
        [digest(migration)]
      );
    }
    for (const source of snapshot.posts) {
      const target = targets.find((row) => row.source_url === source.sourceUrl);
      assert.equal(target.status, 'DRAFT', 'Do not change publication state');
      const captureHash = digest(JSON.stringify(source));
      const previous = await db.manager.query(
        'SELECT capture_sha256,capture FROM scrape_archive.source_capture WHERE post_id=$1 ORDER BY id DESC LIMIT 1',
        [target.id]
      );
      if (previous.length) {
        assert.equal(
          previous[0].capture_sha256,
          captureHash,
          'Different capture already imported; refuse implicit overwrite'
        );
        report.rows.push({
          postId: target.id,
          sourceUrl: source.sourceUrl,
          action: 'UNCHANGED',
          captureHash,
          blocks: previous[0].capture.appliedBlocks,
          images: previous[0].capture.imageMappings,
          issues: source.issues,
        });
        continue;
      }
      const currentBlocks = oldBlocks.filter((row) => row.post_id === target.id);
      assert.equal(currentBlocks.length, 1, 'Existing editor work must be preserved');
      assert.equal(currentBlocks[0].type, 'TEXT');
      assert.equal(
        currentBlocks[0].text_content,
        byUrl.get(source.sourceUrl).summary,
        'Existing content changed since the summary import'
      );
      assert.equal(oldImages.filter((row) => row.post_id === target.id).length, 0);
      const { blocks, imageMappings } = await stageOriginalBlocks(
        app,
        source,
        prepared,
        `${target.id}-${captureHash.slice(0, 16)}`,
        writtenKeys
      );
      await posts.command(
        {
          action: 'update',
          params: { postId: target.id },
          body: { lockVersion: target.lock_version, blocks },
        },
        ACTOR
      );
      const capture = { ...source, rights: snapshot.rights, imageMappings, appliedBlocks: blocks };
      await db.manager.query(
        `INSERT INTO scrape_archive.source_capture
        (post_id,source_url,capture_sha256,parser_version,captured_at,capture,created_by)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          target.id,
          source.sourceUrl,
          captureHash,
          source.parserVersion,
          source.capturedAt,
          JSON.stringify(capture),
          ACTOR,
        ]
      );
      report.rows.push({
        postId: target.id,
        sourceUrl: source.sourceUrl,
        action: 'REPLACED',
        captureHash,
        blocks,
        images: imageMappings,
        issues: source.issues,
      });
    }
  });
  committed = true;
} finally {
  if (!committed) for (const key of writtenKeys) await storage.delete('private', key);
  await app.close();
}

// Independent connection readback after commit, including the exact text and image hashes.
const verify = new pg.Client({ connectionString: databaseUrl });
await verify.connect();
try {
  await verify.query('BEGIN READ ONLY');
  for (const expected of report.rows) {
    const { rows } = await verify.query(
      `SELECT b.position,b.type,b.text_content,b.image_id,b.alt_text,
      encode(i.content_sha256,'hex') stored_hash,i.status image_status,i.width,i.height
      FROM content.board_post_block b LEFT JOIN content.board_post_image i ON i.id=b.image_id
      WHERE b.post_id=$1 ORDER BY b.position`,
      [expected.postId]
    );
    assert.equal(rows.length, expected.blocks.length);
    for (const [index, block] of expected.blocks.entries()) {
      assert.equal(rows[index].position, index + 1);
      assert.equal(rows[index].type, block.type);
      if (block.type === 'TEXT') assert.equal(rows[index].text_content, block.text.trim());
      else {
        const image = expected.images.find(
          (entry) => String(entry.imageId) === String(block.imageId)
        );
        assert.equal(rows[index].image_id, String(block.imageId));
        assert.equal(rows[index].stored_hash, image.storedSha256);
        assert.equal(rows[index].image_status, 'STAGED');
        assert.equal(rows[index].width, image.width);
        assert.equal(rows[index].height, image.height);
      }
    }
    const stored = (
      await verify.query(
        'SELECT p.status,s.capture_sha256,s.capture FROM content.board_post p JOIN scrape_archive.source_capture s ON s.post_id=p.id WHERE p.id=$1 AND s.capture_sha256=$2',
        [expected.postId, expected.captureHash]
      )
    ).rows;
    assert.equal(stored.length, 1);
    assert.equal(stored[0].status, 'DRAFT');
    assert.equal(
      stored[0].capture.articleHtml,
      snapshot.posts.find((post) => post.sourceUrl === expected.sourceUrl).articleHtml
    );
    expected.readback = 'PASS';
  }
  await verify.query('ROLLBACK');
} finally {
  await verify.end();
}
report.completedAt = new Date().toISOString();
report.summary = {
  posts: report.rows.length,
  replaced: report.rows.filter((row) => row.action === 'REPLACED').length,
  unchanged: report.rows.filter((row) => row.action === 'UNCHANGED').length,
  blocks: report.rows.reduce((n, row) => n + row.blocks.length, 0),
  images: report.rows.reduce((n, row) => n + row.images.length, 0),
  preservedLargeGifs: report.rows
    .flatMap((row) => row.images)
    .filter((image) => image.originalGifPreserved).length,
  remainingIssues: report.rows.flatMap((row) => row.issues).length,
  readback: 'PASS',
  published: 0,
};
const output = new URL(`replace-result-${stamp}.json`, originalDirectory);
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(
  JSON.stringify({ ...report.summary, report: output.pathname, backup: backup.pathname })
);
