import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { DatabaseContext } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { BatchReviewService } from '../dist/features/collection/batch-review.service.js';
import { ReviewCommandService } from '../dist/features/collection/review-command.service.js';
import { SourcePublishPolicyRepository } from '../dist/features/collection/source-publish-policy.repository.js';
import { SourceAutoPublishService } from '../dist/features/collection/source-auto-publish.service.js';
import { PostsRepository } from '../dist/features/posts/posts.repository.js';
import { PostsService } from '../dist/features/posts/posts.service.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { localStorage } from '../dist/adapters/storage.js';
import { LocalCollectReader } from '../dist/adapters/collect-reader.js';
import { reviewManifest, reviewSelection } from '../dist/features/collection/discord-review-policy.js';
import { collectionDigest } from '../dist/features/collection/collection-url.js';
import { contractSuccess } from './contract-response.js';
import { ReviewAuthority, type DiscordReviewSettings } from '../dist/features/collection/review-authority.js';
import { BatchReviewRepository } from '../dist/features/collection/batch-review.repository.js';
import { ReviewCommandRepository } from '../dist/features/collection/review-command.repository.js';
import { DiscordCleanupDispatcher } from '../dist/features/collection/discord-cleanup.js';
import { TypeOrmMigrationsRepository } from '../dist/persistence/migrations.repository.js';
import { TypeOrmDiscordReviewRepository } from '../dist/persistence/discord-review.repository.js';


