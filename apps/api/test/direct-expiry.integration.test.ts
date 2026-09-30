import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDataSource,DatabaseContext } from '../dist/persistence/database.js';
import { TypeOrmMigrationsRepository } from '../dist/persistence/migrations.repository.js';
import { TypeOrmDirectRequestRepository } from '../dist/persistence/direct-request.repository.js';
import { requiredRow,rows } from '../dist/persistence/rows.js';

await test('D02-T3/T4: historical restore ordering, 24-hour deadline and five-minute heartbeat boundary',async t=>{
 const url=process.env.TEST_NEST_DATABASE_URL;assert.ok(url);
 const db=await createDataSource(url).initialize();t.after(()=>db.destroy());
 const context=new DatabaseContext(db),migrations=new TypeOrmMigrationsRepository(context);
 await migrations.ensureLedger();const scripts=await migrations.scripts();
 for(const script of scripts.filter(value=>value.version<'V010')){await migrations.apply(script.filename);await migrations.record(script,0);}
 const mailbox=scripts.find(value=>value.version==='V010');assert.ok(mailbox);
 const sql=await readFile('apps/api/migrations/'+mailbox.filename,'utf8'),split=sql.indexOf('CREATE FUNCTION collect.guard_web_request()');
 assert.ok(split>0);
 await db.query(sql.slice(0,split));
 // Like a restore's data-before-post-data order, load aged fixture rows before installing their triggers.
 // No active trigger, deployed migration, clock or runtime permission is disabled or changed.
 const expired=randomUUID(),soon=randomUUID(),old=randomUUID(),accepted=randomUUID(),running=randomUUID(),succeeded=randomUUID(),actor='admin:v1:'+Buffer.alloc(32,11).toString('base64url');
 for(const [id,offset,state] of [[expired,'25 hours','PENDING'],[soon,'23 hours 59 minutes 59 seconds','PENDING'],[old,'9 days','DUPLICATE']] as const){
  await db.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_url,canonical_hash,post_key_hash,
   normalization_version,requested_at,accept_before,state,closed_at)
   SELECT $1::uuid,$2,$1::text,sha256($1::text::bytea),'fixture',CASE WHEN $4::text='PENDING' THEN 'https://example.invalid/'||$1::text END,
    sha256($1::text::bytea),sha256($1::text::bytea),1,at,at+interval '24 hours',$4::text,
    CASE WHEN $4::text='DUPLICATE' THEN at END FROM (SELECT (clock_timestamp()-$3::interval)::timestamptz(3) at) time`,[id,actor,offset,state]);
 }
 for(const id of [accepted,running,succeeded]){
  await db.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_hash,post_key_hash,
   normalization_version,requested_at,accept_before,closed_at)
   SELECT $1::uuid,$2,$1::text,sha256($1::text::bytea),'fixture',sha256($1::text::bytea),sha256($1::text::bytea),1,at,at+interval '24 hours',
    CASE WHEN $3::boolean THEN at+interval '1 hour' END FROM (SELECT (clock_timestamp()-interval '25 hours')::timestamptz(3) at) time`,[id,actor,id===succeeded]);
 }
 await db.query(sql.slice(split));await migrations.record(mailbox,0);
 for(const version of ['002','003','004','005','006','007'])await db.query(await readFile(`apps/collector/src/main/resources/db/collector-v${version}.sql`,'utf8'));
 await db.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','example.invalid','restore')");
 const queue=randomUUID();
 await db.query(`INSERT INTO collect.batch_queue(id,source_key,source_post_key,canonical_url,canonical_url_hash,created_at)
  VALUES($1,'fixture','old','https://example.invalid/old',sha256('old'::bytea),clock_timestamp()-interval '25 hours')`,[queue]);
 await db.query(await readFile('apps/collector/src/main/resources/db/collector-v008.sql','utf8'));
 const runtimeSql=await readFile('apps/collector/src/main/resources/db/collector-v009.sql','utf8');
 const runtimeSplit=runtimeSql.indexOf('CREATE FUNCTION collect.guard_source_runtime()');assert.ok(runtimeSplit>0);
 await db.query(runtimeSql.slice(0,runtimeSplit));
 const settings={enabled:true,blockedReason:null,collectionPolicy:'DETAIL_ONLY',allowedHosts:['example.invalid'],requestIntervalMs:10000,
  dailyRequestLimit:100,maxPages:1,maxItems:1,mediaLimits:{maxImages:200,maxFileBytes:31457280,maxTotalBytes:157286400}};
 const instance=randomUUID();
 await db.query(`INSERT INTO collect.batch_source_runtime(instance_id,source_key,config_version,normalization_version,effective_policy,heartbeat_at)
  VALUES($1,'fixture',$2,1,$3,clock_timestamp()-interval '5 minutes')`,[instance,'a'.repeat(64),settings]);
 const receiptSplit=runtimeSql.indexOf('CREATE FUNCTION collect.guard_input_receipt()');assert.ok(receiptSplit>runtimeSplit);
 await db.query(runtimeSql.slice(runtimeSplit,receiptSplit));
 for(const [id,state,version] of [[accepted,'ACCEPTED',1],[running,'RUNNING',2],[succeeded,'SUCCEEDED',3]] as const){
  await db.query(`INSERT INTO collect.batch_input_receipt(request_id,queue_id,state,version,updated_at,terminal_at)
   VALUES($1::uuid,$2::uuid,$3::text,$4::bigint,clock_timestamp()-interval '24 hours',CASE WHEN $3::text='SUCCEEDED' THEN clock_timestamp()-interval '24 hours' END)`,[id,id===accepted?queue:null,state,version]);
 }
 await db.query(runtimeSql.slice(receiptSplit));
 const repository=new TypeOrmDirectRequestRepository(context);
 const acceptedBefore=await repository.request(accepted);
 assert.equal(acceptedBefore?.data.state,'EXPIRED');assert.equal(acceptedBefore?.data.version,2);
 assert.equal(acceptedBefore?.data.updatedAt,acceptedBefore?.data.acceptBefore);assert.equal(acceptedBefore?.data.errorCode,'BATCH_QUEUE_EXPIRED');
 assert.equal((await repository.request(running))?.data.state,'RUNNING');
 assert.equal((await repository.request(succeeded))?.data.state,'SUCCEEDED');
 assert.equal(requiredRow(await db.query('SELECT state FROM collect.batch_input_receipt WHERE request_id=$1',[accepted])).state,'ACCEPTED','GET projection never writes the batch receipt');
 const before=await repository.request(expired);assert.equal(before?.data.state,'EXPIRED');assert.equal(before?.data.version,1);
 assert.equal(before?.data.updatedAt,before?.data.acceptBefore);
 assert.equal(requiredRow(await db.query("SELECT freshness FROM collect.batch_runtime_projection WHERE source_key='fixture'")).freshness,'STALE');
 await db.query('SELECT pg_sleep(1.1)');
 assert.equal((await repository.request(soon))?.data.state,'EXPIRED');
 const claims=rows(await db.query('SELECT * FROM collect.claim_web_requests(20)'));assert.equal(claims.length,0);
 await db.query('SELECT collect.cleanup_web_requests()');
 for(const id of [expired,soon]){
  const row=requiredRow(await db.query('SELECT * FROM collect.web_collection_request WHERE id=$1',[id]));
  assert.equal(row.canonical_url,null);assert.equal(row.state,'EXPIRED');assert.deepEqual(row.closed_at,row.accept_before);
 }
 assert.equal(await repository.request(old),null);
 await db.query("UPDATE collect.batch_retention_control SET selective_backup_verified=true,backup_receipt_hash=sha256('fixture'::bytea)");
 await db.query('SELECT collect.cleanup_retention_metadata()');
 const expiredQueue=requiredRow(await db.query('SELECT state,canonical_url FROM collect.batch_queue WHERE id=$1',[queue]));
 assert.deepEqual(expiredQueue,{state:'EXPIRED',canonical_url:null});
 assert.equal((await repository.request(accepted))?.data.version,2,'batch expiry catches up without a second virtual increment');
 assert.equal((await repository.request(accepted))?.data.state,'EXPIRED');
 assert.equal(requiredRow(await db.query('SELECT count(*) n FROM collect.batch_run')).n,'0');
 await db.query('UPDATE collect.batch_source_runtime SET effective_policy=effective_policy WHERE instance_id=$1',[instance]);
 assert.equal(requiredRow(await db.query("SELECT freshness FROM collect.batch_runtime_projection WHERE source_key='fixture'")).freshness,'CURRENT');
});
