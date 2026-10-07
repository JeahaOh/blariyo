import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { DatabaseContext } from '../dist/persistence/database.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';
import { localStorage } from '../dist/adapters/storage.js';
import { DiscordDeleteClient } from '../dist/features/collection/discord-cleanup.js';
import { ReviewAuthority, type DiscordReviewSettings } from '../dist/features/collection/review-authority.js';
import { reviewSlot } from '../dist/features/collection/discord-review.service.js';
import { BatchReviewService } from '../dist/features/collection/batch-review.service.js';
import type { ReviewDelivery } from '../dist/features/collection/discord-review.repository.js';
import type { MessageObservation } from '../dist/features/collection/discord-review-policy.js';
const databaseUrl=process.env.TEST_NEST_DATABASE_URL;
if(!databaseUrl)throw new Error('TEST_NEST_DATABASE_URL required');
await test('Discord HTTP export, chunked scans, current approval after expiry, async cleanup and admin preemption',async t=>{
  const migration=await migrationContext(databaseUrl);
  try{await migration.get(MigrationsService).migrate();}finally{await migration.close();}
  const root=await mkdtemp('/private/tmp/blariyo-discord-api-');t.after(()=>rm(root,{recursive:true,force:true}));
  const settings:DiscordReviewSettings={environment:'local_test',guildId:'111111111111111111',channelId:'222222222222222222',
    exportSince:'2026-01-01T00:00:00.000Z',botTokenFile:root+'/bot',workerTokenFile:root+'/worker',reviewersFile:root+'/reviewers',adminOperatorsFile:root+'/operators',actorSecretFile:root+'/actor'};
  const workerToken=randomBytes(32).toString('hex'),serviceToken=randomBytes(32).toString('hex');
  for(const [path,value] of [[settings.botTokenFile,'b'.repeat(60)],[settings.workerTokenFile,workerToken],[settings.actorSecretFile,randomBytes(32).toString('hex')],
    [settings.reviewersFile,JSON.stringify([{discordUserId:'333333333333333333',operatorId:'fixture-owner'}])],
    [settings.adminOperatorsFile,JSON.stringify([{identity:'fixture-subject',operatorId:'fixture-owner',role:'OWNER',active:true}])]]){
    assert.ok(path&&value);await writeFile(path,value,{mode:0o600});
  }
  const app=await createNestApplication({databaseUrl,storage:localStorage(root+'/objects'),collectBatchReviewEnabled:true,discordReview:settings,serviceToken});
  t.after(()=>app.close());await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  const db=app.get(DatabaseContext),query=(sql:string,p?:unknown[])=>db.source.query(sql,p);
  const calls:string[]=[];const discord=app.get(DiscordDeleteClient);
  discord.deleteHead=async(_channel,id)=>{assert.equal(db.manager,db.source.manager);calls.push(id);};
  discord.deleteThread=async(_channel,id)=>{assert.equal(db.manager,db.source.manager);calls.push(id);};
  await query(await readFile('apps/collector/src/main/resources/db/collector-v002.sql','utf8'));
  const lifecycle=await readFile('apps/collector/src/main/resources/db/collector-v004.sql','utf8');await query(lifecycle.slice(0,lifecycle.indexOf('CREATE OR REPLACE FUNCTION')));
  await query(await readFile('apps/collector/src/main/resources/db/collector-v007.sql','utf8'));
  await query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','example.invalid','fixture-v1')");
  const run=randomUUID();await query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'fixture','hot','WRITE_DB','COMPLETED',1,10,10000)",[run]);
  async function fixture(){
    const id=randomUUID(),url='https://example.invalid/'+id;
    await query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,sns_links,version,fetched_at)
      VALUES($1::uuid,$2,'fixture',$1::uuid::text,$3,$4,'FETCHED','검수 시험',$5,'[]',1,clock_timestamp())`,[id,run,url,createHash('sha256').update(url).digest(),JSON.stringify([{type:'TEXT',text:'유지 문장입니다. 제외 문장입니다.'}])]);
    return id;
  }
  async function api(path:string,value?:unknown,scope='maintenance',expected=200){
    const response=await fetch(base+'/internal/discord-review/v1'+path,{method:value===undefined?'GET':'POST',
      headers:{'Content-Type':'application/json','X-Blariyo-Review-Token':workerToken,'X-Blariyo-Review-Scope':scope},...(value===undefined?{}:{body:JSON.stringify(value)})});
    const result:unknown=await response.json();assert.equal(response.status,expected,JSON.stringify(result));
    return expected===200?requiredRow([requiredRow([result]).data]):requiredRow([result]);
  }
  const authority=app.get(ReviewAuthority),actor=authority.reviewers().get('333333333333333333')?.actor;assert.ok(actor);
  async function admin(id:string,action:string){
    const item=(await app.get(BatchReviewService).detail(id)).item;
    const response=await fetch(base+`/api/v1/admin/collect/batch-items/${id}/commands`,{method:'POST',headers:{'Content-Type':'application/json',
      'X-Blariyo-Service-Token':serviceToken,'X-Blariyo-Admin-Actor':actor!,'X-Blariyo-Admin-Role':'OWNER','Idempotency-Key':randomUUID()},
      body:JSON.stringify({action,itemVersion:item.version,lockVersion:item.review.lockVersion,contentDigest:item.contentDigest})});
    const data:unknown=await response.json();assert.equal(response.status,200,JSON.stringify(data));return requiredRow([requiredRow([data]).data]);
  }
  const unauthorized=await fetch(base+'/internal/discord-review/v1/runtime');assert.equal(unauthorized.status,401);
  assert.equal((await api('/runtime')).channelId,settings.channelId);
  await api('/runtime',undefined,'export',403);
  let sequence=555555555555555550n;
  async function exported(id:string):Promise<ReviewDelivery>{
    const claim=await api('/export/claim',{workerId:'fixture'},'export');const d=requiredRow([claim.delivery]);assert.equal(d.itemId,id);
    const ack=(event:string,extra:Record<string,unknown>={})=>api(`/deliveries/${String(d.id)}/ack`,{event,leaseToken:d.leaseToken,generation:d.generation,...extra},'export');
    await api(`/deliveries/${String(d.id)}/ack`,{event:'READY',leaseToken:d.leaseToken,generation:d.generation},'export',409);
    await ack('HEAD_BEGIN');const head=String(sequence++);await ack('HEAD_SENT',{messageId:head});await ack('THREAD_BEGIN');await ack('THREAD_SENT',{messageId:head});
    const parts=rows(d.parts);
    for(const p of parts){await ack('PART_BEGIN',{ordinal:p.ordinal});const messageId=String(sequence++);await ack('PART_SENT',{ordinal:p.ordinal,messageId});await ack('PART_SEEDED',{ordinal:p.ordinal});p.messageId=messageId;}
    await ack('HEAD_SEEDED');await ack('READY');
    const snapshot=requiredRow(await query('SELECT manifest,ready_at,expires_at FROM collect.discord_review_delivery WHERE id=$1',[d.id]));
    assert.ok(!JSON.stringify(snapshot.manifest).includes('문장'));assert.ok(snapshot.ready_at instanceof Date&&snapshot.expires_at instanceof Date);
    assert.equal(snapshot.expires_at.getTime()-snapshot.ready_at.getTime(),48*3600000);
    // Decode through actual API schema in scanNext, not trusting the raw test cast.
    return {id:String(d.id),itemId:id,itemVersion:1,contentDigest:String(d.contentDigest),number:Number(d.number),state:'READY',generation:Number(d.generation),
      channelId:settings.channelId,guildId:settings.guildId,headMessageId:head,threadId:head,headSeeded:true,headSendState:'SENT',headNonce:String(d.headNonce),leaseToken:null,readyAt:snapshot.ready_at.toISOString(),
      parts:parts.map(p=>({ordinal:Number(p.ordinal),unitId:String(p.unitId),fragmentIndex:Number(p.fragmentIndex),kind:String(p.kind),imagePosition:null,messageId:String(p.messageId),sendState:'SENT',seeded:true,nonce:String(p.nonce)}))};
  }
  const item=await fixture(),delivery=await exported(item);
  async function scan(messages:MessageObservation[]){
    const claimed=requiredRow([(await api('/scan/claim',{workerId:'fixture'},'scan')).scan]);const scan={scanId:claimed.id,leaseToken:claimed.leaseToken};
    const next=requiredRow([(await api('/scan/next',scan,'scan')).delivery]);assert.equal(next.id,delivery.id);
    await api('/scan/chunk',{...scan,deliveryId:delivery.id,index:0,messages:messages.slice(0,1)},'scan');
    await api('/scan/chunk',{...scan,deliveryId:delivery.id,index:0,messages:messages.slice(0,1)},'scan');
    await api('/scan/chunk',{...scan,deliveryId:delivery.id,index:1,messages:messages.slice(1)},'scan');
    const result=await api('/scan/finish',{...scan,deliveryId:delivery.id},'scan');
    assert.equal((await api('/scan/next',scan,'scan')).delivery,null);return result;
  }
  const human={id:'333333333333333333',bot:false};
  const observations:MessageObservation[]=[{messageId:delivery.headMessageId!,complete:true,reactions:[]},...delivery.parts.map(p=>({messageId:p.messageId!,complete:true,reactions:[]}))];
  assert.equal((await scan(observations)).result,'UNAPPROVED');
  await query("UPDATE collect.discord_review_scan_run SET scheduled_slot=scheduled_slot-interval '1 day'");
  await query("UPDATE collect.discord_review_delivery SET ready_at=statement_timestamp()-interval '49 hours',expires_at=statement_timestamp()-interval '1 hour' WHERE id=$1",[delivery.id]);
  observations[0]!.reactions=[{emoji:'👍',users:[human],complete:true}];observations[2]!.reactions=[{emoji:'😐',users:[human],complete:true}];
  assert.equal((await scan(observations)).result,'APPROVED','current thumbs up wins even after 48 hours');
  const jobs=await api('/jobs');assert.ok(Array.isArray(jobs.commands));const command=String(jobs.commands[0]);
  assert.equal((await api(`/commands/${command}/advance`,{workerId:'fixture'})).stage,'DRAFTED');
  assert.equal((await api(`/commands/${command}/advance`,{workerId:'fixture'})).stage,'PUBLISHED');
  assert.equal((await api(`/commands/${command}/advance`,{workerId:'fixture'})).stage,'PUBLISHED');
  const contents=rows(await query('SELECT text_content FROM content.board_post_block'));assert.deepEqual(contents.map(x=>x.text_content),['유지 문장입니다.']);
  for(let i=0;i<50&&calls.length<2;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls.length,2);
  const status=await fetch(base+`/api/v1/admin/collect/batch-items/${item}/commands/status`,{headers:{'X-Blariyo-Service-Token':serviceToken,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':'OWNER'}});
  assert.equal(status.status,200,await status.text());
  const interrupted=await fixture(),claim=requiredRow([(await api('/export/claim',{workerId:'fixture'},'export')).delivery]);
  await api(`/deliveries/${String(claim.id)}/ack`,{event:'HEAD_BEGIN',leaseToken:claim.leaseToken,generation:claim.generation},'export');
  await admin(interrupted,'REJECT');
  await api(`/deliveries/${String(claim.id)}/ack`,{event:'HEAD_SENT',messageId:String(sequence++),leaseToken:claim.leaseToken,generation:claim.generation},'export');
  await api(`/deliveries/${String(claim.id)}/ack`,{event:'THREAD_BEGIN',leaseToken:claim.leaseToken,generation:claim.generation},'export',409);
  const late=requiredRow(await query('SELECT state,cleanup_state,head_message_id FROM collect.discord_review_delivery WHERE id=$1',[claim.id]));
  assert.equal(late.state,'CANCELLED');assert.equal(late.cleanup_state,'PENDING');assert.ok(late.head_message_id);
  assert.equal(reviewSlot(Date.parse('2026-10-08T07:29:00+09:00')),'2026-10-07T08:00:00.000Z');
});
