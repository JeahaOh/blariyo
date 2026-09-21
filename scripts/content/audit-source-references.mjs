import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { parseTheqoo, referenceInventory } from './theqoo-parser.mjs';

// Read-only source/DB comparison. No article text or attachment bytes are persisted.
const directory = new URL('../../.local-data/content-review/', import.meta.url);
const bundle = JSON.parse(
  await readFile(new URL('./community-hot-20260920.json', import.meta.url), 'utf8')
);
assert.equal(bundle.items.length, 25);
assert.equal(new Set(bundle.items.map((item) => item.sourceUrl)).size, 25);
for (const item of bundle.items) assert.match(item.sourceUrl, /^https:\/\/theqoo\.net\/hot\/\d+$/);

const db = new pg.Client({
  connectionString: 'postgresql://blariyo_local@127.0.0.1:55439/blariyo_local',
});
await db.connect();
let existing;
try {
  await db.query('BEGIN READ ONLY');
  const result = await db.query(
    `SELECT p.id::text, p.status, p.lock_version, p.source_url,
    count(b.id)::int block_count, count(b.id) FILTER (WHERE b.type='IMAGE')::int image_count
    FROM content.board_post p LEFT JOIN content.board_post_block b ON b.post_id=p.id
    WHERE p.source_url=ANY($1::text[]) GROUP BY p.id ORDER BY p.id`,
    [bundle.items.map((item) => item.sourceUrl)]
  );
  existing = result.rows;
  assert.equal(existing.length, 25, 'Expected exactly the original 25 local rows');
} finally {
  await db.query('ROLLBACK');
  await db.end();
}
const bySource = new Map(existing.map((row) => [row.source_url, row]));
assert.equal(bySource.size, 25, 'Duplicate source URLs require manual reconciliation');

async function page(url) {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    headers: {
      'user-agent': 'BlariyoContentReview/1.0 (one-time user-requested reference audit)',
      accept: 'text/html',
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP_${response.status}`);
  }
  if (!response.headers.get('content-type')?.includes('text/html')) {
    await response.body?.cancel();
    throw new Error('NOT_HTML');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('RESPONSE_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const report = {
  observedAt: new Date().toISOString(),
  database: 'loopback:55439/blariyo_local',
  databaseMutation: false,
  bodyTextPersisted: false,
  items: [],
};
let consecutiveErrors = 0;
for (const [index, item] of bundle.items.entries()) {
  try {
    const html = await page(item.sourceUrl);
    const parsed = parseTheqoo(html, item.sourceUrl);
    consecutiveErrors = 0;
    report.items.push({
      ...referenceInventory(parsed),
      observedAt: new Date().toISOString(),
      responseSha256: createHash('sha256').update(html).digest('hex'),
      database: bySource.get(item.sourceUrl),
    });
    console.log(
      JSON.stringify({
        item: index + 1,
        postId: bySource.get(item.sourceUrl).id,
        kinds: parsed.blocks.reduce((out, block) => {
          out[block.kind] = (out[block.kind] || 0) + 1;
          return out;
        }, {}),
        issues: parsed.issues.length,
      })
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    report.items.push({
      sourceUrl: item.sourceUrl,
      database: bySource.get(item.sourceUrl),
      error: code,
    });
    console.log(JSON.stringify({ item: index + 1, error: code }));
    consecutiveErrors++;
    if (/HTTP_(403|429)/.test(code) || consecutiveErrors >= 3) break;
  }
  if (index + 1 < bundle.items.length) await delay(1200);
}
await mkdir(directory, { recursive: true });
const output = new URL(
  `reference-audit-${report.observedAt.replace(/[:.]/g, '-')}.json`,
  directory
);
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const references = report.items.flatMap((item) => item.references || []);
console.log(
  JSON.stringify({
    report: output.pathname,
    audited: report.items.length,
    errors: report.items.filter((item) => item.error).length,
    references: references.reduce((out, reference) => {
      out[reference.kind] = (out[reference.kind] || 0) + 1;
      return out;
    }, {}),
    databaseMutation: false,
  })
);
if (report.items.length !== 25 || report.items.some((item) => item.error || item.issues.length))
  process.exitCode = 1;