await test('source publication opt-in is versioned, isolated from Discord and fenced at publication',async t=>{
  const databaseUrl=process.env.TEST_NEST_DATABASE_URL;assert.ok(databaseUrl);
  const migration=await migrationContext(databaseUrl);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const root=await mkdtemp('/private/tmp/blariyo-auto-publication-');t.after(()=>rm(root,{recursive:true,force:true}));
  const token=randomBytes(32).toString('hex'),actor='admin:v1:'+randomBytes(32).toString('base64url');
  const storage=localStorage(root+'/objects');
  let onPromote: (()=>Promise<void>)|undefined;
  const promote=storage.promote.bind(storage);
  storage.promote=async (...args)=>{const result=await promote(...args);await onPromote?.();return result;};
  const app=await createNestApplication({databaseUrl,serviceToken:token,storage,collectBatchReviewEnabled:true,collectReader:new LocalCollectReader(root+'/batch')});
  t.after(()=>app.close());await app.listen(0,'127.0.0.1');const origin=await app.getUrl();
  const db=app.get(DatabaseContext),work=app.get(UnitOfWork),policies=app.get(SourcePublishPolicyRepository),commands=app.get(ReviewCommandService),batches=app.get(BatchReviewService),auto=app.get(SourceAutoPublishService);
  const query=(sql:string,parameters?:unknown[])=>db.source.query(sql,parameters);
  await query(await readFile('apps/collector/src/main/resources/db/collector-v002.sql','utf8'));
  const lifecycle=await readFile('apps/collector/src/main/resources/db/collector-v004.sql','utf8');
  await query(lifecycle.slice(0,lifecycle.indexOf('CREATE OR REPLACE FUNCTION')));
  await query(await readFile('apps/collector/src/main/resources/db/collector-v007.sql','utf8'));
  await query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('theqoo','example.invalid','fixture-v1'),('todayhumor','example.invalid','fixture-v1')");
  await query(await readFile('apps/collector/src/main/resources/db/collector-v016.sql','utf8'));
  await query("SELECT collect.sync_source_collection_setting('theqoo','https://theqoo.net/hot',true,true,NULL)");
  const settings:DiscordReviewSettings={environment:'local_test',guildId:'111111111111111111',channelId:'222222222222222222',exportSince:new Date(0).toISOString(),botTokenFile:root+'/bot',workerTokenFile:root+'/worker',reviewersFile:root+'/reviewers',adminOperatorsFile:root+'/operators',actorSecretFile:root+'/actor'};
  await writeFile(settings.adminOperatorsFile,JSON.stringify([{identity:'fixture',operatorId:'fixture-owner',role:'OWNER',active:true}]),{mode:0o600});
  await writeFile(settings.reviewersFile,JSON.stringify([{discordUserId:'333333333333333333',operatorId:'fixture-owner'}]),{mode:0o600});
  await writeFile(settings.actorSecretFile,randomBytes(32).toString('hex'),{mode:0o600});
  const authority=new ReviewAuthority(settings),operator=authority.reviewers().get('333333333333333333');assert.ok(operator);
  const adminCommands=new ReviewCommandService(app.get(ReviewCommandRepository),batches,app.get(BatchReviewRepository),work,authority,app.get(DiscordCleanupDispatcher),app.get(PostsService),app.get(PostsRepository),policies);
  const discord=new TypeOrmDiscordReviewRepository(db,settings);
  const base='/api/v1/admin/collect/source-publish-policies';
  const request=(suffix='',body?:unknown,role='OWNER')=>fetch(origin+base+suffix,{method:body===undefined?'GET':'POST',headers:{'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':role,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  async function toggle(enabled:boolean){
    const current=(await policies.list()).find(p=>p.sourceKey==='theqoo');assert.ok(current);
    return work.transaction(()=>policies.update('theqoo',enabled,current.lockVersion,actor));
  }
  const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer();
  async function fixture(options:{source?:string;old?:boolean;missing?:boolean;corrupt?:boolean}={}){
    const source=options.source??'theqoo',run=randomUUID(),id=randomUUID(),url='https://example.invalid/'+id,media=randomUUID(),key=`collect/media/${media}/1`;
    await query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms,started_at)
      VALUES($1,$2,'hot','WRITE_DB','COMPLETED',1,10,10000,clock_timestamp()-$3::interval)`,[run,source,options.old?'1 hour':'0 seconds']);
    await mkdir(root+'/batch/collect/media/'+media,{recursive:true});if(!options.missing)await writeFile(root+'/batch/'+key,options.corrupt?Buffer.from('invalid'):bytes);
    const blocks=[{type:'TEXT',text:'자동 발행 검증 본문입니다.'},{type:'IMAGE',imagePosition:1,alt:'검증 이미지'}];
    await query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,sns_links,version,fetched_at)
      VALUES($1::uuid,$2,$3,$1::uuid::text,$4,$5,'FETCHED','출처 자동 발행 시험',$6,'[]',1,clock_timestamp())`,[id,run,source,url,createHash('sha256').update(url).digest(),JSON.stringify(blocks)]);
    await query(`INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,sha256,mime_type,byte_size,object_key)
      VALUES($1,$2,1,'IMAGE','http://cdn.example.invalid/1.png',$3,'image/png',$4,$5)`,[media,id,createHash('sha256').update(bytes).digest(),bytes.length,key]);
    return id;
  }
  async function accept(id:string){
    const item=(await batches.detail(id)).item,policy=(await policies.list()).find(p=>p.sourceKey===item.sourceKey);assert.ok(policy);
    const selection=reviewSelection(reviewManifest(item.bodyBlocks,item.contentDigest),[]),body={boardSlug:'meme',sourceKey:policy.sourceKey,policyVersion:policy.lockVersion};
    return commands.accept({itemId:id,origin:'AUTO',action:'APPROVE_PUBLISH',actor:'system:collector',operatorId:null,reviewerIds:[],expectedEpoch:0,itemVersion:item.version,reviewVersion:0,contentDigest:item.contentDigest,selectionDigest:selection.digest,excludedUnitIds:[],evidence:{},requestBody:body,requestKey:randomUUID(),requestHash:collectionDigest({id,...body}).toString('hex')});
  }
  await t.test('default is OFF, OWNER-only changes, optimistic concurrency and complete audit',async()=>{
    assert.equal((await fetch(origin+base)).status,401);
    const list=(await contractSuccess('listSourcePublishPolicies',await request())).data;
    assert.equal(list.items.length,21);assert.ok(list.items.every(p=>!p.autoPublishEnabled&&p.lockVersion===0));assert.equal(list.canManage,true);
    assert.equal((await contractSuccess('listSourcePublishPolicies',await request('',undefined,'EDITOR'))).data.canManage,false);
    assert.equal((await request('/theqoo',{autoPublishEnabled:true,lockVersion:0},'EDITOR')).status,403);
    assert.equal((await request('/unknown',{autoPublishEnabled:true,lockVersion:0})).status,404);
    assert.equal((await request('/theqoo',{autoPublishEnabled:true,lockVersion:0,boardSlug:'anything'})).status,400);
    const replies=await Promise.all([request('/theqoo',{autoPublishEnabled:false,lockVersion:0}),request('/theqoo',{autoPublishEnabled:true,lockVersion:0})]);
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
    const saved=replies.find(r=>r.status===200);assert.ok(saved);assert.equal((await contractSuccess('updateSourcePublishPolicy',saved,'POST')).data.lockVersion,1);
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_source_publish_policy_change')).count,'1');
    await toggle(false);
    const id=await fixture();assert.deepEqual(await auto.run(),{});
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_review_command WHERE item_id=$1',[id])).count,'0');
  });
  await t.test('collection and publication save atomically with independent versions and URL',async()=>{
    let current=(await policies.list()).find(p=>p.sourceKey==='theqoo');assert.ok(current);
    assert.equal(current.sourceUrl,'https://theqoo.net/hot');assert.equal(current.collectionEnabled,true);
    const publicationVersion=current.lockVersion;
    const body={autoPublishEnabled:current.autoPublishEnabled,lockVersion:current.lockVersion,collectionEnabled:false,collectionLockVersion:current.collectionLockVersion};
    assert.equal((await request('/theqoo',body,'EDITOR')).status,403);
    assert.equal((await request('/theqoo',{...body,collectionLockVersion:undefined})).status,400);
    const saved=await request('/theqoo',body);assert.equal(saved.status,200);
    const result=(await contractSuccess('updateSourcePublishPolicy',saved,'POST')).data;
    assert.equal(result.collectionEnabled,false);assert.equal(result.lockVersion,publicationVersion);
    assert.equal(result.collectionLockVersion,1);
    assert.equal((await request('/theqoo',{...body,autoPublishEnabled:true})).status,409);
    current=(await policies.list()).find(p=>p.sourceKey==='theqoo');assert.ok(current);assert.equal(current.autoPublishEnabled,false);
    // A conflict on either switch must not partially update the other.
    assert.equal((await request('/theqoo',{...body,lockVersion:0,collectionEnabled:true,collectionLockVersion:1})).status,409);
    assert.equal((await policies.list()).find(p=>p.sourceKey==='theqoo')?.collectionEnabled,false);
    assert.equal((await request('/theqoo',{...body,collectionEnabled:true,collectionLockVersion:1})).status,200);
    assert.equal((await policies.list()).find(p=>p.sourceKey==='theqoo')?.lockVersion,publicationVersion);
    await query("SELECT collect.sync_source_collection_setting('ppomppu','https://www.ppomppu.co.kr/',false,false,'SOURCE_NOT_ALLOWED')");
    assert.equal((await request('/ppomppu',{autoPublishEnabled:true,lockVersion:0,collectionEnabled:true,collectionLockVersion:0})).status,409);
    assert.equal((await policies.list()).find(p=>p.sourceKey==='ppomppu')?.autoPublishEnabled,false);
  });
  await t.test('collection history isolates the latest stored run, successful items and safe failure codes',async()=>{
    const source='inven',old=randomUUID(),latest=randomUUID(),dry=randomUUID(),clean=randomUUID(),item=randomUUID();
    await query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES($1,'example.invalid','history-fixture')",[source]);
    for (const [id,mode,state,started,reason] of [[old,'WRITE_DB','FAILED','2026-01-01T00:00:00Z','SOURCE_FETCH_FAILED'],
      [latest,'WRITE_DB','PARTIAL','2026-01-02T00:00:00Z','BATCH_OWNER_LOST'],[dry,'DRY_RUN','COMPLETED','2026-01-10T00:00:00Z',null]]) {
      await query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms,started_at,checkpoint)
        VALUES($1,$2,'hot',$3,$4,1,10,10000,$5,$6)`,[id,source,mode,state,started,JSON.stringify(reason?{reason}:{})]);
    }
    await query(`INSERT INTO collect.batch_item(id,run_id,source_key,canonical_url,canonical_url_hash,state,fetched_at)
      VALUES($1,$2,$3,'https://example.invalid/history',$4,'FETCHED','2026-01-01T00:01:00Z')`,[item,old,source,createHash('sha256').update(item).digest()]);
    const failures = [[old,'SOURCE_FETCH_FAILED'],[latest,'SOURCE_HTTP_UNAVAILABLE'],[latest,'SOURCE_HTTP_UNAVAILABLE'],[latest,'https://secret.invalid/token']];
    for (const [index,[run,code]] of failures.entries()) {
      const detail = index===1 ? {diagnosticReason:'HTTP_RETRY_EXHAUSTED',requestHost:'example.invalid',httpStatus:503,privateDetail:'fixture-secret',rawBody:'fixture-secret'}
        : {diagnosticReason:'https://secret.invalid/token',requestHost:'https://user:fixture-secret@bad.invalid/?token=fixture-secret',httpStatus:999,privateDetail:'fixture-secret'};
      await query("INSERT INTO collect.batch_failure(id,run_id,phase,code,detail,occurred_at) VALUES($1,$2,'FETCH',$3,$4,$5)",
        [randomUUID(),run,code,JSON.stringify(detail),`2026-01-02T00:01:0${index}Z`]);
    }
    let result=(await contractSuccess('listSourcePublishPolicies',await request())).data.items.find(p=>p.sourceKey===source);assert.ok(result);
    assert.equal(result.lastCollectedAt,'2026-01-01T00:01:00.000Z');assert.equal(result.lastRunAt,'2026-01-02T00:00:00.000Z');assert.equal(result.lastRunState,'PARTIAL');
    assert.deepEqual(result.lastFailureCodes,['BATCH_OWNER_LOST','SOURCE_HTTP_UNAVAILABLE']);
    assert.deepEqual(result.lastFailures,[
      {occurredAt:'2026-01-02T00:01:02.000Z',phase:'FETCH',code:'SOURCE_HTTP_UNAVAILABLE',diagnosticReason:null,requestHost:null,httpStatus:null},
      {occurredAt:'2026-01-02T00:01:01.000Z',phase:'FETCH',code:'SOURCE_HTTP_UNAVAILABLE',diagnosticReason:'HTTP_RETRY_EXHAUSTED',requestHost:'example.invalid',httpStatus:503},
    ]);
    assert.equal(JSON.stringify(result).includes('fixture-secret'),false);
    for(let index=0;index<11;index++) await query("INSERT INTO collect.batch_failure(id,run_id,phase,code,occurred_at) VALUES($1,$2,'LIST','SOURCE_HTTP_UNAVAILABLE',$3)",
      [randomUUID(),latest,`2026-01-02T00:02:${String(index).padStart(2,'0')}Z`]);
    const bounded=(await policies.list()).find(p=>p.sourceKey===source);assert.ok(bounded);
    assert.equal(bounded.lastFailures.length,10);
    const firstFailure=bounded.lastFailures[0],lastFailure=bounded.lastFailures[9];assert.ok(firstFailure);assert.ok(lastFailure);
    assert.equal(firstFailure.occurredAt,'2026-01-02T00:02:10.000Z');assert.equal(lastFailure.occurredAt,'2026-01-02T00:02:01.000Z');
    const absent=(await policies.list()).find(p=>p.sourceKey==='pgr21');assert.ok(absent);assert.equal(absent.lastRunAt,null);assert.equal(absent.lastCollectedAt,null);assert.deepEqual(absent.lastFailureCodes,[]);
    await query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms,started_at)
      VALUES($1,$2,'hot','WRITE_DB','COMPLETED',1,10,10000,'2026-01-03T00:00:00Z')`,[clean,source]);
    result=(await contractSuccess('listSourcePublishPolicies',await request())).data.items.find(p=>p.sourceKey===source);assert.ok(result);
    assert.equal(result.lastRunState,'COMPLETED');assert.equal(result.lastRunAt,'2026-01-03T00:00:00.000Z');assert.deepEqual(result.lastFailureCodes,[]);
    assert.deepEqual(result.lastFailures,[]);
    assert.equal(result.lastCollectedAt,'2026-01-01T00:01:00.000Z');
  });
  await t.test('only enabled source runs started after opt-in publish once without Discord configuration',async()=>{
    const old=await fixture();await toggle(true);const id=await fixture(),other=await fixture({source:'todayhumor'});
    assert.deepEqual((await policies.candidates(20)).map(c=>c.itemId),[id]);
    const discordIds=await discord.candidates(new Date(0).toISOString());assert.ok(!discordIds.includes(id));assert.ok(discordIds.includes(old)&&discordIds.includes(other));
    assert.deepEqual(await auto.run(),{PUBLISHED:1});assert.deepEqual(await auto.run(),{});
    const command=requiredRow(await query('SELECT * FROM collect.batch_review_command WHERE item_id=$1',[id]));
    assert.equal(command.origin,'AUTO');assert.equal(command.actor,'system:collector');assert.equal(command.stage,'PUBLISHED');
    assert.equal(requiredRow(await query("SELECT count(*) FROM content.board_post_status_history WHERE post_id=$1 AND to_status='PUBLISHED'",[command.post_id])).count,'1');
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_review_command WHERE item_id IN ($1,$2)',[old,other])).count,'0');
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.discord_review_delivery')).count,'0');
    await toggle(false);assert.equal((await app.get(PostsRepository).find(String(command.post_id)))?.status,'PUBLISHED');
  });
  await t.test('OFF and policy version changes fence drafts and direct publication',async()=>{
    await toggle(true);const command=await accept(await fixture());
    const draft=await commands.advance(command.id,'fixture');assert.equal(draft.stage,'DRAFTED');assert.ok(draft.postId);
    await toggle(false);const stopped=await commands.advance(command.id,'fixture');assert.equal(stopped.stage,'NEEDS_ADMIN');
    assert.equal(requiredRow(await query('SELECT last_error FROM collect.batch_review_command WHERE id=$1',[command.id])).last_error,'AUTO_PUBLISH_POLICY_CHANGED');assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
    await assert.rejects(app.get(PostsService).command({action:'publish',params:{postId:String(draft.postId)},body:{mode:'IMMEDIATE',lockVersion:1}},actor),{code:'BATCH_REVIEW_COMMAND_REQUIRED'});
    await toggle(true);assert.deepEqual(await auto.run(),{});
  });
  await t.test('OFF during object promotion is rechecked in final DB transaction',async()=>{
    const command=await accept(await fixture()),draft=await commands.advance(command.id,'fixture');assert.equal(draft.stage,'DRAFTED');
    onPromote=async()=>{onPromote=undefined;await toggle(false);};
    const result=await commands.advance(command.id,'fixture');assert.equal(result.stage,'NEEDS_ADMIN');assert.equal(requiredRow(await query('SELECT last_error FROM collect.batch_review_command WHERE id=$1',[command.id])).last_error,'AUTO_PUBLISH_POLICY_CHANGED');
    assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
    assert.equal(requiredRow(await query("SELECT count(*) FROM content.board_post_status_history WHERE post_id=$1 AND to_status='PUBLISHED'",[draft.postId])).count,'0');
  });
  await t.test('an invalid image becomes NEEDS_ADMIN and does not stop the following item',async()=>{
    await toggle(true);const bad=await fixture({corrupt:true}),good=await fixture();
    const result=await auto.run();assert.equal(result.NEEDS_ADMIN,1);assert.equal(result.PUBLISHED,1);
    assert.equal(requiredRow(await query('SELECT stage FROM collect.batch_review_command WHERE item_id=$1',[bad])).stage,'NEEDS_ADMIN');
    assert.equal(requiredRow(await query('SELECT stage FROM collect.batch_review_command WHERE item_id=$1',[good])).stage,'PUBLISHED');
    assert.deepEqual(await auto.run(),{});
  });
  await t.test('administrator rejection takes precedence over an automatic draft',async()=>{
    const id=await fixture(),command=await accept(id),draft=await commands.advance(command.id,'fixture');assert.equal(draft.stage,'DRAFTED');
    const item=(await batches.detail(id)).item,selection=reviewSelection(reviewManifest(item.bodyBlocks,item.contentDigest),[]);
    const rejected=await adminCommands.accept({itemId:id,origin:'ADMIN',action:'REJECT',actor:operator.actor,operatorId:operator.operatorId,reviewerIds:[],expectedEpoch:0,itemVersion:item.version,
      reviewVersion:0,contentDigest:item.contentDigest,selectionDigest:selection.digest,excludedUnitIds:[],evidence:{},requestBody:{},requestKey:randomUUID(),requestHash:'a'.repeat(64)});
    assert.equal(rejected.stage,'REJECTED');assert.equal((await commands.advance(command.id,'fixture')).stage,'CANCELLED');
    assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
    assert.equal((await batches.detail(id)).item.review.status,'REJECTED');
  });
  await t.test('stale Discord export cannot create a delivery for an automatic source',async()=>{
    const id=await fixture(),item=(await batches.detail(id)).item;
    await work.transaction(()=>discord.create(id,item.version,reviewManifest(item.bodyBlocks,item.contentDigest)));
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.discord_review_delivery WHERE item_id=$1',[id])).count,'0');
    assert.equal((await auto.run()).PUBLISHED,1);
  });
  await t.test('storage outage retries only the affected command while other items publish',async()=>{
    const bad=await fixture({missing:true});await fixture();
    assert.deepEqual(await auto.run(),{APPROVED:1,PUBLISHED:1});
    const command=requiredRow(await query('SELECT * FROM collect.batch_review_command WHERE item_id=$1',[bad]));
    assert.equal(command.last_error,'DEPENDENCY_UNAVAILABLE');assert.equal(command.retry_count,1);
    const media=requiredRow(await query('SELECT object_key FROM collect.batch_media WHERE item_id=$1',[bad]));await writeFile(root+'/batch/'+String(media.object_key),bytes);
    await query("UPDATE collect.batch_review_command SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",[command.id]);
    assert.deepEqual(await auto.run(),{PUBLISHED:1});assert.deepEqual(await auto.run(),{});
  });
  await t.test('existing manual decisions and expired items are not automatically accepted',async()=>{
    const manual=await fixture(),expired=await fixture(),item=(await batches.detail(manual)).item;
    await batches.review(manual,{decision:'REJECTED',itemVersion:item.version,lockVersion:0,contentDigest:item.contentDigest},actor,randomUUID());
    await query("UPDATE collect.batch_retention SET collected_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 second' WHERE item_id=$1",[expired]);
    assert.deepEqual(await auto.run(),{});
  });
  await t.test('restricted API role can save audited policy and publish with the same guards',async()=>{
    const role='auto_app_'+randomBytes(6).toString('hex');await query(`CREATE ROLE ${role} NOLOGIN`);
    try {
      await new TypeOrmMigrationsRepository(db).grantApplication(role);
      await toggle(false);await toggle(true);const id=await fixture();
      await work.lock('restricted-auto-publish',async()=>{
        await db.manager.query(`SET ROLE ${role}`);
        try {
          const current=(await policies.list()).find(p=>p.sourceKey==='theqoo');assert.ok(current);
          await work.transaction(()=>policies.update('theqoo',true,current.lockVersion,actor));
          assert.deepEqual(await auto.run(),{PUBLISHED:1});
        } finally {await db.manager.query('RESET ROLE');}
      });
      assert.equal(requiredRow(await query('SELECT stage FROM collect.batch_review_command WHERE item_id=$1',[id])).stage,'PUBLISHED');
    } finally {await query(`DROP OWNED BY ${role}`);await query(`DROP ROLE ${role}`);}
  });
  await t.test('a policy in use prevents destructive migration rollback',async()=>{
    const context=await migrationContext(databaseUrl);
    try { await assert.rejects(context.get(MigrationsService).migrate('down'),/SOURCE_PUBLISH_POLICY_ROLLBACK_REQUIRES_HANDOFF/); }
    finally { await context.close(); }
  });
});
