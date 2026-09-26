// Narrow repair for the five already-identified local posts. Never accepts a remote target.
import pg from 'pg';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const mode = process.argv[2] ?? '--dry-run';
if (process.argv.length > 3 || !['--dry-run', '--apply', '--rollback'].includes(mode))
  throw Error('INVALID_MODE');
const targetIds = ['42', '81', '91', '94', '102'];
const manifestPath = '.local-data/repairs/collected-labels-v1.json';
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const shape = (rows) =>
  rows.map((r) => ({ type: r.type, text: r.text_content, image: r.image_id, alt: r.alt_text }));
const c = new pg.Client({
  connectionString: 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local',
});
await c.connect();
try {
  await c.query('BEGIN');
  await c.query('SELECT pg_advisory_xact_lock(72498133)');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!manifest && mode === '--rollback') throw Error('MANIFEST_REQUIRED');
  const sources = (
    await c.query(
      `SELECT p.id::text,p.status,i.body_blocks FROM content.board_post p
    JOIN collect.batch_item i ON i.canonical_url=p.source_url WHERE p.id=ANY($1::bigint[]) ORDER BY p.id FOR UPDATE OF p`,
      [targetIds]
    )
  ).rows;
  if (sources.length !== targetIds.length || sources.some((p) => p.status !== 'PUBLISHED'))
    throw Error('TARGET_CHANGED');
  const rowsByPost = new Map();
  for (const p of sources)
    rowsByPost.set(
      p.id,
      (
        await c.query(
          'SELECT * FROM content.board_post_block WHERE post_id=$1 ORDER BY position FOR UPDATE',
          [p.id]
        )
      ).rows
    );
  if (!manifest) {
    manifest = { version: 1, database: 'blariyo_local', entries: [] };
    for (const p of sources) {
      const before = rowsByPost.get(p.id),
        after = [];
      if (before.length !== p.body_blocks.length) throw Error('BODY_CHANGED');
      for (const [index, b] of p.body_blocks.entries()) {
        const row = before[index];
        if (b.type === 'LINK') {
          if (row.type !== 'TEXT' || row.text_content !== b.url) throw Error('LINK_CHANGED');
          if (b.label?.trim() && b.label.trim() !== b.url)
            after.push({
              type: 'TEXT',
              text_content: b.label.trim(),
              image_id: null,
              alt_text: null,
            });
        } else if (row.type !== b.type || (b.type === 'TEXT' && row.text_content !== b.text))
          throw Error('BODY_CHANGED');
        after.push(row);
      }
      if (after.length !== before.length + 1) throw Error('UNEXPECTED_REPAIR_SIZE');
      manifest.entries.push({ id: p.id, sourceHash: digest(p.body_blocks), before, after });
    }
    if (mode === '--apply') {
      await mkdir('.local-data/repairs', { recursive: true, mode: 0o700 });
      await writeFile(manifestPath, JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
    }
  }
  if (
    manifest.version !== 1 ||
    manifest.database !== 'blariyo_local' ||
    manifest.entries.length !== 5 ||
    manifest.entries.some((e) => !targetIds.includes(e.id))
  )
    throw Error('INVALID_MANIFEST');
  let changed = 0;
  for (const entry of manifest.entries) {
    if (digest(sources.find((p) => p.id === entry.id).body_blocks) !== entry.sourceHash)
      throw Error('SOURCE_CHANGED');
    const current = rowsByPost.get(entry.id),
      before = digest(shape(entry.before)),
      after = digest(shape(entry.after)),
      actual = digest(shape(current));
    const originalIds = new Set(entry.before.map((r) => String(r.id)));
    if (
      ![before, after].includes(actual) ||
      current.filter((r) => originalIds.has(String(r.id))).length !== entry.before.length
    )
      throw Error('TARGET_CHANGED');
    const wanted = mode === '--rollback' ? before : after;
    if (actual === wanted) continue;
    changed++;
    if (mode === '--dry-run') continue;
    // Move existing positions out of the way without deleting or replacing original rows.
    await c.query('UPDATE content.board_post_block SET position=position+10000 WHERE post_id=$1', [
      entry.id,
    ]);
    if (mode === '--rollback') {
      for (const row of current.filter((r) => !originalIds.has(String(r.id)))) {
        if (row.created_by !== 'system:migration') throw Error('FOREIGN_BLOCK');
        await c.query('DELETE FROM content.board_post_block WHERE id=$1 AND post_id=$2', [
          row.id,
          entry.id,
        ]);
      }
    }
    const desired = mode === '--rollback' ? entry.before : entry.after;
    for (const [index, row] of desired.entries()) {
      if (row.id)
        await c.query(
          'UPDATE content.board_post_block SET position=$1 WHERE id=$2 AND post_id=$3',
          [index + 1, row.id, entry.id]
        );
      else
        await c.query(
          `INSERT INTO content.board_post_block(post_id,position,type,text_content,created_by,created_at,updated_by,updated_at)
        VALUES($1,$2,'TEXT',$3,'system:migration',now(),'system:migration',now())`,
          [entry.id, index + 1, row.text_content]
        );
    }
    await c.query(
      "UPDATE content.board_post SET lock_version=lock_version+1,updated_by='system:migration',updated_at=now() WHERE id=$1",
      [entry.id]
    );
  }
  await c.query(mode === '--dry-run' ? 'ROLLBACK' : 'COMMIT');
  console.log(JSON.stringify({ mode, targets: targetIds.length, changed }));
} catch (error) {
  await c.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
