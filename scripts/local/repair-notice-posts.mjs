// Reversible, fixed-target local repair. All state changes use the normal admin HTTP API.
import pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const mode = process.argv[2] ?? '--dry-run';
if (process.argv.length > 3 || !['--dry-run', '--apply', '--rollback'].includes(mode))
  throw Error('INVALID_MODE');
const origin = 'http://localhost:3000',
  targetKeys = { 80: '2803717', 81: '2812904' };
const manifestPath = '.local-data/repairs/notice-posts-v1.json',
  backupPath = '.local-data/backups/before-notice-posts-v1.dump';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const c = new pg.Client({
  connectionString: 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local',
});
await c.connect();
try {
  await c.query('SELECT pg_advisory_lock(72498134)');
  const rows = async () =>
    (
      await c.query(
        `SELECT p.id::text,p.source_name,p.source_url,p.title,p.status,p.lock_version,
    (SELECT jsonb_agg(jsonb_build_object('type',b.type,'text',b.text_content,'image',b.image_id,'alt',b.alt_text) ORDER BY b.position) FROM content.board_post_block b WHERE b.post_id=p.id) AS blocks,
    (SELECT count(*)::int FROM content.board_post_image i WHERE i.post_id=p.id) AS images
    FROM content.board_post p WHERE p.id=ANY($1::bigint[]) ORDER BY p.id`,
        [Object.keys(targetKeys)]
      )
    ).rows;
  const fingerprint = (p) =>
    sha(JSON.stringify({ id: p.id, source: p.source_url, title: p.title, blocks: p.blocks }));
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const before = await rows();
  if (before.length !== 2) throw Error('MISSING_TARGET');
  for (const p of before) {
    const u = new URL(p.source_url);
    if (
      p.source_name !== 'etoland' ||
      u.hostname !== 'etoland.co.kr' ||
      !u.pathname.endsWith('-' + targetKeys[p.id]) ||
      p.images !== 0 ||
      !['PUBLISHED', 'HIDDEN_REVIEW'].includes(p.status)
    )
      throw Error('TARGET_CHANGED');
  }
  if (!manifest) {
    if (mode === '--rollback' || before.some((p) => p.status !== 'PUBLISHED'))
      throw Error('ORIGINAL_MANIFEST_REQUIRED');
    manifest = {
      version: 1,
      database: 'blariyo_local',
      backupPath,
      entries: before.map((p) => ({
        id: p.id,
        source: p.source_url,
        fingerprint: fingerprint(p),
        version: p.lock_version,
        hideKey: randomUUID(),
        restoreKey: randomUUID(),
      })),
    };
  }
  if (
    manifest.version !== 1 ||
    manifest.database !== 'blariyo_local' ||
    manifest.backupPath !== backupPath ||
    manifest.entries.length !== 2 ||
    new Set(manifest.entries.map((e) => e.id)).size !== 2
  )
    throw Error('INVALID_MANIFEST');
  for (const p of before) {
    const e = manifest.entries.find((e) => e.id === p.id);
    if (!e || e.source !== p.source_url || e.fingerprint !== fingerprint(p))
      throw Error('CONTENT_CHANGED');
    const versions = p.status === 'HIDDEN_REVIEW' ? [e.version + 1] : [e.version, e.version + 2];
    if (!versions.includes(p.lock_version)) throw Error('POST_VERSION_CHANGED');
  }
  if (mode === '--dry-run')
    console.log(
      JSON.stringify({
        mode,
        targets: before.map((p) => ({
          id: p.id,
          status: p.status,
          action: p.status === 'PUBLISHED' ? 'HIDE' : 'ALREADY_HIDDEN',
        })),
      })
    );
  else {
    const session = JSON.parse(await readFile('.local-data/development/session.json', 'utf8'));
    if (session.origin !== origin || typeof session.adminToken !== 'string')
      throw Error('LOCAL_SESSION_MISMATCH');
    // Authentication and all target checks happen before any mutation or backup creation.
    for (const p of before) {
      const r = await fetch(`${origin}/api/v1/admin/posts/${p.id}`, {
        headers: { Cookie: `BLARIYO_ADMIN_SESSION=${session.adminToken}` },
      });
      if (!r.ok) throw Error('ADMIN_PREFLIGHT_FAILED');
    }
    let saved = false;
    try {
      await readFile(manifestPath);
      saved = true;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (!saved) {
      await mkdir('.local-data/backups', { recursive: true, mode: 0o700 });
      await mkdir('.local-data/repairs', { recursive: true, mode: 0o700 });
      const { stdout } = await promisify(execFile)(
        'docker',
        [
          'exec',
          'blariyo-m0-core-local-postgresql-1',
          'pg_dump',
          '-U',
          'blariyo_local',
          '-Fc',
          'blariyo_local',
        ],
        { encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 }
      );
      if (stdout.subarray(0, 5).toString() !== 'PGDMP') throw Error('BACKUP_INVALID');
      await writeFile(backupPath, stdout, { flag: 'wx', mode: 0o600 });
      manifest.backupHash = sha(stdout);
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    } else if (sha(await readFile(backupPath)) !== manifest.backupHash)
      throw Error('BACKUP_CHANGED');
    let changed = 0;
    for (const p of before) {
      const e = manifest.entries.find((e) => e.id === p.id),
        restore = mode === '--rollback';
      if ((restore && p.status === 'PUBLISHED') || (!restore && p.status === 'HIDDEN_REVIEW'))
        continue;
      if (!restore && p.lock_version !== e.version) throw Error('ALREADY_RESTORED');
      const action = restore ? 'republish' : 'hide';
      const body = {
        lockVersion: p.lock_version,
        ...(restore ? { pinnedPosition: null } : { reasonCode: 'EDIT' }),
      };
      const response = await fetch(`${origin}/api/v1/admin/posts/${p.id}/${action}`, {
        method: 'POST',
        headers: {
          Cookie: `BLARIYO_ADMIN_SESSION=${session.adminToken}`,
          Origin: origin,
          'Content-Type': 'application/json',
          'Idempotency-Key': restore ? e.restoreKey : e.hideKey,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw Error('ADMIN_COMMAND_FAILED:' + p.id + ':' + response.status);
      changed++;
    }
    const after = await rows();
    for (const p of after) {
      const e = manifest.entries.find((e) => e.id === p.id),
        wanted = mode === '--rollback' ? 'PUBLISHED' : 'HIDDEN_REVIEW';
      if (p.status !== wanted || fingerprint(p) !== e.fingerprint) throw Error('READBACK_FAILED');
      const response = await fetch(`${origin}/api/v1/boards/meme/posts/${p.id}`);
      if (response.status !== (wanted === 'PUBLISHED' ? 200 : 404))
        throw Error('PUBLIC_READBACK_FAILED');
    }
    console.log(
      JSON.stringify({
        mode,
        changed,
        targets: after.map((p) => ({ id: p.id, status: p.status, version: p.lock_version })),
        readbackPass: true,
        backupPath,
      })
    );
  }
} finally {
  await c.end();
}
