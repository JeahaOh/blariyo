// Explicit local maintenance, never an expiry purge or an application API.
import {Client} from 'pg';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {openSync, closeSync} from 'node:fs';
import {mkdir, cp, readFile, writeFile, readdir, lstat, unlink} from 'node:fs/promises';
import {resolve, join, sep} from 'node:path';

if (process.argv.slice(2).join(' ') !== '--apply-local-unreviewed') {
  throw Error('Required: node scripts/local/clear-unreviewed.mjs --apply-local-unreviewed');
}
const objectRoot = resolve('.local-data/collector-objects');
const backup = resolve(`.local-data/backups/unreviewed-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const client = new Client({connectionString: 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local'});
const hash = value => createHash('sha256').update(value).digest('hex');
const query = (sql, values) => client.query(sql, values);
const selection = `SELECT i.id FROM collect.batch_item i LEFT JOIN collect.batch_review r ON r.item_id=i.id
  WHERE (r.item_id IS NULL OR r.status='REVIEWING') AND r.post_id IS NULL ORDER BY i.id`;
const checkedPath = key => {
  const path = resolve(objectRoot, key);
  if (!key.startsWith('collect/') || !path.startsWith(objectRoot + sep)) throw Error('OBJECT_PATH_INVALID');
  return path;
};
async function inventory(root, prefix = '') {
  const files = [];
  for (const name of await readdir(join(root, prefix))) {
    const key = join(prefix, name);
    const info = await lstat(join(root, key));
    if (info.isSymbolicLink()) throw Error('OBJECT_SYMLINK_REFUSED');
    if (info.isDirectory()) files.push(...await inventory(root, key));
    else if (info.isFile()) files.push({key, bytes: info.size, sha256: hash(await readFile(join(root, key)))});
    else throw Error('OBJECT_TYPE_INVALID');
  }
  return files.sort((a, b) => a.key.localeCompare(b.key));
}
async function protectedSnapshot(ids) {
  const tables = (await query(`SELECT tablename FROM pg_tables WHERE schemaname='content' ORDER BY tablename`)).rows;
  const result = {};
  const digest = async (key, sql, args = []) => {
    const rows = (await query(sql, args)).rows.map(row => JSON.stringify(row)).sort();
    result[key] = {count: rows.length, sha256: hash(rows.join('\n'))};
  };
  for (const {tablename} of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw Error('TABLE_NAME_INVALID');
    await digest(`content.${tablename}`, `SELECT to_jsonb(t) AS row FROM content.${tablename} t`);
  }
  for (const table of ['batch_run', 'batch_report', 'batch_checkpoint', 'batch_queue', 'batch_confirmation']) {
    await digest(table, `SELECT to_jsonb(t) AS row FROM collect.${table} t`);
  }
  await digest('retained_items', 'SELECT to_jsonb(t) AS row FROM collect.batch_item t WHERE NOT(id=ANY($1::uuid[]))', [ids]);
  await digest('retained_reviews', 'SELECT to_jsonb(t) AS row FROM collect.batch_review t WHERE NOT(item_id=ANY($1::uuid[]))', [ids]);
  await digest('retained_media', 'SELECT to_jsonb(t) AS row FROM collect.batch_media t WHERE NOT(item_id=ANY($1::uuid[]))', [ids]);
  await digest('retained_retention', 'SELECT to_jsonb(t) AS row FROM collect.batch_retention t WHERE NOT(item_id=ANY($1::uuid[]))', [ids]);
  return result;
}
// A session-local owner function grants capabilities only to the exact locked
// unreviewed manifest. No trigger, role grant, deadline or backup gate is changed.
const maintenance = `CREATE FUNCTION pg_temp.clear_manifest(expected uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,collect,pg_temp AS $$
DECLARE actual uuid[]; tx xid8:=pg_current_xact_id(); removed integer;
BEGIN
  IF current_database()<>'blariyo_local' OR session_user<>'blariyo_local' THEN RAISE EXCEPTION 'LOCAL_ONLY'; END IF;
  SELECT array_agg(i.id ORDER BY i.id) INTO actual FROM collect.batch_item i
    LEFT JOIN collect.batch_review r ON r.item_id=i.id
    WHERE (r.item_id IS NULL OR r.status='REVIEWING') AND r.post_id IS NULL;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'MANIFEST_CHANGED'; END IF;
  IF EXISTS(SELECT 1 FROM collect.batch_run WHERE state='RUNNING') OR
     EXISTS(SELECT 1 FROM collect.batch_queue WHERE state IN ('QUEUED','RUNNING')) THEN RAISE EXCEPTION 'COLLECTION_NOT_IDLE'; END IF;
  INSERT INTO collect.batch_purge_scope SELECT tx,'batch_item',unnest(expected);
  INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media',id FROM collect.batch_media WHERE item_id=ANY(expected);
  INSERT INTO collect.batch_purge_scope SELECT tx,'batch_failure',id FROM collect.batch_failure WHERE item_id=ANY(expected);
  INSERT INTO collect.batch_purge_scope SELECT tx,'batch_media_correction',c.operation_id
    FROM collect.batch_media_correction c JOIN collect.batch_media m ON m.id=c.media_id WHERE m.item_id=ANY(expected);
  CREATE TEMP TABLE cleared_dedup ON COMMIT DROP AS
    SELECT r.dedup_id FROM collect.batch_retention r JOIN collect.batch_item i ON i.id=r.item_id
    WHERE r.item_id=ANY(expected) AND r.dedup_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM content.board_post p WHERE p.source_url=i.canonical_url);
  DELETE FROM collect.batch_review_request WHERE scope IN
    (SELECT 'batch:review:'||unnest(expected) UNION ALL SELECT 'batch:draft:'||unnest(expected));
  DELETE FROM collect.batch_review WHERE item_id=ANY(expected) AND status='REVIEWING' AND post_id IS NULL;
  DELETE FROM collect.batch_media_correction WHERE media_id IN (SELECT id FROM collect.batch_media WHERE item_id=ANY(expected));
  DELETE FROM collect.batch_failure WHERE item_id=ANY(expected);
  DELETE FROM collect.batch_media WHERE item_id=ANY(expected);
  DELETE FROM collect.batch_item WHERE id=ANY(expected);
  GET DIAGNOSTICS removed=ROW_COUNT;
  DELETE FROM collect.batch_purge_object WHERE item_id=ANY(expected);
  DELETE FROM collect.batch_retention WHERE item_id=ANY(expected);
  DELETE FROM collect.batch_dedup_key d WHERE d.id IN (SELECT dedup_id FROM cleared_dedup)
    AND NOT EXISTS(SELECT 1 FROM collect.batch_retention r WHERE r.dedup_id=d.id)
    AND NOT EXISTS(SELECT 1 FROM content.post_collection_origin o WHERE o.dedup_id=d.id);
  DELETE FROM collect.batch_purge_scope WHERE transaction_id=tx;
  RETURN removed;
END $$`;

let committed = false;
try {
  await client.connect();
  await query('SELECT collect.lock_retention_restore()');
  await query('BEGIN');
  await query("SET LOCAL lock_timeout='5s'");
  // Allow reads and pg_dump; fence application/collector writes for the snapshot.
  const tables = (await query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('collect','content') ORDER BY schemaname,tablename")).rows;
  for (const {schemaname, tablename} of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw Error('TABLE_NAME_INVALID');
    await query(`LOCK TABLE ${schemaname}.${tablename} IN SHARE ROW EXCLUSIVE MODE`);
  }
  const ids = (await query(selection)).rows.map(row => row.id);
  if (!ids.length) throw Error('NO_UNREVIEWED_ITEMS');
  if ((await query("SELECT 1 FROM collect.batch_queue WHERE state IN ('QUEUED','RUNNING') LIMIT 1")).rowCount) throw Error('QUEUE_NOT_IDLE');
  const before = await protectedSnapshot(ids);
  const objects = (await query(`SELECT raw_object_key AS key FROM collect.batch_item WHERE id=ANY($1::uuid[]) AND raw_object_key IS NOT NULL
    UNION SELECT object_key FROM collect.batch_media WHERE item_id=ANY($1::uuid[]) AND object_key IS NOT NULL`, [ids])).rows.map(row => row.key);
  objects.forEach(checkedPath);
  await mkdir(backup, {recursive: true, mode: 0o700});
  const dump = join(backup, 'database.dump');
  const output = openSync(dump, 'wx', 0o600);
  const dumped = spawnSync('docker', ['exec', 'blariyo-m0-core-local-postgresql-1', 'pg_dump', '-U', 'blariyo_local', '-d', 'blariyo_local', '-Fc'], {stdio: ['ignore', output, 'pipe']});
  closeSync(output);
  if (dumped.status !== 0) throw Error('BACKUP_DUMP_FAILED');
  const input = openSync(dump, 'r');
  const listed = spawnSync('docker', ['exec', '-i', 'blariyo-m0-core-local-postgresql-1', 'pg_restore', '--list'], {stdio: [input, 'ignore', 'pipe']});
  closeSync(input);
  if (listed.status !== 0) throw Error('BACKUP_ARCHIVE_INVALID');
  await cp(objectRoot, join(backup, 'objects'), {recursive: true, errorOnExist: true, force: false});
  const originalObjects = await inventory(objectRoot);
  const copiedObjects = await inventory(join(backup, 'objects'));
  if (JSON.stringify(originalObjects) !== JSON.stringify(copiedObjects)) throw Error('OBJECT_BACKUP_MISMATCH');
  const manifest = {createdAt: new Date().toISOString(), database: 'blariyo_local', ids, objects, before,
    dumpSha256: hash(await readFile(dump)), objectInventory: copiedObjects};
  await writeFile(join(backup, 'manifest.json'), JSON.stringify(manifest, null, 2), {mode: 0o600, flag: 'wx'});
  await query(maintenance);
  await query('REVOKE ALL ON FUNCTION pg_temp.clear_manifest(uuid[]) FROM PUBLIC');
  // Exercise the exact deletion and preservation assertions, then roll it back.
  await query('SAVEPOINT rehearsal');
  const rehearsal = (await query('SELECT pg_temp.clear_manifest($1::uuid[]) AS removed', [ids])).rows[0];
  if (rehearsal.removed !== ids.length || JSON.stringify(before) !== JSON.stringify(await protectedSnapshot(ids))) throw Error('REHEARSAL_PRESERVATION_FAILED');
  await query('ROLLBACK TO SAVEPOINT rehearsal');
  const result = (await query('SELECT pg_temp.clear_manifest($1::uuid[]) AS removed', [ids])).rows[0];
  if (result.removed !== ids.length || JSON.stringify(before) !== JSON.stringify(await protectedSnapshot(ids))) throw Error('PRESERVATION_FAILED');
  if ((await query(selection)).rowCount !== 0) throw Error('UNREVIEWED_REMAIN');
  await query('COMMIT');
  committed = true;
  // Remove only backed-up exact keys, and keep any key still referenced elsewhere.
  let deletedObjects = 0;
  for (const key of objects) {
    const references = await query(`SELECT 1 FROM collect.batch_item WHERE raw_object_key=$1
      UNION ALL SELECT 1 FROM collect.batch_media WHERE object_key=$1
      UNION ALL SELECT 1 FROM collect.batch_report WHERE object_key=$1
      UNION ALL SELECT 1 FROM content.board_post_image WHERE private_storage_key=$1 OR public_storage_key=$1
      UNION ALL SELECT 1 FROM collect.batch_purge_object WHERE object_key=$1 LIMIT 1`, [key]);
    if (references.rowCount) continue;
    const path = checkedPath(key);
    const original = originalObjects.find(entry => entry.key === key);
    if (!original) continue; // Already absent before maintenance; recorded in manifest.
    if (hash(await readFile(path)) !== original.sha256) throw Error('OBJECT_CHANGED_AFTER_BACKUP');
    await unlink(path);
    deletedObjects++;
  }
  const receipt = {completedAt: new Date().toISOString(), removed: result.removed, deletedObjects,
    preserved: before, rehearsal: 'PASS_ROLLED_BACK', backup};
  await writeFile(join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2), {mode: 0o600, flag: 'wx'});
  console.log(JSON.stringify({removed: result.removed, deletedObjects, backup, preservation: 'PASS', rehearsal: 'PASS_ROLLED_BACK'}));
} catch (error) {
  if (!committed) await query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({error: error.message, databaseCommitted: committed, backup}));
  process.exitCode = 1;
} finally {
  await query('SELECT collect.unlock_retention_restore()').catch(() => {});
  await client.end();
}
