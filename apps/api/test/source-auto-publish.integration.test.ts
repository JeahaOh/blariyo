import { AutoPublishKeywordRepository } from '../dist/features/collection/auto-publish-keyword.repository.js';
import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { DatabaseContext } from '../dist/persistence/database.js';
import { requiredRow, rows } from '../dist/persistence/rows.js';
import { BatchReviewService } from '../dist/features/collection/batch-review.service.js';
import { ReviewCommandService } from '../dist/features/collection/review-command.service.js';
import { SourcePublishPolicyRepository } from '../dist/features/collection/source-publish-policy.repository.js';
import { AutoPublishClassificationRepository } from '../dist/features/collection/auto-publish-classification.repository.js';
import { classifyAutoPublish } from '../dist/features/collection/auto-publish-classifier.js';
import { draftTitle } from '@blariyo/contracts/draft-title';
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
import { TypeOrmHealthRepository } from '../dist/persistence/health.repository.js';
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
  async function fixture(options:{source?:string;old?:boolean;missing?:boolean;corrupt?:boolean;title?:string;linkOnly?:boolean}={}){
    const source=options.source??'theqoo',run=randomUUID(),id=randomUUID(),url='https://example.invalid/'+id,media=randomUUID(),key=`collect/media/${media}/1`;
    await query(`INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms,started_at)
      VALUES($1,$2,'hot','WRITE_DB','COMPLETED',1,10,10000,clock_timestamp()-$3::interval)`,[run,source,options.old?'1 hour':'0 seconds']);
    await mkdir(root+'/batch/collect/media/'+media,{recursive:true});if(!options.missing)await writeFile(root+'/batch/'+key,options.corrupt?Buffer.from('invalid'):bytes);
    const blocks=options.linkOnly?[{type:'LINK',url:'https://example.invalid/external',label:'원문'}]:[{type:'TEXT',text:'자동 발행 검증 본문입니다.'},{type:'IMAGE',imagePosition:1,alt:'검증 이미지'}];
    await query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,sns_links,version,fetched_at)
      VALUES($1::uuid,$2,$3,$1::uuid::text,$4,$5,'FETCHED',$7,$6,'[]',1,clock_timestamp())`,[id,run,source,url,createHash('sha256').update(url).digest(),JSON.stringify(blocks),options.title??'출근길에 겪은 황당한 실수 '+id]);
    await query(`INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,sha256,mime_type,byte_size,object_key)
      VALUES($1,$2,1,'IMAGE','http://cdn.example.invalid/1.png',$3,'image/png',$4,$5)`,[media,id,createHash('sha256').update(bytes).digest(),bytes.length,key]);
    return id;
  }
  async function accept(id:string){
    const item=(await batches.detail(id)).item,policy=(await policies.list()).find(p=>p.sourceKey===item.sourceKey);assert.ok(policy);
    const classification=classifyAutoPublish(item,await app.get(AutoPublishKeywordRepository).current());
    await work.transaction(()=>app.get(AutoPublishClassificationRepository).record({...classification,itemId:id,itemVersion:item.version,policyVersion:policy.lockVersion,contentDigest:item.contentDigest,title:draftTitle(item.title??'',item.sourceKey)}));
    const selection=reviewSelection(reviewManifest(item.bodyBlocks,item.contentDigest),[]),body={boardSlug:'meme',sourceKey:policy.sourceKey,policyVersion:policy.lockVersion,classificationVersion:classification.ruleVersion,classificationDigest:item.contentDigest};
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
          const health=new TypeOrmHealthRepository(db);assert.equal(await health.ready(false,true),true);
          await query(`REVOKE UPDATE ON collect.batch_auto_publish_classification FROM ${role}`);
          assert.equal(await health.ready(false,true),false);
          await query(`GRANT UPDATE ON collect.batch_auto_publish_classification TO ${role}`);
          await query(`REVOKE EXECUTE ON FUNCTION collect.auto_publish_title_key(text) FROM ${role}`);
          assert.equal(await health.ready(false,true),false);assert.equal(await health.commonCodesReady(),false);
          await query(`GRANT EXECUTE ON FUNCTION collect.auto_publish_title_key(text) TO ${role}`);
          assert.equal(await health.ready(false,true),true);
          for (const [table,privilege] of [['auto_publish_keyword_head','SELECT'],['auto_publish_keyword_head','UPDATE'],['auto_publish_keyword_revision','SELECT'],['auto_publish_keyword_revision','INSERT']]) {
            await query(`REVOKE ${privilege} ON collect.${table} FROM ${role}`);
            assert.equal(await health.ready(false,true),false);
            await query(`GRANT ${privilege} ON collect.${table} TO ${role}`);
          }
          const current=(await policies.list()).find(p=>p.sourceKey==='theqoo');assert.ok(current);
          await work.transaction(()=>policies.update('theqoo',true,current.lockVersion,actor));
          assert.deepEqual(await auto.run(),{PUBLISHED:1});
        } finally {await db.manager.query('RESET ROLE');}
      });
      assert.equal(requiredRow(await query('SELECT stage FROM collect.batch_review_command WHERE item_id=$1',[id])).stage,'PUBLISHED');
    } finally {await query(`DROP OWNED BY ${role}`);await query(`DROP ROLE ${role}`);}
  });
  await t.test('preview is read-only, holds out-of-scope posts and releases them to Discord without rejecting them',async()=>{
    const unsafe=await fixture({title:'직장인의 황당한 주식 투자 이야기'}),external=await fixture({title:'고양이가 알람을 끄는 웃긴 이유',linkOnly:true}),good=await fixture();
    const before=requiredRow(await query('SELECT (SELECT count(*) FROM collect.batch_auto_publish_classification) AS decisions,(SELECT count(*) FROM collect.batch_review_command) AS commands,(SELECT count(*) FROM content.board_post) AS posts'));
    const preview=await auto.preview(20);
    assert.equal(preview.find(d=>d.itemId===unsafe)?.reason,'HEALTH_OR_FINANCE');
    assert.equal(preview.find(d=>d.itemId===external)?.reason,'EXTERNAL_CONTENT');
    assert.equal(preview.find(d=>d.itemId===good)?.decision,'ELIGIBLE');
    assert.deepEqual(requiredRow(await query('SELECT (SELECT count(*) FROM collect.batch_auto_publish_classification) AS decisions,(SELECT count(*) FROM collect.batch_review_command) AS commands,(SELECT count(*) FROM content.board_post) AS posts')),before);
    assert.deepEqual(await auto.run(),{HEALTH_OR_FINANCE:1,EXTERNAL_CONTENT:1,PUBLISHED:1});
    for(const id of [unsafe,external]) {
      const item=(await batches.detail(id)).item;
      assert.equal(item.review.status,'UNREVIEWED');
      assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_review_command WHERE item_id=$1',[id])).count,'0');
      assert.ok((await discord.candidates(new Date(0).toISOString())).includes(id));
      await work.transaction(()=>discord.create(id,item.version,reviewManifest(item.bodyBlocks,item.contentDigest)));
      assert.equal(requiredRow(await query('SELECT count(*) FROM collect.discord_review_delivery WHERE item_id=$1',[id])).count,'1');
    }
    assert.deepEqual(await auto.run(),{});
  });
  await t.test('the actual CLI dry-run is read-only and scheduled publication does not run collection jobs',async()=>{
    const id=await fixture();
    const env={...process.env,NODE_ENV:'test',DATABASE_URL:databaseUrl,STORAGE_ROOT:root+'/cli-objects',STORAGE_MODE:'local',COLLECT_BATCH_REVIEW_ENABLED:'true',COLLECT_READER_DIRECTORY:root+'/batch',COLLECT_MANUAL_URL_ENABLED:'false',COLLECT_DISCORD_COMMAND_ENABLED:'false',MAINTENANCE_READ_ONLY:'false'};
    const command=(name:string,args:string[]=[])=>spawnSync(process.execPath,['apps/api/dist/commands/command.js',name,...args],{env,encoding:'utf8',timeout:15000});
    const preview=command('collection:auto-publish',['--dry-run','--limit=20']);assert.equal(preview.status,0,preview.stderr);
    assert.ok(rows(requiredRow([JSON.parse(preview.stdout.split('\n')[0]!)]).decisions).some(d=>d.itemId===id));
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_auto_publish_classification WHERE item_id=$1',[id])).count,'0');
    const publish=command('posts:publish-due');assert.equal(publish.status,0,publish.stderr);assert.doesNotMatch(publish.stdout,/SOURCE_AUTO_PUBLISH/);
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_review_command WHERE item_id=$1',[id])).count,'0');
    const autoResult=command('collection:auto-publish',['--limit=1']);assert.equal(autoResult.status,0,autoResult.stderr);
    assert.equal(requiredRow([requiredRow([JSON.parse(autoResult.stdout.split('\n')[0]!)]).counts]).PUBLISHED,1);
    assert.equal(requiredRow(await query('SELECT stage FROM collect.batch_review_command WHERE item_id=$1',[id])).stage,'PUBLISHED');
  });
  await t.test('normalized duplicate titles are held across sources and final publication rechecks duplicates',async()=>{
    const title='출근길 커피 가격의 황당한 차이 '+randomUUID();
    await fixture({title});assert.equal((await auto.run()).PUBLISHED,1);
    await work.transaction(()=>policies.update('todayhumor',true,0,actor));
    const duplicate=await fixture({title:title.replaceAll(' ','! '),source:'todayhumor'});
    assert.deepEqual(await auto.run(),{DUPLICATE_TITLE:1});
    assert.equal(requiredRow(await query('SELECT decision FROM collect.batch_auto_publish_classification WHERE item_id=$1',[duplicate])).decision,'REVIEW');
    const id=await fixture(),command=await accept(id),draft=await commands.advance(command.id,'fixture');assert.equal(draft.stage,'DRAFTED');
    const post=await app.get(PostsRepository).find(String(draft.postId));assert.ok(post);
    await work.transaction(()=>app.get(PostsRepository).create(post.boardId,post.slug,{boardSlug:post.slug,title:post.title,source:null,pinnedPosition:null,blocks:[{type:'TEXT',text:'수동 초안'}]},actor));
    const result=await commands.advance(command.id,'fixture');assert.equal(result.stage,'NEEDS_ADMIN');
    assert.equal(requiredRow(await query('SELECT last_error FROM collect.batch_review_command WHERE id=$1',[command.id])).last_error,'AUTO_PUBLISH_DUPLICATE_TITLE');
    assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
    assert.equal(requiredRow(await query("SELECT collect.auto_publish_title_key('ＡＢＣ １２３!')=collect.auto_publish_title_key('abc123') AS same")).same,true);
  });
  await t.test('concurrent manual creation takes the same title lock before the automatic publication check',async()=>{
    const id=await fixture(),command=await accept(id),draft=await commands.advance(command.id,'fixture');assert.equal(draft.stage,'DRAFTED');
    const post=await app.get(PostsRepository).find(String(draft.postId));assert.ok(post);
    let announce!:()=>void,release!:()=>void;
    const ready=new Promise<void>(resolve=>{announce=resolve;}),barrier=new Promise<void>(resolve=>{release=resolve;});
    const manual=work.transaction(async()=>{
      await app.get(PostsRepository).create(post.boardId,post.slug,{boardSlug:post.slug,title:post.title,source:null,pinnedPosition:null,blocks:[{type:'TEXT',text:'동시 수동 초안'}]},actor);
      announce();await barrier;
    });
    await Promise.race([ready,manual]);const publication=commands.advance(command.id,'fixture');
    try {
      let blocked=false;
      for(let attempt=0;attempt<50&&!blocked;attempt++) {
        blocked=requiredRow(await query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS blocked")).blocked===true;
        if(!blocked)await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.equal(blocked,true,'automatic publication must wait for the manual title transaction');
    } finally {release();}
    await manual;assert.equal((await publication).stage,'NEEDS_ADMIN');
    assert.equal(requiredRow(await query('SELECT last_error FROM collect.batch_review_command WHERE id=$1',[command.id])).last_error,'AUTO_PUBLISH_DUPLICATE_TITLE');
    assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
  });
  await t.test('classification versions and changed original content fence an already-created draft',async()=>{
    for(const change of ['rule','body']) {
      const id=await fixture(),command=await accept(id),draft=await commands.advance(command.id,'fixture');assert.equal(draft.stage,'DRAFTED');
      if(change==='rule')await query("UPDATE collect.batch_auto_publish_classification SET rule_version='old-rule' WHERE item_id=$1",[id]);
      else await query("UPDATE collect.batch_item SET body_blocks=body_blocks||'[ {\"type\":\"TEXT\",\"text\":\"추가 본문\"} ]'::jsonb WHERE id=$1",[id]);
      assert.equal((await commands.advance(command.id,'fixture')).stage,'NEEDS_ADMIN');
      assert.equal(requiredRow(await query('SELECT last_error FROM collect.batch_review_command WHERE id=$1',[command.id])).last_error,'AUTO_PUBLISH_CLASSIFICATION_CHANGED');
      assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
    }
  });
  await t.test('new jobs have bounded work and publication limits, and replay does not publish twice',async()=>{
    for(let i=0;i<6;i++)await fixture();
    assert.deepEqual(await auto.run(),{PUBLISHED:5});
    assert.deepEqual(await auto.run(),{PUBLISHED:1});assert.deepEqual(await auto.run(),{});
    await assert.rejects(auto.run(0),{code:'AUTO_PUBLISH_LIMIT_INVALID'});
    await assert.rejects(auto.preview(21),{code:'AUTO_PUBLISH_LIMIT_INVALID'});
  });
  await t.test('a large held queue advances in bounded classification batches without starving the next eligible item',async()=>{
    for(let i=0;i<26;i++)await fixture({title:'직장인의 황당한 대통령 선거 이야기 '+i});
    await fixture();
    assert.deepEqual(await auto.run(),{POLITICS_OR_CONFLICT:20});
    assert.deepEqual(await auto.run(),{POLITICS_OR_CONFLICT:6,PUBLISHED:1});
    assert.deepEqual(await auto.run(),{});
  });
  await t.test('classification is required for AUTO acceptance and parallel executions share the same DB lock',async()=>{
    const id=await fixture(),item=(await batches.detail(id)).item,policy=(await policies.list()).find(p=>p.sourceKey===item.sourceKey);assert.ok(policy);
    const selection=reviewSelection(reviewManifest(item.bodyBlocks,item.contentDigest),[]);
    await assert.rejects(commands.accept({itemId:id,origin:'AUTO',action:'APPROVE_PUBLISH',actor:'system:collector',operatorId:null,reviewerIds:[],expectedEpoch:0,itemVersion:item.version,reviewVersion:0,contentDigest:item.contentDigest,selectionDigest:selection.digest,excludedUnitIds:[],evidence:{},requestBody:{boardSlug:'meme',sourceKey:item.sourceKey,policyVersion:policy.lockVersion},requestKey:randomUUID(),requestHash:'b'.repeat(64)}),{code:'AUTO_PUBLISH_CLASSIFICATION_CHANGED'});
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_review_command WHERE item_id=$1',[id])).count,'0');
    const changedId=await fixture(),before=(await batches.detail(changedId)).item,classification=classifyAutoPublish(before,await app.get(AutoPublishKeywordRepository).current());
    await work.transaction(()=>app.get(AutoPublishClassificationRepository).record({...classification,itemId:changedId,itemVersion:before.version,policyVersion:policy.lockVersion,contentDigest:before.contentDigest,title:draftTitle(before.title??'',before.sourceKey)}));
    await query("UPDATE collect.batch_item SET body_blocks=body_blocks||'[ {\"type\":\"TEXT\",\"text\":\"대통령 선거 이야기\"} ]'::jsonb WHERE id=$1",[changedId]);
    const changed=(await batches.detail(changedId)).item,changedSelection=reviewSelection(reviewManifest(changed.bodyBlocks,changed.contentDigest),[]);
    await assert.rejects(commands.accept({itemId:changedId,origin:'AUTO',action:'APPROVE_PUBLISH',actor:'system:collector',operatorId:null,reviewerIds:[],expectedEpoch:0,itemVersion:changed.version,reviewVersion:0,contentDigest:changed.contentDigest,selectionDigest:changedSelection.digest,excludedUnitIds:[],evidence:{},requestBody:{boardSlug:'meme',sourceKey:changed.sourceKey,policyVersion:policy.lockVersion,classificationVersion:classification.ruleVersion,classificationDigest:before.contentDigest},requestKey:randomUUID(),requestHash:'c'.repeat(64)}),{code:'AUTO_PUBLISH_CLASSIFICATION_CHANGED'});
    assert.equal(requiredRow(await query('SELECT count(*) FROM collect.batch_review_command WHERE item_id=$1',[changedId])).count,'0');
    const holder=db.source.createQueryRunner();await holder.connect();
    try {
      await holder.query("SELECT pg_advisory_lock(hashtextextended('source-auto-publish',0))");
      assert.deepEqual(await auto.run(),{BUSY:1});
    } finally {await holder.query('SELECT pg_advisory_unlock_all()');await holder.release();}
    assert.equal((await auto.run()).PUBLISHED,1);
  });
  await t.test('a policy in use prevents destructive migration rollback',async()=>{
    const context=await migrationContext(databaseUrl);
    try {
      await context.get(MigrationsService).migrate('down'); // Unchanged V017 is reversible.
      await assert.rejects(context.get(MigrationsService).migrate('down'),/AUTO_PUBLISH_CLASSIFICATION_ROLLBACK_REQUIRES_HANDOFF/);
      await context.get(MigrationsService).migrate();
    }
    finally { await context.close(); }
  });
  await t.test('keyword management enforces roles, normalizes strings and appends immutable versioned snapshots',async()=>{
    const path='/api/v1/admin/collect/auto-publish-keywords';
    const call=(suffix='',body?:unknown,role='OWNER',method=body===undefined?'GET':'POST')=>fetch(origin+path+suffix,{method,
      headers:{'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':role,'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.equal((await fetch(origin+path)).status,401);
    const initial=(await contractSuccess('listAutoPublishKeywords',await call())).data;
    assert.equal(initial.ruleVersion,'life-humor-v1');assert.equal(initial.canManage,true);
    assert.equal((await contractSuccess('listAutoPublishKeywords',await call('',undefined,'EDITOR'))).data.canManage,false);
    const input={ruleVersion:initial.ruleVersion,keyword:'  キーワード  ',group:'LIFE',scope:'TITLE',matchMode:'CONTAINS',enabled:true};
    assert.equal((await call('',input,'EDITOR')).status,403);
    assert.equal((await call('',{...input,keyword:'   '})).status,400);
    assert.equal((await call('',{...input,keyword:'a\u0001b'})).status,400);
    assert.equal((await call('',{...input,group:'ANY'})).status,400);
    const [first,second]=await Promise.all([call('',input),call('',{...input,keyword:'다른키워드'})]);
    assert.deepEqual([first.status,second.status].sort(),[200,409]);
    const succeeded=first.status===200?first:second;
    const saved=(await contractSuccess('createAutoPublishKeyword',succeeded,'POST')).data;
    assert.equal(saved.ruleVersion,'life-humor-v1-k2');
    const added=saved.items.find(k=>!initial.items.some(old=>old.keywordId===k.keywordId));assert.ok(added);
    assert.equal(added.keyword,first.status===200?'キーワード':'다른키워드');
    const edit={keyword:added.keyword,group:added.group,scope:added.scope,matchMode:added.matchMode,enabled:added.enabled,ruleVersion:saved.ruleVersion};
    assert.equal((await call('',{...input,keyword:added.keyword,ruleVersion:saved.ruleVersion})).status,409);
    assert.equal((await call('/'+randomUUID(),edit,'OWNER','PATCH')).status,404);
    assert.equal((await call('/'+added.keywordId,edit,'EDITOR','PATCH')).status,403);
    const noOp=(await contractSuccess('updateAutoPublishKeyword',await call('/'+added.keywordId,edit,'OWNER','PATCH'),'PATCH')).data;
    assert.equal(noOp.ruleVersion,saved.ruleVersion);
    const disabled=(await contractSuccess('updateAutoPublishKeyword',await call('/'+added.keywordId,{...edit,enabled:false},'OWNER','PATCH'),'PATCH')).data;
    assert.equal(disabled.ruleVersion,'life-humor-v1-k3');
    const snapshots=rows(await query('SELECT * FROM collect.auto_publish_keyword_revision ORDER BY revision'));
    assert.equal(snapshots.length,3);assert.equal(snapshots[1]?.updated_by,actor);
    assert.deepEqual(snapshots[0]?.keywords,initial.items);
    await assert.rejects(query('UPDATE collect.auto_publish_keyword_revision SET updated_by=$1 WHERE revision=2',[actor]),/IMMUTABLE/);
    await assert.rejects(query('DELETE FROM collect.auto_publish_keyword_revision WHERE revision=2'),/IMMUTABLE/);
  });
  await t.test('bulk keyword changes are atomic, versioned and deletions retain history',async()=>{
    const repository=app.get(AutoPublishKeywordRepository),path='/api/v1/admin/collect/auto-publish-keywords/bulk';
    const call=(body:unknown,role='OWNER')=>fetch(origin+path,{method:'POST',headers:{'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':role,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const initial=await repository.current();
    const addedA=await work.transaction(()=>repository.save({keyword:'일괄테스트A',group:'LIFE',scope:'TITLE',matchMode:'CONTAINS',enabled:true},initial.ruleVersion,actor));
    const addedB=await work.transaction(()=>repository.save({keyword:'일괄테스트B',group:'LIFE',scope:'TITLE',matchMode:'CONTAINS',enabled:true},addedA.ruleVersion,actor));
    const targets=addedB.items.filter(item=>item.keyword.startsWith('일괄테스트'));assert.equal(targets.length,2);
    const input={action:'SAVE',ruleVersion:addedB.ruleVersion,items:targets.map(item=>({...item,matchMode:'WORD',enabled:false}))};
    const revisions=()=>query('SELECT count(*)::int AS count FROM collect.auto_publish_keyword_revision').then(result=>Number(requiredRow(result).count));
    const countBefore=await revisions();
    assert.equal((await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).status,401);
    assert.equal((await call(input,'EDITOR')).status,403);
    assert.equal((await call({...input,items:[]})).status,400);
    assert.equal((await call({...input,items:[targets[0],targets[0]]})).status,400);
    assert.equal((await call({...input,items:targets.map((item,index)=>({...item,keyword:index?'a\u0001b':'정상수정'}))})).status,400);
    assert.equal((await call({...input,items:targets.map(item=>({...item,keyword:'같은단어'}))})).status,409);
    assert.equal((await call({...input,items:targets.map((item,index)=>({...item,keyword:index?'출근':'정상수정'}))})).status,409);
    assert.equal((await call({...input,items:targets.map((item,index)=>({...item,keywordId:index?randomUUID():item.keywordId}))})).status,404);
    assert.deepEqual(await repository.current(),addedB);assert.equal(await revisions(),countBefore);
    const saved=(await contractSuccess('bulkAutoPublishKeywords',await call(input),'POST')).data;
    assert.equal(await revisions(),countBefore+1);assert.ok(saved.items.filter(item=>targets.some(t=>t.keywordId===item.keywordId)).every(item=>item.matchMode==='WORD'&&!item.enabled));
    assert.deepEqual(saved.items.filter(item=>!targets.some(t=>t.keywordId===item.keywordId)),addedB.items.filter(item=>!targets.some(t=>t.keywordId===item.keywordId)));
    assert.equal((await call(input)).status,409);
    const noOp=(await contractSuccess('bulkAutoPublishKeywords',await call({...input,ruleVersion:saved.ruleVersion}),'POST')).data;
    assert.equal(noOp.ruleVersion,saved.ruleVersion);assert.equal(await revisions(),countBefore+1);
    const deletion={action:'DELETE',ruleVersion:saved.ruleVersion,keywordIds:targets.map(item=>item.keywordId)};
    assert.equal((await call(deletion,'EDITOR')).status,403);
    assert.equal((await call({...deletion,keywordIds:[targets[0]?.keywordId,randomUUID()]})).status,404);
    assert.equal((await call({...deletion,keywordIds:[targets[0]?.keywordId,targets[0]?.keywordId]})).status,400);
    assert.equal((await call({...deletion,items:targets})).status,400);
    assert.equal(await revisions(),countBefore+1);
    const race=await Promise.all([call(deletion),call({...input,ruleVersion:saved.ruleVersion,items:targets.map(item=>({...item,enabled:true}))})]);
    assert.deepEqual(race.map(response=>response.status).sort(),[200,409]);assert.equal(await revisions(),countBefore+2);
    const current=await repository.current(),remaining=current.items.filter(item=>targets.some(t=>t.keywordId===item.keywordId));
    if(remaining.length)await call({action:'DELETE',ruleVersion:current.ruleVersion,keywordIds:remaining.map(item=>item.keywordId)}).then(async response=>{assert.equal(response.status,200);});
    const deleted=await repository.current();assert.ok(!deleted.items.some(item=>targets.some(t=>t.keywordId===item.keywordId)));
    const history=requiredRow(await query('SELECT keywords FROM collect.auto_publish_keyword_revision WHERE rule_version=$1',[saved.ruleVersion]));
    assert.deepEqual(history.keywords,saved.items);
  });
  await t.test('changed DB rules affect new classification, fence drafts and keep previous REVIEW with people',async()=>{
    const repository=app.get(AutoPublishKeywordRepository);
    const initial=await repository.current();
    const held=await fixture({title:'職場の話 キーワード管理テスト'});
    assert.equal((await auto.run()).UNCERTAIN_TOPIC,1);
    const saved=await work.transaction(()=>repository.save({keyword:'職場',group:'LIFE',scope:'TITLE',matchMode:'CONTAINS',enabled:true},initial.ruleVersion,actor));
    const held2=await fixture({title:'職場の話 キーワード管理テスト'});
    const eligible=await work.transaction(()=>repository.save({keyword:'管理テスト',group:'REACTION',scope:'TITLE',matchMode:'CONTAINS',enabled:true},saved.ruleVersion,actor));
    assert.equal(classifyAutoPublish((await batches.detail(held2)).item,eligible).decision,'ELIGIBLE');
    const candidates=await policies.candidates(20);
    assert.ok(!candidates.some(c=>c.itemId===held),'old REVIEW must not become AUTO after rules change');
    const discord=new TypeOrmDiscordReviewRepository(db,settings);
    const fetchedAt=requiredRow(await query('SELECT fetched_at FROM collect.batch_item WHERE id=$1',[held])).fetched_at;assert.ok(fetchedAt instanceof Date);
    assert.ok((await discord.candidates(fetchedAt.toISOString())).includes(held));
    const command=await accept(held2),draft=await commands.advance(command.id,'fixture');assert.equal(draft.stage,'DRAFTED');
    const term=eligible.items.find(k=>k.keyword==='管理テスト');assert.ok(term);
    const {keywordId,...input}=term;
    const updated=await work.transaction(()=>repository.save({...input,enabled:false},eligible.ruleVersion,actor,keywordId));
    assert.equal(classifyAutoPublish((await batches.detail(held2)).item,updated).decision,'REVIEW');
    assert.equal((await commands.advance(command.id,'fixture')).stage,'NEEDS_ADMIN');
    assert.equal(requiredRow(await query('SELECT last_error FROM collect.batch_review_command WHERE id=$1',[command.id])).last_error,'AUTO_PUBLISH_CLASSIFICATION_CHANGED');
    assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
    const context=await migrationContext(databaseUrl);
    try {await assert.rejects(context.get(MigrationsService).migrate('down'),/AUTO_PUBLISH_KEYWORDS_ROLLBACK_REQUIRES_HANDOFF/);}finally {await context.close();}
  });

  await t.test('restricted API role appends keyword snapshots and changes only the current head',async()=>{
    const role='keyword_app_'+randomBytes(6).toString('hex');await query(`CREATE ROLE ${role} NOLOGIN`);
    try {
      await new TypeOrmMigrationsRepository(db).grantApplication(role);
      await work.lock('restricted-keyword-management',async()=>{
        await db.manager.query(`SET ROLE ${role}`);
        try {
          const repository=app.get(AutoPublishKeywordRepository),current=await repository.current();
          const saved=await work.transaction(()=>repository.save({keyword:'最小権限検証',group:'HUMOR',scope:'TITLE',matchMode:'WORD',enabled:false},current.ruleVersion,actor));
          assert.notEqual(saved.ruleVersion,current.ruleVersion);
          assert.ok(saved.items.some(k=>k.keyword==='最小権限検証'&&!k.enabled));
          const old=await repository.current();assert.equal(old.ruleVersion,saved.ruleVersion);
          await assert.rejects(db.manager.query('DELETE FROM collect.auto_publish_keyword_head'),{code:'42501'});
          await assert.rejects(db.manager.query("UPDATE collect.auto_publish_keyword_revision SET updated_by='forbidden'"),{code:'42501'});
        } finally {await db.manager.query('RESET ROLE');}
      });
    } finally {await query(`DROP OWNED BY ${role}`);await query(`DROP ROLE ${role}`);}
  });

});
