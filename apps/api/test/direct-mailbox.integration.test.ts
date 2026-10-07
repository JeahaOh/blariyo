import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createDataSource, DatabaseContext } from '../dist/persistence/database.js';
import { TypeOrmMigrationsRepository } from '../dist/persistence/migrations.repository.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { contractSuccess,contractError } from './contract-response.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { directIdentityHash } from '../dist/features/collection/direct-url.js';

await test('D02: PostgreSQL mailbox transaction, fencing and safe runtime projection', async t => {
 const url=process.env.TEST_NEST_DATABASE_URL; assert.ok(url);
 const migration=await migrationContext(url);
 try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
 const db=await createDataSource(url).initialize();
 const c=db.createQueryRunner(), other=db.createQueryRunner();
 t.after(async()=>{ await c.release(); await other.release(); await db.destroy(); });
 // Use the real migration chain: runtime interval constraints changed in V015.
 const migrationTarget=new URL(url), javaHome=process.env.JAVA_HOME;assert.ok(javaHome);
 const migrationCp=(await readFile('apps/collector/build/fixture-classpath.txt','utf8')).trim();
 await promisify(execFile)(resolve(javaHome,'bin/java'),['-cp',migrationCp,'com.blariyo.collector.ops.MigrationMain'],{
  timeout:30000,env:{...process.env,COLLECTOR_DB_URL:`jdbc:postgresql://${migrationTarget.host}${migrationTarget.pathname}`,
   COLLECTOR_DB_USER:decodeURIComponent(migrationTarget.username),COLLECTOR_DB_PASSWORD:decodeURIComponent(migrationTarget.password)}
 });
 await c.connect(); await other.connect();
 const actor='admin:v1:'+Buffer.alloc(32,4).toString('base64url');
 const seed=async()=>{
  const id=randomUUID(), source='web-'+id, canonical='https://example.invalid/'+id;
  await c.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES($1,'example.invalid','fixture')",[source]);
  await c.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,
   canonical_url,canonical_hash,post_key_hash,normalization_version,requested_at,accept_before)
   SELECT $1::uuid,$2,$1::text,sha256($1::text::bytea),$3::text,$4::text,collect.identity_hash('v1',$4::text),
    collect.identity_hash('v1',$3,$1::text),1,at,at+interval '24 hours'
   FROM (SELECT clock_timestamp()::timestamptz(3) at) time`,[id,actor,source,canonical]);
  return {id,source,canonical};
 };
 const claim=async(id:string)=>requiredRow(await c.query('SELECT * FROM collect.claim_web_requests(20) WHERE request_id=$1',[id]));
 await t.test('hashes match TypeScript length-prefixed UTF-8, including Unicode',async()=>{
  for(const values of [['v1','https://example.invalid/한글'],['v1','source','00123'],['ab','c']]){
   const value=requiredRow(await c.query('SELECT collect.identity_hash(VARIADIC $1::text[]) hash',[values]));
   assert.deepEqual(value.hash,directIdentityHash(...values));
  }
 });
 await t.test('claim skips locked requests; rollback leaves no queue, receipt or consumed lease',async()=>{
  const request=await seed();
  await c.startTransaction();
  try {
   await claim(request.id);
   assert.equal(rows(await other.query('SELECT * FROM collect.claim_web_requests(20)')).length,0);
   await assert.rejects(c.query('SELECT collect.ack_web_request($1,$2)',[request.id,randomUUID()]),/WEB_REQUEST_LEASE_CONFLICT/);
  } finally {await c.rollbackTransaction();}
  assert.equal(requiredRow(await c.query('SELECT lease_token FROM collect.web_collection_request WHERE id=$1',[request.id])).lease_token,null);
  await c.startTransaction();
  const lease=await claim(request.id);
  await c.query("INSERT INTO collect.batch_input_receipt(request_id,state) VALUES($1,'DUPLICATE')",[request.id]);
  await c.query('SELECT collect.ack_web_request($1,$2)',[request.id,lease.lease_token]);
  await c.rollbackTransaction();
  assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_input_receipt WHERE request_id=$1',[request.id])).n,'0');
  assert.equal(requiredRow(await c.query('SELECT canonical_url FROM collect.web_collection_request WHERE id=$1',[request.id])).canonical_url,request.canonical);
  await c.startTransaction();
  const next=await claim(request.id);
  await c.query("INSERT INTO collect.batch_input_receipt(request_id,state) VALUES($1,'DUPLICATE')",[request.id]);
  await c.query('SELECT collect.ack_web_request($1,$2)',[request.id,next.lease_token]);
  await c.commitTransaction();
  const closed=requiredRow(await c.query('SELECT * FROM collect.web_collection_request WHERE id=$1',[request.id]));
  assert.equal(closed.canonical_url,null); assert.equal(closed.lease_token,null); assert.ok(closed.closed_at instanceof Date);
 });
 await t.test('queue and initial receipt commit atomically; transitions increase version and close request',async()=>{
  const request=await seed(), queue=randomUUID();
  await c.startTransaction();
  try {
   const lease=await claim(request.id);
   await c.query(`INSERT INTO collect.batch_queue(id,source_key,source_post_key,canonical_url,canonical_url_hash,created_at)
    SELECT $1,$2,$3::text,$4::text,sha256(convert_to($4::text,'UTF8')),requested_at FROM collect.web_collection_request WHERE id=$3::uuid`,[queue,request.source,request.id,request.canonical]);
   await c.query("INSERT INTO collect.batch_input_receipt(request_id,queue_id,state) VALUES($1,$2,'ACCEPTED')",[request.id,queue]);
   await c.query('SELECT collect.ack_web_request($1,$2)',[request.id,lease.lease_token]);
   await c.commitTransaction();
  }catch(error){await c.rollbackTransaction();throw error;}
  await assert.rejects(c.query('DELETE FROM collect.batch_input_receipt WHERE request_id=$1',[request.id]),/INPUT_RECEIPT_NOT_EXPIRED/);
  await c.query('SELECT pg_advisory_lock(hashtextextended($1,0))',['collector-source:'+request.source]);
  try {
   await c.query("UPDATE collect.batch_queue SET state='RUNNING',attempts=attempts+1,version=version+1 WHERE id=$1",[queue]);
   let result=requiredRow(await c.query('SELECT * FROM collect.batch_input_projection WHERE request_id=$1',[request.id]));
   assert.equal(result.state,'RUNNING'); assert.equal(result.version,'2'); assert.equal('queue_id' in result,false);
   await c.query("UPDATE collect.batch_queue SET state='FAILED',error_code='BATCH_OWNER_LOST',owner_backend_pid=NULL,version=version+1 WHERE id=$1",[queue]);
   result=requiredRow(await c.query('SELECT * FROM collect.batch_input_projection WHERE request_id=$1',[request.id]));
   assert.equal(result.state,'FAILED'); assert.equal(result.version,'3'); assert.equal(result.retryable,true);
   assert.ok(requiredRow(await c.query('SELECT closed_at FROM collect.web_collection_request WHERE id=$1',[request.id])).closed_at instanceof Date);
   assert.equal(requiredRow(await c.query('SELECT canonical_url FROM collect.batch_queue WHERE id=$1',[queue])).canonical_url,null);
  }finally{await c.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['collector-source:'+request.source]);}
 });
 await t.test('runtime absent/current/conflict expose only explicit safe fields; foreign keys rejected',async()=>{
  const request=await seed(), instance=randomUUID();
  assert.equal(requiredRow(await c.query('SELECT * FROM collect.batch_runtime_projection WHERE source_key=$1',[request.source])).freshness,'ABSENT');
  const policy={enabled:true,blockedReason:null,collectionPolicy:'DETAIL_ONLY',allowedHosts:['example.invalid'],requestIntervalMs:10000,
   dailyRequestLimit:100,maxPages:1,maxItems:1,mediaLimits:{maxImages:200,maxFileBytes:31457280,maxTotalBytes:157286400}};
  const insert='INSERT INTO collect.batch_source_runtime(instance_id,source_key,config_version,normalization_version,effective_policy) VALUES($1,$2,$3,1,$4)';
  await c.query(insert,[instance,request.source,'a'.repeat(64),policy]);
  assert.equal(requiredRow(await c.query('SELECT * FROM collect.batch_runtime_projection WHERE source_key=$1',[request.source])).freshness,'CURRENT');
  await assert.rejects(c.query(insert,[randomUUID(),request.source,'b'.repeat(64),{...policy,credential:'forbidden-fixture'}]),/check constraint/);
  await c.query(insert,[randomUUID(),request.source,'b'.repeat(64),policy]);
  assert.equal(requiredRow(await c.query('SELECT * FROM collect.batch_runtime_projection WHERE source_key=$1',[request.source])).freshness,'CONFLICT');
  await assert.rejects(c.query('SELECT * FROM collect.claim_web_requests(21)'),/WEB_CLAIM_LIMIT_INVALID/);
 });
 await t.test('actual Java pull under restricted login, restart no duplicate queue, denied cross-owner access',async()=>{
  const batchRole='mail_batch_'+randomUUID().replaceAll('-',''), apiRole='mail_api_'+randomUUID().replaceAll('-','');
  for(const role of [batchRole,apiRole])await c.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
  try {
   await c.query(`GRANT USAGE ON SCHEMA collect TO ${batchRole};
    GRANT SELECT,INSERT,UPDATE ON collect.batch_source,collect.batch_source_runtime,collect.batch_input_receipt,collect.batch_queue TO ${batchRole};
    GRANT DELETE ON collect.batch_source_runtime TO ${batchRole}; GRANT SELECT ON collect.batch_runtime_projection TO ${batchRole};
    GRANT EXECUTE ON FUNCTION collect.retention_backlog(),collect.claim_web_requests(integer),collect.ack_web_request(uuid,uuid),
     collect.cleanup_input_receipts(),collect.web_retry_accessible(uuid),collect.lookup_dedup(text,text,text),collect.purge_authorized(text,uuid),collect.assert_source_owner(text) TO ${batchRole}`);
   await new TypeOrmMigrationsRepository(new DatabaseContext(db)).grantApplication(apiRole);
   for(const role of [batchRole,apiRole]) {
    const address=new URL(url);address.username=role;address.password='';
    const restricted=await createDataSource(address.href).initialize();
    try {
     for(const sql of role===batchRole?['SELECT * FROM collect.web_collection_request','UPDATE collect.web_collection_request SET canonical_url=NULL',
       'SELECT * FROM content.board_post']:['SELECT * FROM collect.batch_queue','SELECT * FROM collect.batch_input_receipt',
       'SELECT * FROM collect.batch_source_runtime','SELECT * FROM collect.claim_web_requests(1)'])
      await assert.rejects(restricted.query(sql),{code:'42501'});
     if(role===apiRole)for(const relation of ['batch_runtime_projection','batch_input_projection'])await restricted.query(`SELECT * FROM collect.${relation}`);
    }finally{await restricted.destroy();}
   }
   const source='mail-fixture-'+randomUUID(),instance=randomUUID(),request=randomUUID(),target=new URL(url);
   const config={approved:true,host:'theqoo.net',parser:'THEQOO',pathPrefixes:['/hot/'],userAgent:'test contact@example.invalid',
    collectionPolicy:'DETAIL_ONLY',requestIntervalMs:5000,dailyRequestLimit:100,maxPages:2,maxItems:20};
   const cp=(await readFile('apps/collector/build/fixture-classpath.txt','utf8')).trim();
   const javaHome=process.env.JAVA_HOME;assert.ok(javaHome);
   const run=async(publishOnly=false,settings:Record<string,unknown>=config,crash='')=>{
    const result=await promisify(execFile)(resolve(javaHome,'bin/java'),['-cp',cp,'com.blariyo.collector.run.MailboxFixtureMain'],{
     timeout:30000,maxBuffer:1024*1024,env:{...process.env,MAILBOX_FIXTURE_JDBC:`jdbc:postgresql://${target.host}${target.pathname}`,
      MAILBOX_FIXTURE_USER:batchRole,MAILBOX_FIXTURE_INSTANCE:instance,MAILBOX_FIXTURE_SOURCES:JSON.stringify({[source]:settings}),
      MAILBOX_FIXTURE_PUBLISH_ONLY:String(publishOnly),MAILBOX_FIXTURE_CRASH:crash}
    });
    return requiredRow([JSON.parse(result.stdout) as unknown]);
   };
   await run(true);
   await c.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_url,
    canonical_hash,post_key_hash,normalization_version,requested_at,accept_before)
    SELECT $1::uuid,$2,$1::text,sha256($1::text::bytea),$3::text,'https://theqoo.net/hot/123',
    collect.identity_hash('v1','https://theqoo.net/hot/123'),collect.identity_hash('v1',$3::text,'123'),1,at,at+interval '24 hours'
    FROM (SELECT clock_timestamp()::timestamptz(3) at) time`,[request,actor,source]);
   // An unrelated expired payload must not stop Web intake; the original TTL still applies.
   const expired=randomUUID();
   await c.query(`INSERT INTO collect.batch_retention(item_id,collected_at,expires_at)
    VALUES($1,clock_timestamp()-interval '29 days',clock_timestamp()-interval '1 day')`,[expired]);
   assert.equal(requiredRow(await c.query('SELECT collect.retention_backlog() backlog')).backlog,true);
   await run();
   await assert.rejects(c.query('SELECT collect.assert_item_live($1)',[expired]),/BATCH_ITEM_EXPIRED/);
   const receipt=requiredRow(await c.query('SELECT * FROM collect.batch_input_receipt WHERE request_id=$1',[request]));
   assert.equal(receipt.state,'ACCEPTED');assert.equal(receipt.version,'1');
   assert.equal(requiredRow(await c.query('SELECT canonical_url FROM collect.web_collection_request WHERE id=$1',[request])).canonical_url,null);
   assert.equal(requiredRow(await c.query("SELECT q.created_at+interval '24 hours'<=w.accept_before deadline FROM collect.batch_queue q JOIN collect.web_collection_request w ON w.id=$1 WHERE q.id=$2",[request,receipt.queue_id])).deadline,true);
   const loaded=requiredRow(await c.query('SELECT loaded_at FROM collect.batch_source_runtime WHERE instance_id=$1',[instance]));
   assert.equal((await run()).accepted,0);
   assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_queue WHERE source_key=$1',[source])).n,'1');
   assert.deepEqual(requiredRow(await c.query('SELECT loaded_at FROM collect.batch_source_runtime WHERE instance_id=$1',[instance])),loaded);
   let post=123,expectedQueues=1;
   for(const phase of ['BEFORE_ACK','AFTER_ACK','AFTER_COMMIT','POLICY_CHANGED']){
    const id=randomUUID(),postKey=String(++post),canonical='https://theqoo.net/hot/'+postKey;
    await c.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_url,
     canonical_hash,post_key_hash,normalization_version,requested_at,accept_before)
     SELECT $1::uuid,$2,$1::text,sha256($1::text::bytea),$3::text,$4::text,
      collect.identity_hash('v1',$4::text),collect.identity_hash('v1',$3::text,$5::text),1,at,at+interval '24 hours'
     FROM (SELECT clock_timestamp()::timestamptz(3) at) time`,[id,actor,source,canonical,postKey]);
    if(phase==='POLICY_CHANGED'){
     await run(false,{...config,approved:false});
     assert.equal(requiredRow(await c.query('SELECT state FROM collect.batch_input_receipt WHERE request_id=$1',[id])).state,'BLOCKED');
    }else{
     await assert.rejects(()=>run(false,config,phase),error=>error instanceof Error&&'code' in error&&error.code===77);
     if(phase!=='AFTER_COMMIT'){
      assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_input_receipt WHERE request_id=$1',[id])).n,'0');
      assert.equal(requiredRow(await c.query('SELECT lease_token FROM collect.web_collection_request WHERE id=$1',[id])).lease_token,null);
     }
     await run();expectedQueues++;
     assert.equal(requiredRow(await c.query('SELECT state FROM collect.batch_input_receipt WHERE request_id=$1',[id])).state,'ACCEPTED');
    }
    assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_queue WHERE source_key=$1',[source])).n,String(expectedQueues));
   }
   await run(true,{...config,dailyRequestLimit:undefined,credential:'MUST_NOT_BE_PUBLISHED'});
   const runtime=requiredRow(await c.query('SELECT effective_policy,config_version FROM collect.batch_runtime_projection WHERE source_key=$1',[source]));
   assert.equal(JSON.stringify(runtime).includes('MUST_NOT_BE_PUBLISHED'),false);
   assert.equal(requiredRow([runtime.effective_policy]).enabled,true);
   assert.equal(requiredRow([runtime.effective_policy]).dailyRequestLimit,5000);
   assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_run WHERE source_key=$1',[source])).n,'0');
  }finally{
   for(const role of [batchRole,apiRole]){await c.query(`DROP OWNED BY ${role}`);await c.query(`DROP ROLE ${role}`);}
  }
 });
 await t.test('real HTTP direct endpoints: feature gate, OWNER/EDITOR, aliases, conflict, limits and no fetch',async()=>{
  const token=randomUUID()+randomUUID(),source='api-'+randomUUID();
  await c.query("INSERT INTO collect.batch_source(source_key,host,policy_version,enabled,identity_parser) VALUES($1,'www.dogdrip.net','fixture',true,'DOGDRIP')",[source]);
  const app=await createNestApplication({databaseUrl:url,serviceToken:token,collectDirectInputEnabled:true});
  await app.listen(0,'127.0.0.1');const origin=await app.getUrl();
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(input,init)=>{
   const address=typeof input==='string'?new URL(input):input instanceof URL?input:new URL(input.url);
   assert.equal(address.hostname,'127.0.0.1','API must never fetch source URLs');return originalFetch(input,init);
  };
  try {
   const headers={'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':'OWNER','Content-Type':'application/json'};
   const endpoint='/api/v1/admin/collect/requests';
   const submit=(key:string,input:string,extra:Record<string,string>={})=>fetch(origin+endpoint,{method:'POST',headers:{...headers,'Idempotency-Key':key,...extra},body:JSON.stringify({url:input})});
   const runtime=await fetch(origin+'/api/v1/admin/collect/runtime-sources',{headers});
   assert.equal(runtime.status,200);const snapshot=await contractSuccess('listRuntimeCollectionSources',runtime);
   const absent=snapshot.data.items.find(item=>item.sourceKey===source);assert.ok(absent);
   assert.equal(absent.freshness,'ABSENT');assert.equal(absent.enabled,null);assert.equal(absent.allowedHosts,null);
   let response=await submit('create-a','https://www.dogdrip.net/123');assert.equal(response.status,202);
   const first=(await contractSuccess('createDirectCollectionRequest',response,'POST')).data;
   assert.equal(first.state,'PENDING');assert.equal(first.version,0);assert.equal(first.configFreshness,'ABSENT');
   for(const [key,raw,extra] of [
    ['create-a','https://www.dogdrip.net/123',{}],
    ['create-b','https://www.dogdrip.net/dogdrip/123',{'X-Blariyo-Admin-Role':'EDITOR'}],
    ['create-c','https://www.dogdrip.net/123',{'X-Blariyo-Admin-Actor':'admin:v1:'+Buffer.alloc(32,9).toString('base64url')}]
   ] as const){
    response=await submit(key,raw,extra);assert.equal(response.status,202);
    assert.equal((await contractSuccess('createDirectCollectionRequest',response,'POST')).data.requestId,first.requestId);
   }
   response=await submit('create-a','https://www.dogdrip.net/dogdrip/123');assert.equal(response.status,409);
   assert.equal((await contractError('createDirectCollectionRequest',response,'POST')).error.code,'IDEMPOTENCY_CONFLICT');
   response=await fetch(origin+endpoint+'/'+first.requestId,{headers:{...headers,'X-Blariyo-Admin-Role':'EDITOR'}});
   assert.equal(response.status,200);await contractSuccess('getDirectCollectionRequest',response);
   response=await fetch(origin+endpoint+'/'+first.requestId+'/retry',{method:'POST',headers:{...headers,'Idempotency-Key':'retry-a'},body:JSON.stringify({expectedVersion:0})});
   assert.equal(response.status,409);assert.equal((await contractError('retryDirectCollectionRequest',response,'POST')).error.code,'REQUEST_RETRY_NOT_ALLOWED');
   for(const bad of ['https://127.0.0.1/private','https://user@www.dogdrip.net/123','https://www.dogdrip.net:443/123','https://www.dogdrip.net/123#fragment']){
    response=await submit(randomUUID(),bad);assert.ok([400,422].includes(response.status),`${bad}: ${response.status} ${await response.clone().text()}`);await contractError('createDirectCollectionRequest',response,'POST');
   }
   response=await submit('role-forged','https://www.dogdrip.net/123',{'X-Blariyo-Admin-Role':'ADMIN'});assert.equal(response.status,403);
   const limitedActor='admin:v1:'+Buffer.alloc(32,10).toString('base64url');
   for(let index=0;index<10;index++){response=await submit('limited-'+index,'https://www.dogdrip.net/123',{'X-Blariyo-Admin-Actor':limitedActor});assert.equal(response.status,202);}
   response=await submit('limited-11','https://www.dogdrip.net/123',{'X-Blariyo-Admin-Actor':limitedActor});
   assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>0);await contractError('createDirectCollectionRequest',response,'POST');
   // Replaying a successful key and GET remain available after the write rate limit.
   response=await submit('limited-0','https://www.dogdrip.net/123',{'X-Blariyo-Admin-Actor':limitedActor});assert.equal(response.status,202);
   assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.web_collection_request WHERE source_key=$1',[source])).n,'1');
   assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_queue WHERE source_key=$1',[source])).n,'0');
   response=await fetch(origin+'/internal/health/ready');assert.equal(response.status,200);
  }finally{globalThis.fetch=originalFetch;await app.close();}
  const disabled=await createNestApplication({databaseUrl:url,serviceToken:token,collectManualUrlEnabled:true});
  try{await disabled.listen(0,'127.0.0.1');assert.equal((await fetch(await disabled.getUrl()+'/api/v1/admin/collect/runtime-sources')).status,404);}
  finally{await disabled.close();}
 });
 await t.test('D02-T2: real 60-second lease expiry rejects old owner and accepts one new owner',async()=>{
  const request=await seed(),first=await claim(request.id);
  await delay(61000);
  const next=await claim(request.id);assert.notEqual(next.lease_token,first.lease_token);
  await assert.rejects(c.query('SELECT collect.ack_web_request($1,$2)',[request.id,first.lease_token]),/WEB_REQUEST_LEASE_CONFLICT/);
  await c.startTransaction();
  try {
   await c.query("INSERT INTO collect.batch_input_receipt(request_id,state,error_code) VALUES($1,'BLOCKED','SOURCE_DISABLED')",[request.id]);
   await c.query('SELECT collect.ack_web_request($1,$2)',[request.id,next.lease_token]);await c.commitTransaction();
  }catch(error){await c.rollbackTransaction();throw error;}
  assert.equal(requiredRow(await c.query('SELECT count(*) n FROM collect.batch_input_receipt WHERE request_id=$1',[request.id])).n,'1');
 });
});
