import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';

const execute=promisify(execFile);
await test('D01-T4/T5: real retention JVM, restricted DB role, object failure and late PUT',async t=>{
  const database=process.env.TEST_NEST_DATABASE_URL;assert.ok(database);
  const javaHome=process.env.JAVA_HOME;assert.ok(javaHome,'Java25 required; no skip');
  const migration=await migrationContext(database);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const db=await createDataSource(database).initialize();
  const owner=db.createQueryRunner();await owner.connect();
  const role='retention_'+randomBytes(6).toString('hex');
  const root=await mkdtemp('/private/tmp/blariyo-retention-worker-');
  let created=false;
  t.after(async()=>{
    try {
      await owner.query('SELECT pg_advisory_unlock_all()');await owner.release();
      if(created){await db.query(`DROP OWNED BY ${role}`);await db.query(`DROP ROLE ${role}`);}
    } finally {await db.destroy();await rm(root,{recursive:true,force:true});}
  });
  for(const version of ['002','003','004','005','006','007'])await db.transaction(async manager=>{
    await manager.query(await readFile(`apps/collector/src/main/resources/db/collector-v${version}.sql`,'utf8'));
  });
  // Seed real pre-V008 rows at historical times, then migrate with every ownership trigger enabled.
  const legacySource='legacy-'+randomUUID(),emptyRun=randomUUID(),oldQueue=randomUUID(),oldConfirmation=randomUUID();
  const reportKey=`collect/report/${emptyRun}.jsonl`;
  await owner.query('SELECT pg_advisory_lock(hashtextextended($1,0))',['collector-source:'+legacySource]);
  await owner.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES($1,'example.invalid','fixture')",[legacySource]);
  await owner.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms,started_at) VALUES($1,$2,'manual','WRITE_DB','RUNNING',1,1,10000,clock_timestamp()-interval '29 days')",[emptyRun,legacySource]);
  await owner.query("INSERT INTO collect.batch_checkpoint(run_id,state) VALUES($1,'{\"canary\":\"CANARY_AUXILIARY\"}')",[emptyRun]);
  await owner.query('INSERT INTO collect.batch_report(run_id,object_key,sha256,jsonl_count) VALUES($1,$2,$3,1)',[emptyRun,reportKey,createHash('sha256').update('CANARY_AUXILIARY').digest()]);
  await owner.query("UPDATE collect.batch_run SET state='COMPLETED',finished_at=clock_timestamp(),checkpoint='{\"canary\":\"CANARY_AUXILIARY\"}',report_object_key=$2,version=version+1 WHERE id=$1",[emptyRun,reportKey]);
  await owner.query("INSERT INTO collect.batch_queue(id,source_key,source_post_key,canonical_url,canonical_url_hash,created_at) VALUES($1,$2,'CANARY_AUXILIARY','https://example.invalid/CANARY_AUXILIARY',sha256('queue'::bytea),clock_timestamp()-interval '25 hours')",[oldQueue,legacySource]);
  await owner.query("INSERT INTO collect.batch_confirmation(id,trigger_hmac,actor_hmac,channel_hmac,source_key,source_post_key,canonical_url,expires_at) VALUES($1,$2,$2,$2,$3,'CANARY_AUXILIARY','https://example.invalid/CANARY_AUXILIARY',clock_timestamp()-interval '1 minute')",[oldConfirmation,'a'.repeat(64),legacySource]);
  await mkdir(resolve(root,reportKey,'..'),{recursive:true});await writeFile(resolve(root,reportKey),'CANARY_AUXILIARY');
  await db.transaction(async manager=>{await manager.query(await readFile('apps/collector/src/main/resources/db/collector-v008.sql','utf8'));});
  await db.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);created=true;
  await db.query(`GRANT USAGE ON SCHEMA collect TO ${role}`);
  await db.query(`GRANT EXECUTE ON FUNCTION collect.claim_retention(uuid,integer),collect.heartbeat_retention(uuid,uuid,bigint),
    collect.retention_objects(uuid,uuid,bigint),collect.record_purge_inventory(uuid,uuid,bigint,text),
    collect.record_purge_result(uuid,uuid,bigint,text,boolean,text),collect.fail_retention(uuid,uuid,bigint),
    collect.finish_retention(uuid,uuid,bigint),collect.observe_retention_object(text,boolean),collect.cleanup_retention_ledger(),collect.cleanup_retention_metadata(),collect.prepare_expired_run_retention(),collect.lock_retention_restore(),collect.unlock_retention_restore() TO ${role}`);
  const cp=(await readFile('apps/collector/build/fixture-classpath.txt','utf8')).trim();
  const target=new URL(database);
  const worker=async(extra:Record<string,string>={})=>{
    const result=await execute(resolve(javaHome,'bin/java'),['-cp',cp,'com.blariyo.collector.run.RetentionFixtureMain'],{
      timeout:30000,maxBuffer:1024*1024,env:{...process.env,RETENTION_FIXTURE_JDBC:`jdbc:postgresql://${target.host}${target.pathname}`,
        RETENTION_FIXTURE_USER:role,RETENTION_FIXTURE_PASSWORD:'',RETENTION_FIXTURE_DIRECTORY:root,...extra}
    });
    const value:unknown=JSON.parse(result.stdout);assert.ok(value && typeof value==='object');
    return Object.fromEntries(Object.entries(value));
  };
  const item=randomUUID(),run=randomUUID(),source='retention-'+randomUUID(),url='https://example.invalid/'+item;
  const key=`collect/raw/${run}/${item}.html`, media=`collect/media/${run}/${item}/1`;
  const correctedMedia=randomUUID(),correction=randomUUID(),correctedKey=`collect/media/${run}/${item}/2`,itemReport=`collect/report/${run}.jsonl`;
  await owner.query('SELECT pg_advisory_lock(hashtextextended($1,0))',['collector-source:'+source]);
  await owner.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES($1,'example.invalid','fixture')",[source]);
  await owner.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,$2,'manual','WRITE_DB','RUNNING',1,1,10000)",[run,source]);
  await owner.query("INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state) VALUES($1::uuid,$2,$3,$1::text,$4,$5,'FETCHING')",[item,run,source,url,createHash('sha256').update(url).digest()]);
  const canaryHash=createHash('sha256').update('CANARY_RETENTION').digest(),canarySize=Buffer.byteLength('CANARY_RETENTION');
  await owner.query("INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,sha256,mime_type,byte_size,object_key) VALUES($1,$2,2,'IMAGE','https://example.invalid/CANARY_RETENTION',$3,'image/jpeg',$4,$5)",[correctedMedia,item,canaryHash,canarySize,correctedKey]);
  await owner.query("UPDATE collect.batch_item SET state='FETCHED',title='CANARY_RETENTION',body_blocks='[{\"type\":\"TEXT\",\"text\":\"CANARY_RETENTION\"},{\"type\":\"IMAGE\",\"imagePosition\":2}]',raw_object_key=$2,fetched_at=clock_timestamp(),version=version+1 WHERE id=$1",[item,key]);
  await owner.query("INSERT INTO collect.batch_checkpoint(run_id,state) VALUES($1,'{\"canary\":\"CANARY_RETENTION\"}')",[run]);
  await owner.query('INSERT INTO collect.batch_report(run_id,object_key,sha256,jsonl_count) VALUES($1,$2,$3,1)',[run,itemReport,canaryHash]);
  await owner.query("UPDATE collect.batch_run SET state='COMPLETED',finished_at=clock_timestamp(),checkpoint='{\"canary\":\"CANARY_RETENTION\"}',report_object_key=$2,version=version+1 WHERE id=$1",[run,itemReport]);
  await owner.query("SELECT collect.correct_batch_media_mime($1,$2,'image/jpeg','image/png',$3,$4,1,0,'FIXTURE_MIME')",[correction,correctedMedia,canaryHash,canarySize]);
  assert.ok(JSON.stringify(requiredRow(await db.query('SELECT before_row FROM collect.batch_media_correction WHERE operation_id=$1',[correction]))).includes('CANARY_RETENTION'));
  await owner.query("INSERT INTO collect.batch_review_request(actor,scope,request_key,digest,response_status,response_data) VALUES($1,$2,$3,$4,200,'{\"body\":\"CANARY_RETENTION\"}')",['admin:v1:'+Buffer.alloc(32,4).toString('base64url'),'batch:review:'+item,randomUUID(),canaryHash]);
  for(const file of [key,media,correctedKey,itemReport,'private/protected']){
    await mkdir(resolve(root,file,'..'),{recursive:true});await writeFile(resolve(root,file),'CANARY_RETENTION');
  }
  const state=async()=>requiredRow(await db.query('SELECT * FROM collect.batch_retention WHERE item_id=$1',[item]));
  await t.test('restricted login cannot read/delete payload or invoke private capabilities',async()=>{
    const restrictedUrl=new URL(database);restrictedUrl.username=role;restrictedUrl.password='';
    const restricted=await createDataSource(restrictedUrl.href).initialize();
    try {
      for(const sql of ['SELECT * FROM collect.batch_item','DELETE FROM collect.batch_item','SELECT * FROM content.board_post',
        'UPDATE collect.batch_retention_control SET selective_backup_verified=true',"SELECT collect.purge_authorized('batch_item',gen_random_uuid())"])
        await assert.rejects(restricted.query(sql),{code:'42501'});
    } finally {await restricted.destroy();}
  });
  await t.test('backup gate is closed; 403 preserves the failed manifest and blocks logical access',async()=>{
    await assert.rejects(worker());
    await db.query("UPDATE collect.batch_retention_control SET selective_backup_verified=true,backup_receipt_hash=sha256('fixture'::bytea)");
    assert.equal((await worker()).purged,1);await access(resolve(root,key));
    await assert.rejects(access(resolve(root,reportKey)),{code:'ENOENT'});
    const expiredQueue=requiredRow(await db.query('SELECT state,canonical_url,source_post_key FROM collect.batch_queue WHERE id=$1',[oldQueue]));
    assert.equal(expiredQueue.state,'EXPIRED');assert.equal(expiredQueue.canonical_url,null);assert.equal(expiredQueue.source_post_key,null);
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_confirmation WHERE id=$1',[oldConfirmation])).n,'0');
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_checkpoint WHERE run_id=$1',[emptyRun])).n,'0');
    assert.deepEqual(requiredRow(await db.query('SELECT checkpoint FROM collect.batch_run WHERE id=$1',[emptyRun])).checkpoint,{});
    await db.query('UPDATE collect.batch_retention SET expires_at=clock_timestamp() WHERE item_id=$1',[item]);
    const failed=await worker({RETENTION_FIXTURE_FAIL_KEY:key});assert.equal(failed.failed,1);
    assert.equal((await state()).retention_state,'PURGE_FAILED');assert.equal((await state()).purged_at,null);
    await access(resolve(root,key));await assert.rejects(db.query('SELECT collect.assert_item_live($1)',[item]),/BATCH_ITEM_EXPIRED/);
    assert.equal(requiredRow(await db.query('SELECT last_error_code FROM collect.batch_purge_object WHERE item_id=$1 AND object_key=$2',[item,key])).last_error_code,'OBJECT_FORBIDDEN');
  });
  await t.test('timeout retains evidence; a JVM crash after DELETE is resumed after lease expiry',async()=>{
    await db.query('UPDATE collect.batch_retention SET next_attempt_at=clock_timestamp() WHERE item_id=$1',[item]);
    assert.equal((await worker({RETENTION_FIXTURE_FAIL_KEY:key,RETENTION_FIXTURE_FAIL_CODE:'OBJECT_TIMEOUT'})).failed,1);
    assert.equal(requiredRow(await db.query('SELECT last_error_code FROM collect.batch_purge_object WHERE item_id=$1 AND object_key=$2',[item,key])).last_error_code,'OBJECT_TIMEOUT');
    await db.query('UPDATE collect.batch_retention SET next_attempt_at=clock_timestamp() WHERE item_id=$1',[item]);
    await assert.rejects(worker({RETENTION_FIXTURE_CRASH_KEY:key}));
    await assert.rejects(access(resolve(root,key)),{code:'ENOENT'});
    assert.equal((await state()).retention_state,'PURGE_PENDING');
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_item WHERE id=$1',[item])).n,'1');
    await db.query("UPDATE collect.batch_retention SET purge_lease_until=clock_timestamp()-interval '1 second' WHERE item_id=$1",[item]);
  });
  await t.test('another JVM retries durably, deletes raw/unrecorded media, preserves content and dedup',async()=>{
    await db.query('UPDATE collect.batch_retention SET next_attempt_at=clock_timestamp() WHERE item_id=$1',[item]);
    assert.equal((await worker()).purged,1);
    for(const file of [key,media,correctedKey,itemReport])await assert.rejects(access(resolve(root,file)),{code:'ENOENT'});
    await access(resolve(root,'private/protected'));
    assert.equal((await state()).retention_state,'PURGED');
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_item WHERE id=$1',[item])).n,'0');
    assert.equal(requiredRow(await db.query('SELECT collect.lookup_dedup($1,$2,$3) id',[source,item,url])).id,(await state()).dedup_id);
    for(const table of ['batch_media','batch_media_correction','batch_report','batch_checkpoint','batch_review_request','batch_run']) {
      const remaining:unknown=await db.query(`SELECT to_jsonb(t) row FROM collect.${table} t`);
      assert.equal(JSON.stringify(remaining).includes('CANARY_RETENTION'),false,table+' retained original canary');
    }
  });
  await t.test('late PUT reopens PURGED and is removed by the next inventory',async()=>{
    await writeFile(resolve(root,key),'CANARY_LATE_PUT');
    assert.equal((await worker()).purged,1);await assert.rejects(access(resolve(root,key)),{code:'ENOENT'});
    assert.equal((await state()).retention_state,'PURGED');
  });
  await t.test('quiesced restore inventory removes orphan collect objects immediately and keeps private copies',async()=>{
    const writer=db.createQueryRunner();await writer.connect();
    try {
      assert.equal(requiredRow(await writer.query('SELECT collect.lock_collection_writer() locked')).locked,true);
      await assert.rejects(worker({RETENTION_FIXTURE_RESTORE:'true'}));
      await writer.query('SELECT collect.unlock_collection_writer()');
      assert.equal(requiredRow(await writer.query('SELECT collect.lock_retention_restore() locked')).locked,true);
      assert.equal(requiredRow(await db.query('SELECT collect.lock_collection_writer() locked')).locked,false);
      await writer.query('SELECT collect.unlock_retention_restore()');
    } finally {await writer.query('SELECT pg_advisory_unlock_all()');await writer.release();}
    const orphan=`collect/raw/${randomUUID()}/${randomUUID()}.html`;
    await mkdir(resolve(root,orphan,'..'),{recursive:true});await writeFile(resolve(root,orphan),'CANARY_RESTORE_ORPHAN');
    await assert.rejects(worker());await access(resolve(root,orphan));
    assert.equal((await worker({RETENTION_FIXTURE_RESTORE:'true'})).purged,1);
    await assert.rejects(access(resolve(root,orphan)),{code:'ENOENT'});await access(resolve(root,'private/protected'));
  });
  await t.test('completed manifests and run shells expire after seven days; permanent identity survives',async()=>{
    await db.query("UPDATE collect.batch_retention SET purged_at=clock_timestamp()-interval '7 days' WHERE retention_state='PURGED'");
    assert.equal((await worker()).failed,0);
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_retention')).n,'0');
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_purge_object')).n,'0');
    assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_run WHERE id=ANY($1::uuid[])',[[run,emptyRun]])).n,'0');
    assert.ok(requiredRow(await db.query('SELECT collect.lookup_dedup($1,$2,$3) id',[source,item,url])).id);
  });
});
