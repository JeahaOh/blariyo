// Fixed local metadata repair. Never fetch source URLs, rewrite objects, disable triggers, or publish.
import pg from 'pg';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const mode = process.argv[2] ?? '--dry-run';
if (process.argv.length > 3 || !['--dry-run', '--apply', '--rollback'].includes(mode))
  throw Error('INVALID_MODE');
const targets = {
  '1f3e0262-6517-4bf9-974c-a2c26dd56ef7': [2, 4],
  '7895126e-93c4-45d1-9618-0302db53a736': [2],
  '0f32bbbe-a3ec-4e77-90a7-99d6a726f982': [3],
  '6d7930e1-4f2c-4b04-8b3f-4ee173dc58db': [2],
  '6de5fece-13c3-4504-baab-5ff0e0f0de49': [1],
  '3fbaf696-a882-429e-a737-c183fc18ecab': [20, 21],
  'da6279bb-00f2-4564-af5c-8c6cdd066806': [1, 2, 3, 4],
};
const manifestPath = '.local-data/repairs/collector-mime-v1.json';
const root = await realpath('.local-data/collector-objects');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const db = new pg.Client({
  connectionString: 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local',
});
await db.connect();
try {
  await db.query('SELECT pg_advisory_lock(72498135)');
  const hasLedger = Boolean(
    (await db.query("SELECT to_regclass('collect.batch_media_correction') present")).rows[0].present
  );
  const rows = async () =>
    (
      await db.query(
        `SELECT to_jsonb(m) AS media,to_jsonb(i) AS item,
    ${hasLedger ? '(SELECT coalesce(max(revision),0) FROM collect.batch_media_correction c WHERE c.media_id=m.id)' : '0'}::text AS revision
    FROM collect.batch_media m JOIN collect.batch_item i ON i.id=m.item_id
    WHERE i.id=ANY($1::uuid[]) ORDER BY i.id,m.position`,
        [Object.keys(targets)]
      )
    ).rows.filter((r) => targets[r.item.id]?.includes(r.media.position));
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const before = await rows();
  assert.equal(before.length, 12);
  if (manifest) {
    assert.equal(manifest.version, 1);
    assert.equal(manifest.database, 'blariyo_local');
    assert.equal(manifest.entries.length, 12);
  } else {
    if (mode === '--rollback') throw Error('MANIFEST_REQUIRED');
    manifest = {
      version: 1,
      database: 'blariyo_local',
      entries: before.map((r) => ({
        media: r.media,
        itemHash: hash(JSON.stringify(r.item)),
        revision: Number(r.revision),
        operation: randomUUID(),
        rollback: randomUUID(),
      })),
    };
    for (const e of manifest.entries) {
      assert.equal(e.media.mime_type, 'image/png');
      assert.equal(e.revision, 0);
    }
  }
  for (const r of before) {
    const e = manifest.entries.find((e) => e.media.id === r.media.id);
    assert.ok(e);
    assert.equal(r.item.source_key, 'todayhumor');
    assert.equal(r.item.state, 'FETCHED');
    assert.equal(r.media.kind, 'IMAGE');
    assert.equal(hash(JSON.stringify(r.item)), e.itemHash);
    assert.deepEqual({ ...r.media, mime_type: e.media.mime_type }, e.media);
    const revision = Number(r.revision);
    assert.ok([e.revision, e.revision + 1, e.revision + 2].includes(revision));
    assert.equal(r.media.mime_type, revision === e.revision + 1 ? 'image/jpeg' : 'image/png');
    const p = await realpath(resolve(root, r.media.object_key));
    if (!r.media.object_key.startsWith('collect/media/') || !p.startsWith(root + sep))
      throw Error('OBJECT_PATH_REJECTED');
    const bytes = await readFile(p);
    assert.equal(bytes.length, r.media.byte_size);
    assert.equal('\\x' + hash(bytes), r.media.sha256);
    assert.equal((await sharp(bytes).metadata()).format, 'jpeg');
    await sharp(bytes, {
      animated: true,
      limitInputPixels: 64 * 1024 * 1024,
      failOn: 'warning',
    }).stats();
  }
  if (mode === '--dry-run')
    console.log(
      JSON.stringify({
        mode,
        targets: 12,
        items: Object.keys(targets).length,
        decoded: 12,
        needsCorrection: before.filter((r) => r.media.mime_type === 'image/png').length,
        migrationReady: hasLedger,
      })
    );
  else {
    if (!hasLedger) throw Error('MIGRATION_V006_REQUIRED');
    if (!manifest.backup) {
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
      assert.equal(stdout.subarray(0, 5).toString(), 'PGDMP');
      manifest.backup = `.local-data/backups/before-collector-mime-${randomUUID()}.dump`;
      manifest.backupHash = hash(stdout);
      await writeFile(manifest.backup, stdout, { flag: 'wx', mode: 0o600 });
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    }
    assert.equal(hash(await readFile(manifest.backup)), manifest.backupHash);
    let changed = 0;
    await db.query('BEGIN');
    try {
      for (const r of before) {
        const e = manifest.entries.find((e) => e.media.id === r.media.id),
          undo = mode === '--rollback',
          revision = Number(r.revision);
        if ((undo && revision === e.revision + 2) || (!undo && revision === e.revision + 1))
          continue;
        if ((undo && revision !== e.revision + 1) || (!undo && revision !== e.revision))
          throw Error('REPAIR_CYCLE_FINISHED');
        await db.query('SELECT collect.correct_batch_media_mime($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
          undo ? e.rollback : e.operation,
          r.media.id,
          undo ? 'image/jpeg' : 'image/png',
          undo ? 'image/png' : 'image/jpeg',
          Buffer.from(r.media.sha256.slice(2), 'hex'),
          r.media.byte_size,
          r.item.version,
          revision,
          undo ? 'ROLLBACK_LOCAL_MIME_REPAIR' : 'IMAGE_BYTES_VERIFIED',
        ]);
        changed++;
      }
      const after = await rows();
      for (const r of after) {
        const e = manifest.entries.find((e) => e.media.id === r.media.id);
        assert.equal(r.media.mime_type, mode === '--rollback' ? 'image/png' : 'image/jpeg');
        assert.equal(hash(JSON.stringify(r.item)), e.itemHash);
        assert.deepEqual({ ...r.media, mime_type: e.media.mime_type }, e.media);
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
    const readback = await rows();
    assert.ok(
      readback.every(
        (r) => r.media.mime_type === (mode === '--rollback' ? 'image/png' : 'image/jpeg')
      )
    );
    const report = {
      at: new Date().toISOString(),
      mode,
      changed,
      targets: 12,
      items: Object.keys(targets).length,
      readbackPass: true,
      objectBytesChanged: 0,
      backup: manifest.backup,
    };
    await mkdir('.local-data/verification', { recursive: true, mode: 0o700 });
    await writeFile(
      '.local-data/verification/collector-mime-repair.json',
      JSON.stringify(report, null, 2),
      { mode: 0o600 }
    );
    console.log(JSON.stringify(report));
  }
} finally {
  await db.end();
}
