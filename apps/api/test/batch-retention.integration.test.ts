import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';

await test('D01: real PostgreSQL lifecycle, first review, immutable dedup and commit deadline', async (t) => {
  const url = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(url);
  const migration = await migrationContext(url);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const db = await createDataSource(url).initialize();
  const connection = db.createQueryRunner();
  t.after(async () => {
    try { if (!connection.isReleased) { await connection.query('SELECT pg_advisory_unlock_all()'); await connection.release(); } }
    finally { await db.destroy(); }
  });
  // Actual additive Collector SQL, including existing ownership/immutability triggers.
  for (const version of ['002', '003', '004', '005', '006', '007', '008']) {
    await db.transaction(async manager => {
      await manager.query(await readFile(`apps/collector/src/main/resources/db/collector-v${version}.sql`, 'utf8'));
    });
  }
  await connection.connect();
  const actor = 'admin:v1:' + Buffer.alloc(32, 3).toString('base64url');
  const digest = createHash('sha256').update('synthetic content').digest();
  const seed = async () => {
    const item = randomUUID(), run = randomUUID(), source = 'fixture-' + randomUUID();
    const canonical = 'https://example.invalid/' + item;
    await connection.query('SELECT pg_advisory_lock(hashtextextended($1,0))', ['collector-source:' + source]);
    await connection.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES($1,'example.invalid','fixture')", [source]);
    await connection.query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms)
      VALUES($1,$2,'manual','WRITE_DB','RUNNING',1,1,10000)`, [run, source]);
    await connection.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state)
      VALUES($1::uuid,$2,$3,$1::text,$4,$5,'FETCHING')`, [item, run, source, canonical, createHash('sha256').update(canonical).digest()]);
    await connection.query(`UPDATE collect.batch_item SET state='FETCHED',title='fixture',body_blocks='[{"type":"TEXT","text":"fixture"}]',
      raw_object_key=$2,fetched_at=clock_timestamp(),version=version+1 WHERE id=$1`, [item, `collect/raw/${run}/${item}.html`]);
    return { item, run, source, canonical };
  };
  const review = async (item: string) => {
    await connection.query(`INSERT INTO collect.batch_review(item_id,item_version,content_digest,source_key,source_post_key,
      canonical_url_hash,status,updated_by) SELECT id,version,$2,source_key,source_post_key,canonical_url_hash,'REVIEWING',$3
      FROM collect.batch_item WHERE id=$1`, [item, digest, actor]);
  };
  const lifecycle = async (item: string) => requiredRow(await connection.query('SELECT * FROM collect.batch_retention WHERE item_id=$1', [item]));
  await t.test('D01-T1: fixed database instants reject exact equality in UTC and KST', async () => {
    for (const zone of ['UTC', 'Asia/Seoul']) {
      await connection.query("SELECT set_config('TimeZone',$1,false)", [zone]);
      const result = requiredRow(await connection.query(`SELECT
        collect.retention_accessible('2026-10-01T00:00:00Z','LIVE','2026-09-30T23:59:59.999Z') before,
        collect.retention_accessible('2026-10-01T00:00:00Z','LIVE','2026-10-01T00:00:00Z') boundary,
        collect.retention_accessible('2026-10-01T00:00:00Z','PURGE_FAILED','2026-09-30T00:00:00Z') failed`));
      assert.equal(result.before, true); assert.equal(result.boundary, false); assert.equal(result.failed, false);
    }
    await connection.query("SET TimeZone='UTC'");
  });
  await t.test('D01-T2: day 27 approval gets seven days; re-review does not restart the clock', async () => {
    const { item } = await seed();
    await connection.query(`UPDATE collect.batch_retention SET collected_at=clock_timestamp()-interval '27 days',
      expires_at=clock_timestamp()+interval '1 day' WHERE item_id=$1`, [item]);
    await review(item);
    await connection.query("UPDATE collect.batch_review SET status='APPROVED',lock_version=lock_version+1 WHERE item_id=$1", [item]);
    const approved = await lifecycle(item);
    assert.ok(approved.review_finalized_at instanceof Date && approved.expires_at instanceof Date && approved.collected_at instanceof Date);
    assert.equal(approved.expires_at.getTime() - approved.review_finalized_at.getTime(), 7 * 86400000);
    assert.ok(approved.expires_at.getTime() - approved.collected_at.getTime() >= 34 * 86400000);
    await connection.query("UPDATE collect.batch_review SET status='REVIEWING',lock_version=lock_version+1 WHERE item_id=$1", [item]);
    await connection.query("UPDATE collect.batch_review SET status='REJECTED',lock_version=lock_version+1 WHERE item_id=$1", [item]);
    const rejected = await lifecycle(item);
    assert.deepEqual(rejected.review_finalized_at, approved.review_finalized_at);
    assert.deepEqual(rejected.expires_at, approved.expires_at);
    await assert.rejects(connection.query("SELECT collect.finalize_retention($1,999,'REJECTED')", [item]), /RETENTION_REVIEW_VERSION_CONFLICT/);
  });
  await t.test('D01-T2/T3: an expired item and a transaction crossing the original deadline cannot commit review', async () => {
    const first = await seed();
    await connection.query("UPDATE collect.batch_retention SET collected_at=clock_timestamp()-interval '28 days',expires_at=clock_timestamp() WHERE item_id=$1", [first.item]);
    await assert.rejects(review(first.item), /BATCH_ITEM_EXPIRED/);
    const second = await seed();
    await review(second.item);
    await connection.query("UPDATE collect.batch_retention SET expires_at=clock_timestamp()+interval '1 second' WHERE item_id=$1", [second.item]);
    await connection.startTransaction();
    try {
      await connection.query("UPDATE collect.batch_review SET status='APPROVED',lock_version=lock_version+1 WHERE item_id=$1", [second.item]);
      await connection.query('SELECT pg_sleep(1.1)');
      await assert.rejects(connection.commitTransaction(), /BATCH_ITEM_EXPIRED/);
    } finally { if (connection.isTransactionActive) await connection.rollbackTransaction(); }
    assert.equal(requiredRow(await connection.query('SELECT status FROM collect.batch_review WHERE item_id=$1', [second.item])).status, 'REVIEWING');
    assert.equal((await lifecycle(second.item)).review_finalized_at, null);
  });
  await t.test('D01: length-prefix hashes, minimal permanent columns and cross-source conflict', async () => {
    const result = requiredRow(await connection.query("SELECT collect.identity_hash('ab','c')=collect.identity_hash('a','bc') collision"));
    assert.equal(result.collision, false);
    const { item, source, canonical } = await seed();
    const retained = await lifecycle(item);
    assert.equal(requiredRow(await connection.query('SELECT collect.lookup_dedup($1,$2,$3) id', [source, item, canonical])).id, retained.dedup_id);
    await assert.rejects(connection.query('SELECT collect.lookup_dedup($1,$2,$3)', ['other-source', item, canonical]), /DEDUP_IDENTITY_CONFLICT/);
    const columns: unknown = await connection.query("SELECT column_name FROM information_schema.columns WHERE table_schema='collect' AND table_name='batch_dedup_key' ORDER BY ordinal_position");
    assert.deepEqual(columns, ['id','source_key','normalization_version','post_key_hash','canonical_hash'].map(column_name => ({ column_name })));
    await assert.rejects(connection.query('DELETE FROM collect.batch_item WHERE id=$1', [item]), /BATCH_ITEM_IMMUTABLE/);
    await assert.rejects(connection.query("UPDATE collect.batch_item SET title='mutated',version=version+1 WHERE id=$1", [item]), /BATCH_ITEM_TRANSITION/);
  });
  await t.test('D01-T3: concurrent purge skips a promotion lock; expired commit rolls back the post and purge wins next',async()=>{
    const {item}=await seed();await review(item);
    await db.query("UPDATE collect.batch_retention_control SET selective_backup_verified=true,backup_receipt_hash=sha256('race fixture'::bytea)");
    await db.query("UPDATE collect.batch_retention SET expires_at=clock_timestamp()+interval '1 second' WHERE item_id=$1",[item]);
    await connection.startTransaction();
    let postId:unknown;
    try {
      await connection.query("SELECT pg_advisory_xact_lock(hashtextextended('batch-review:'||$1,0))",[item]);
      await connection.query("UPDATE collect.batch_review SET status='APPROVED',lock_version=lock_version+1 WHERE item_id=$1",[item]);
      postId=requiredRow(await connection.query("INSERT INTO content.board_post(board_id,title,status,created_by,created_at,updated_by,updated_at) VALUES(1,'race fixture','DRAFT',$1,now(),$1,now()) RETURNING id",[actor])).id;
      await connection.query('UPDATE collect.batch_review SET post_id=$2,lock_version=lock_version+1 WHERE item_id=$1',[item,postId]);
      await connection.query('SELECT pg_sleep(1.1)');
      assert.equal(rows(await db.query('SELECT * FROM collect.claim_retention($1,20) WHERE item_id=$2',[randomUUID(),item])).length,0);
      await assert.rejects(connection.commitTransaction(),/BATCH_ITEM_EXPIRED/);
    } finally {if(connection.isTransactionActive)await connection.rollbackTransaction();}
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM content.board_post WHERE id=$1',[postId])).n,'0');
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM content.post_collection_origin WHERE post_id=$1',[postId])).n,'0');
    assert.equal(rows(await db.query('SELECT * FROM collect.claim_retention($1,20) WHERE item_id=$2',[randomUUID(),item])).length,1);
    await assert.rejects(connection.query("UPDATE collect.batch_review SET status='APPROVED',lock_version=lock_version+1 WHERE item_id=$1",[item]),/BATCH_ITEM_EXPIRED/);
    await db.query('UPDATE collect.batch_retention_control SET selective_backup_verified=false,backup_receipt_hash=NULL');
  });
  await t.test('D01: gated purge keeps its manifest on failure, rejects stale owners and removes only expired payload',async()=>{
    const {item,source,canonical}=await seed();
    await review(item);
    const before=await lifecycle(item),owner=randomUUID();
    await assert.rejects(connection.query('SELECT * FROM collect.claim_retention($1,20)',[owner]),/RETENTION_BACKUP_GATE_CLOSED/);
    await connection.query("UPDATE collect.batch_retention_control SET selective_backup_verified=true,backup_receipt_hash=sha256('synthetic restore receipt'::bytea)");
    await connection.query('UPDATE collect.batch_retention SET expires_at=clock_timestamp() WHERE item_id=$1',[item]);
    const first=requiredRow(await connection.query('SELECT * FROM collect.claim_retention($1,20) WHERE item_id=$2',[owner,item]));
    const objects=rows(await connection.query('SELECT * FROM collect.retention_objects($1,$2,$3)',[item,owner,first.version]));
    assert.equal(objects.length,1);
    const key=objects[0]?.object_key;assert.equal(typeof key,'string');
    await connection.query("SELECT collect.record_purge_result($1,$2,$3,$4,false,'OBJECT_FORBIDDEN')",[item,owner,first.version,key]);
    await assert.rejects(connection.query('SELECT collect.finish_retention($1,$2,$3)',[item,owner,first.version]),/PURGE_OBJECTS_REMAIN/);
    await connection.query('SELECT collect.fail_retention($1,$2,$3)',[item,owner,first.version]);
    assert.equal((await lifecycle(item)).retention_state,'PURGE_FAILED');
    assert.equal((await lifecycle(item)).purged_at,null);
    await assert.rejects(connection.query('SELECT collect.assert_item_live($1)',[item]),/BATCH_ITEM_EXPIRED/);
    await connection.query('UPDATE collect.batch_retention SET next_attempt_at=clock_timestamp() WHERE item_id=$1',[item]);
    const nextOwner=randomUUID();
    const second=requiredRow(await connection.query('SELECT * FROM collect.claim_retention($1,20) WHERE item_id=$2',[nextOwner,item]));
    await assert.rejects(connection.query('SELECT collect.finish_retention($1,$2,$3)',[item,owner,first.version]),/PURGE_LEASE_LOST/);
    await assert.rejects(connection.query("SELECT collect.record_purge_inventory($1,$2,$3,'content/private/protected')",[item,nextOwner,second.version]),/PURGE_OBJECT_SCOPE/);
    await connection.query('SELECT collect.record_purge_result($1,$2,$3,$4,true)',[item,nextOwner,second.version,key]);
    await connection.query('SELECT collect.finish_retention($1,$2,$3)',[item,nextOwner,second.version]);
    assert.equal((await lifecycle(item)).retention_state,'PURGED');
    assert.equal(requiredRow(await connection.query('SELECT count(*) n FROM collect.batch_item WHERE id=$1',[item])).n,'0');
    assert.equal(requiredRow(await connection.query('SELECT count(*) n FROM collect.batch_review WHERE item_id=$1',[item])).n,'0');
    assert.equal(requiredRow(await connection.query('SELECT count(*) n FROM collect.batch_purge_scope')).n,'0');
    assert.equal(requiredRow(await connection.query('SELECT collect.lookup_dedup($1,$2,$3) id',[source,item,canonical])).id,before.dedup_id);
  });
});
