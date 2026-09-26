import { decodeCollectedFrames } from '../../apps/api/dist/features/images/collected-animation.js';
// Read-only inventory audit of immutable FETCHED rows on the fixed local development target.
import pg from 'pg';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const root = await realpath('.local-data/collector-objects');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function object(key, prefix) {
  if (typeof key !== 'string' || !key.startsWith(prefix)) throw Error('INVALID_OBJECT_KEY');
  const p = await realpath(resolve(root, key));
  if (!p.startsWith(root + sep)) throw Error('INVALID_OBJECT_PATH');
  return readFile(p);
}
const c = new pg.Client({
  connectionString: 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local',
});
const report = {
  at: new Date().toISOString(),
  database: 'blariyo_local',
  scope:
    'All FETCHED rows in one read-only snapshot; running/failed rows are not declared complete.',
  states: [],
  items: [],
  sources: {},
  failures: [],
};
await c.connect();
try {
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  report.states = (
    await c.query(
      'SELECT source_key,state,count(*)::int AS count FROM collect.batch_item GROUP BY source_key,state ORDER BY source_key,state'
    )
  ).rows;
  const items = (
    await c.query(
      "SELECT *,encode(canonical_url_hash,'hex') AS canonical_hash FROM collect.batch_item WHERE state='FETCHED' ORDER BY source_key,source_post_key"
    )
  ).rows;
  const seenKeys = new Set(),
    seenUrls = new Set();
  for (const item of items) {
    const row = {
      id: item.id,
      source: item.source_key,
      key: item.source_post_key,
      runId: item.run_id,
      blocks: item.body_blocks?.length ?? 0,
      images: 0,
      files: 0,
      sns: item.sns_links.length,
      mediaBytes: 0,
      animations: [],
      failures: [],
    };
    const check = (ok, code) => {
      if (!ok) row.failures.push(code);
    };
    check(Boolean(item.title?.trim()) && row.blocks > 0, 'EMPTY_ARTICLE');
    check(sha(item.canonical_url) === item.canonical_hash, 'CANONICAL_HASH');
    const key = item.source_key + ':' + item.source_post_key;
    check(!seenKeys.has(key) && !seenUrls.has(item.canonical_hash), 'DUPLICATE_IDENTITY');
    seenKeys.add(key);
    seenUrls.add(item.canonical_hash);
    try {
      const raw = await object(item.raw_object_key, 'collect/raw/');
      row.rawBytes = raw.length;
      row.rawSha256 = sha(raw);
      check(raw.length > 0, 'EMPTY_RAW');
    } catch {
      row.failures.push('RAW_UNREADABLE');
    }
    const media = (
      await c.query(
        "SELECT *,encode(sha256,'hex') AS hash FROM collect.batch_media WHERE item_id=$1 ORDER BY position",
        [item.id]
      )
    ).rows;
    const images = media.filter((m) => m.kind === 'IMAGE'),
      files = media.filter((m) => m.kind === 'FILE');
    row.images = images.length;
    row.files = files.length;
    const positions = (item.body_blocks ?? [])
      .filter((b) => b.type === 'IMAGE')
      .map((b) => b.imagePosition);
    check(
      positions.length === images.length &&
        new Set(positions).size === positions.length &&
        positions.every((p) => images.some((m) => m.position === p)),
      'BODY_IMAGE_MAPPING'
    );
    check(
      item.attachment_metadata.length === files.length &&
        item.attachment_metadata.every((a) => files.some((m) => m.remote_url === a.remoteUrl)),
      'ATTACHMENT_MAPPING'
    );
    check(
      item.sns_links.every((url) =>
        item.body_blocks.some((b) => b.type === 'LINK' && b.url === url)
      ),
      'SNS_BODY_MAPPING'
    );
    for (const m of media) {
      try {
        const bytes = await object(m.object_key, 'collect/media/');
        row.mediaBytes += bytes.length;
        check(
          bytes.length === Number(m.byte_size) && sha(bytes) === m.hash,
          'MEDIA_HASH_OR_SIZE:' + m.position
        );
        if (m.kind === 'IMAGE') {
          const meta = await sharp(bytes).metadata();
          const mime = {
            jpeg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp',
            gif: 'image/gif',
            avif: 'image/avif',
          }[meta.format];
          check(mime === m.mime_type, 'IMAGE_MIME:' + m.position);
          const decoded = await decodeCollectedFrames(bytes, meta);
          if (decoded.frames > 1) row.animations.push({ position: m.position, ...decoded });
        }
      } catch (error) {
        row.failures.push(
          (error instanceof Error &&
          /pixel limit|ANIMATION_DECODE_LIMIT|timeout/i.test(error.message)
            ? 'IMAGE_DECODE_POLICY_EXCEEDED:'
            : 'MEDIA_UNREADABLE:') + m.position
        );
      }
    }
    report.items.push(row);
    const source = (report.sources[row.source] ??= {
      items: 0,
      images: 0,
      files: 0,
      sns: 0,
      failures: 0,
    });
    for (const name of ['images', 'files', 'sns']) source[name] += row[name];
    source.items++;
    source.failures += row.failures.length;
    if (row.failures.length)
      report.failures.push({ id: row.id, source: row.source, codes: row.failures });
  }
  await c.query('COMMIT');
  await mkdir('.local-data/verification', { recursive: true, mode: 0o700 });
  await writeFile(
    '.local-data/verification/collector-inventory.json',
    JSON.stringify(report, null, 2),
    { mode: 0o600 }
  );
  console.log(
    JSON.stringify({
      at: report.at,
      items: report.items.length,
      sources: report.sources,
      failures: report.failures,
    })
  );
  if (report.failures.length) process.exitCode = 1;
} finally {
  await c.end();
}
