// Fixed local target. Run only while no other collector writes are active.
import pg from 'pg';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
const source = process.argv[2] || 'yuldo';
const detailUrl = process.argv[3];
const sources = JSON.parse(await readFile('apps/collector/ops/reference-sites.sources.example.json', 'utf8'));
if (process.argv.length > 4 || !Object.hasOwn(sources, source)) throw Error('EXPECTED_SOURCE_AND_OPTIONAL_DETAIL_URL');
if (detailUrl && new URL(detailUrl).protocol !== 'https:') throw Error('EXPECTED_HTTPS_DETAIL_URL');
const client = new pg.Client({ connectionString: 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local' });
const hash = value => createHash('sha256').update(value).digest('hex');
async function snapshot() {
  const tables = ['batch_source', 'batch_run', 'batch_item', 'batch_media', 'batch_failure', 'batch_report', 'batch_checkpoint', 'batch_queue', 'batch_confirmation', 'batch_media_correction', 'batch_review', 'batch_review_request'];
  const database = {};
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    for (const table of tables) {
      const rows = (await client.query(`SELECT to_jsonb(t)::text AS row FROM collect.${table} t ORDER BY to_jsonb(t)::text`)).rows;
      database[table] = { rows: rows.length, hash: hash(JSON.stringify(rows)) };
    }
  } finally { await client.query('ROLLBACK'); }
  const root = resolve('.local-data/collector-objects'), objects = [];
  async function walk(path = '') {
    for (const file of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = join(path, file.name);
      if (file.isSymbolicLink()) throw Error('UNEXPECTED_SYMLINK');
      if (file.isDirectory()) await walk(relative);
      else objects.push([relative, hash(await readFile(join(root, relative)))]);
    }
  }
  await walk();
  return { database, objects: { count: objects.length, hash: hash(JSON.stringify(objects)) } };
}
await client.connect();
try {
  if (Number((await client.query("SELECT count(*) FROM collect.batch_run WHERE state='RUNNING'")).rows[0].count)) throw Error('ACTIVE_COLLECTOR_RUN');
  const before = await snapshot();
  const args = detailUrl
    ? ['collect-url', '--source', source, '--url', detailUrl, '--dry-run']
    : ['batch', '--source', source, '--max-pages', '1', '--max-items', '1', '--since', '24h', '--dry-run'];
  const child = spawn(process.execPath, ['scripts/local/run-batch.mjs', ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: process.env });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; });
  const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  const line = output.split('\n').findLast(line => line.startsWith('{'));
  const result = line ? JSON.parse(line) : null, after = await snapshot();
  const report = { at: new Date().toISOString(), source, detailUrl, before, after, result, exitCode, unchanged: JSON.stringify(before) === JSON.stringify(after) };
  await mkdir('.local-data/verification', { recursive: true, mode: 0o700 });
  await writeFile(`.local-data/verification/dry-run-${source}${detailUrl ? '-detail' : ''}.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ source, unchanged: report.unchanged, tables: Object.keys(before.database).length, objects: before.objects.count, exitCode, state: result?.report?.state }));
  if (!report.unchanged || exitCode !== 0 || result?.mode !== 'DRY_RUN') process.exitCode = 1;
} finally { await client.end(); }
