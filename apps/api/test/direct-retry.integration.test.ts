import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDataSource } from '../dist/persistence/database.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { contractSuccess,contractError } from './contract-response.js';

await test('D02-T5: manual retry identity, idempotency, deadline and deferred commit fences',async t=>{
 const url=process.env.TEST_NEST_DATABASE_URL;assert.ok(url);
 const migration=await migrationContext(url);
 try{await migration.get(MigrationsService).migrate();}finally{await migration.close();}
 const db=await createDataSource(url).initialize(),c=db.createQueryRunner();await c.connect();
 t.after(async()=>{await c.query('SELECT pg_advisory_unlock_all()');await c.release();await db.destroy();});
 for(const version of ['002','003','004','005','006','007','008','009'])
  await db.query(await readFile(`apps/collector/src/main/resources/db/collector-v${version}.sql`,'utf8'));
 const source='retry-'+randomUUID(),actor='admin:v1:'+Buffer.alloc(32,21).toString('base64url'),token=randomUUID()+randomUUID();
 await c.query("INSERT INTO collect.batch_source(source_key,host,policy_version,identity_parser,enabled) VALUES($1,'www.dogdrip.net','fixture','DOGDRIP',true)",[source]);
 await c.query('SELECT pg_advisory_lock(hashtextextended($1,0))',['collector-source:'+source]);
 const app=await createNestApplication({databaseUrl:url,serviceToken:token,collectDirectInputEnabled:true});
 await app.listen(0,'127.0.0.1');t.after(()=>app.close());const origin=await app.getUrl();
 const headers={'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':'EDITOR','Content-Type':'application/json'};
 let sequence=1000;
 const seed=async()=>{
  const id=randomUUID(),item=randomUUID(),run=randomUUID(),post=String(++sequence),canonical='https://www.dogdrip.net/'+post;
  await c.query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms)
   VALUES($1,$2,'manual','WRITE_DB','RUNNING',1,1,10000)`,[run,source]);
  await c.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state)
   VALUES($1,$2,$3,$4,$5::text,sha256(convert_to($5::text,'UTF8')),'FETCHING')`,[item,run,source,post,canonical]);
  await c.query("UPDATE collect.batch_item SET state='FAILED',failure_code='SOURCE_FETCH_FAILED',version=version+1 WHERE id=$1",[item]);
  await c.query(`UPDATE collect.batch_run SET state='FAILED',finished_at=clock_timestamp(),checkpoint='{"reason":"BATCH_OWNER_LOST"}',version=version+1 WHERE id=$1`,[run]);
  await c.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_url,
   canonical_hash,post_key_hash,normalization_version,requested_at,accept_before)
   SELECT $1::uuid,$2,$1::text,sha256($1::text::bytea),$3::text,$4::text,collect.identity_hash('v1',$4::text),
    collect.identity_hash('v1',$3::text,$5::text),1,at,at+interval '24 hours'
   FROM (SELECT clock_timestamp()::timestamptz(3) at) time`,[id,actor,source,canonical,post]);
  await c.startTransaction();
  try{
   const claim=requiredRow(await c.query('SELECT * FROM collect.claim_web_requests(20) WHERE request_id=$1',[id]));
   await c.query("INSERT INTO collect.batch_input_receipt(request_id,item_id,state,error_code,retryable) VALUES($1,$2,'FAILED','SOURCE_FETCH_FAILED',true)",[id,item]);
   await c.query('SELECT collect.ack_web_request($1,$2)',[id,claim.lease_token]);await c.commitTransaction();
  }catch(error){await c.rollbackTransaction();throw error;}
  return {id,item,run,post,canonical};
 };
 const retry=(id:string,key:string,version=1)=>fetch(`${origin}/api/v1/admin/collect/requests/${id}/retry`,{
  method:'POST',headers:{...headers,'Idempotency-Key':key},body:JSON.stringify({expectedVersion:version})});
 const accept=async(id:string,post:string,canonical:string)=>{
  const queue=randomUUID();await c.startTransaction();
  try{
   const claim=requiredRow(await c.query('SELECT * FROM collect.claim_web_requests(20) WHERE request_id=$1',[id]));
   await c.query(`INSERT INTO collect.batch_queue(id,source_key,source_post_key,canonical_url,canonical_url_hash,created_at)
    SELECT $1,$2,$3,$4::text,sha256(convert_to($4::text,'UTF8')),requested_at FROM collect.web_collection_request WHERE id=$5`,[queue,source,post,canonical,id]);
   await c.query("INSERT INTO collect.batch_input_receipt(request_id,queue_id,state) VALUES($1,$2,'ACCEPTED')",[id,queue]);
   await c.query('SELECT collect.ack_web_request($1,$2)',[id,claim.lease_token]);await c.commitTransaction();return queue;
  }catch(error){await c.rollbackTransaction();throw error;}
 };
 await t.test('new request and previous link; same key replay, wrong version, permanent dedup',async()=>{
  const old=await seed();
  let response=await retry(old.id,'wrong-version',2);assert.equal(response.status,409);
  assert.equal((await contractError('retryDirectCollectionRequest',response,'POST')).error.code,'REQUEST_VERSION_CONFLICT');
  response=await retry(old.id,'retry-first');assert.equal(response.status,202);
  const next=(await contractSuccess('retryDirectCollectionRequest',response,'POST')).data;
  assert.notEqual(next.requestId,old.id);assert.equal(next.previousRequestId,old.id);assert.equal(next.version,0);assert.equal(next.state,'PENDING');
  response=await retry(old.id,'retry-first');assert.equal(response.status,202);
  assert.equal((await contractSuccess('retryDirectCollectionRequest',response,'POST')).data.requestId,next.requestId);
  response=await retry(old.id,'retry-first',2);assert.equal(response.status,409);
  assert.equal((await contractError('retryDirectCollectionRequest',response,'POST')).error.code,'IDEMPOTENCY_CONFLICT');
  assert.equal(requiredRow(await c.query('SELECT state FROM collect.batch_input_receipt WHERE request_id=$1',[old.id])).state,'FAILED');
  await accept(next.requestId,old.post,old.canonical);
  const dedup=await seed();await c.query('SELECT collect.register_dedup($1,$2,$3)',[source,dedup.post,dedup.canonical]);
  response=await retry(dedup.id,'dedup-retry');assert.equal(response.status,409);
  assert.equal((await contractError('retryDirectCollectionRequest',response,'POST')).error.code,'REQUEST_RETRY_NOT_ALLOWED');
 });
 await t.test('D02-T1/T4: concurrent key, CONFLICT/disabled rejection and read-only runtime GET',async()=>{
  const submit=(key:string)=>fetch(origin+'/api/v1/admin/collect/requests',{method:'POST',headers:{...headers,'Idempotency-Key':key},body:JSON.stringify({url:'https://www.dogdrip.net/9999'})});
  const pair=await Promise.all([submit('concurrent'),submit('concurrent')]);
  const ids:string[]=[];
  for(const response of pair){
   if(response.status===202)ids.push((await contractSuccess('createDirectCollectionRequest',response,'POST')).data.requestId);
   else{assert.equal(response.status,409);assert.equal((await contractError('createDirectCollectionRequest',response,'POST')).error.code,'IDEMPOTENCY_IN_PROGRESS');}
  }
  assert.ok(ids.length>0);const replay=await submit('concurrent');assert.equal(replay.status,202);
  assert.equal((await contractSuccess('createDirectCollectionRequest',replay,'POST')).data.requestId,ids[0]);assert.equal(new Set(ids).size,1);
  const instance=randomUUID(),second=randomUUID(),policy={enabled:true,blockedReason:null,collectionPolicy:'DETAIL_ONLY',allowedHosts:['www.dogdrip.net'],
   requestIntervalMs:10000,dailyRequestLimit:100,maxPages:1,maxItems:1,mediaLimits:{maxImages:200,maxFileBytes:31457280,maxTotalBytes:157286400}};
  for(const [id,hash] of [[instance,'a'],[second,'b']])await c.query(`INSERT INTO collect.batch_source_runtime(instance_id,source_key,config_version,normalization_version,effective_policy) VALUES($1,$2,$3,1,$4)`,[id,source,hash?.repeat(64),policy]);
  const before=await c.query('SELECT * FROM collect.batch_source_runtime ORDER BY instance_id') as unknown;
  const runtime=await fetch(origin+'/api/v1/admin/collect/runtime-sources',{headers});assert.equal(runtime.status,200);
  assert.equal((await contractSuccess('listRuntimeCollectionSources',runtime)).data.items[0]?.freshness,'CONFLICT');
  assert.deepEqual(await c.query('SELECT * FROM collect.batch_source_runtime ORDER BY instance_id') as unknown,before);
  let response=await submit('conflict');assert.equal(response.status,503);
  assert.equal((await contractError('createDirectCollectionRequest',response,'POST')).error.code,'COLLECTION_UNAVAILABLE');
  await c.query('DELETE FROM collect.batch_source_runtime WHERE instance_id=ANY($1::uuid[])',[[instance,second]]);
  await c.query('UPDATE collect.batch_source SET enabled=false WHERE source_key=$1',[source]);
  response=await submit('disabled');assert.equal(response.status,409);
  assert.equal((await contractError('createDirectCollectionRequest',response,'POST')).error.code,'SOURCE_DISABLED');
  await c.query('UPDATE collect.batch_source SET enabled=true WHERE source_key=$1',[source]);
 });
 await t.test('transaction crossing the original deadline cannot commit a retry mailbox',async()=>{
  const old=await seed(),next=randomUUID();
  await c.query("UPDATE collect.batch_retention SET expires_at=clock_timestamp()+interval '1 second' WHERE item_id=$1",[old.item]);
  await c.startTransaction();
  try{
   await c.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_url,
    canonical_hash,post_key_hash,normalization_version,previous_request_id,requested_at,accept_before)
    SELECT $1::uuid,actor,$1::text,request_hash,source_key,$3,canonical_hash,post_key_hash,normalization_version,id,at,at+interval '24 hours'
    FROM collect.web_collection_request CROSS JOIN (SELECT clock_timestamp()::timestamptz(3) at) time WHERE id=$2`,[next,old.id,old.canonical]);
   await c.query('SELECT pg_sleep(1.1)');
   await assert.rejects(c.commitTransaction(),/REQUEST_RETRY_NOT_ALLOWED/);
  }finally{if(c.isTransactionActive)await c.rollbackTransaction();}
  assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.web_collection_request WHERE id=$1',[next])).n,'0');
 });
 await t.test('original deadline blocks queue claim and in-flight writes; cleanup records EXPIRED',async()=>{
  const waiting=await seed(),waitingResponse=await retry(waiting.id,'waiting-retry');assert.equal(waitingResponse.status,202);
  const waitingRequest=(await contractSuccess('retryDirectCollectionRequest',waitingResponse,'POST')).data;
  const waitingQueue=await accept(waitingRequest.requestId,waiting.post,waiting.canonical);
  const old=await seed(),response=await retry(old.id,'expire-retry');assert.equal(response.status,202);
  const next=(await contractSuccess('retryDirectCollectionRequest',response,'POST')).data;
  const queue=await accept(next.requestId,old.post,old.canonical),run=randomUUID();
  await c.query("UPDATE collect.batch_queue SET state='RUNNING',attempts=attempts+1,version=version+1 WHERE id=$1",[queue]);
  await c.query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms)
   VALUES($1,$2,'manual','WRITE_DB','RUNNING',1,1,10000)`,[run,source]);
  await c.query('UPDATE collect.batch_queue SET active_run_id=$2,version=version+1 WHERE id=$1',[queue,run]);
  await c.query('SELECT collect.assert_run_payload_live($1)',[run]);
  await c.query('UPDATE collect.batch_retention SET expires_at=clock_timestamp() WHERE item_id=ANY($1::uuid[])',[[old.item,waiting.item]]);
  await assert.rejects(c.query('SELECT collect.assert_run_payload_live($1)',[run]),/BATCH_ITEM_EXPIRED/);
  await assert.rejects(c.query("UPDATE collect.batch_queue SET state='RUNNING',attempts=attempts+1,version=version+1 WHERE id=$1",[waitingQueue]),/REQUEST_RETRY_NOT_ALLOWED/);
  await c.query('SELECT collect.cleanup_input_receipts()');
  assert.deepEqual(requiredRow(await c.query('SELECT state,canonical_url FROM collect.batch_queue WHERE id=$1',[queue])),{state:'EXPIRED',canonical_url:null});
  assert.equal(requiredRow(await c.query('SELECT state FROM collect.batch_input_receipt WHERE request_id=$1',[next.requestId])).state,'EXPIRED');
  assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_item WHERE run_id=$1',[run])).n,'0');
  const refused=await retry(old.id,'after-expiry');assert.equal(refused.status,404);
  await contractError('retryDirectCollectionRequest',refused,'POST');
 });

});
