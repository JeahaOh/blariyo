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
import { requiredRow, rows } from '../dist/persistence/rows.js';
import { TypeOrmReviewCommandRepository } from '../dist/persistence/review-command.repository.js';
import { TypeOrmDiscordCleanupRepository } from '../dist/persistence/discord-cleanup.repository.js';
import { BatchReviewRepository } from '../dist/features/collection/batch-review.repository.js';
import { BatchReviewService } from '../dist/features/collection/batch-review.service.js';
import { ReviewCommandService } from '../dist/features/collection/review-command.service.js';
import { ReviewAuthority, type DiscordReviewSettings } from '../dist/features/collection/review-authority.js';
import { DiscordCleanupService, DiscordCleanupDispatcher } from '../dist/features/collection/discord-cleanup.js';
import { PostsService } from '../dist/features/posts/posts.service.js';
import { PostsRepository } from '../dist/features/posts/posts.repository.js';
import { UnitOfWork } from '../dist/shared/unit-of-work.js';
import { localStorage } from '../dist/adapters/storage.js';
import { LocalCollectReader } from '../dist/adapters/collect-reader.js';
import { reviewManifest, reviewSelection } from '../dist/features/collection/discord-review-policy.js';
import { collectionDigest } from '../dist/features/collection/collection-url.js';
import type { AcceptReviewCommand } from '../dist/features/collection/review-command.repository.js';

const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_NEST_DATABASE_URL required');
await test('shared review workflow publishes only selected content once and fences rejected/revoked drafts', async t => {
  const migration = await migrationContext(databaseUrl);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const root = await mkdtemp('/private/tmp/blariyo-review-workflow-');
  t.after(() => rm(root,{ recursive:true,force:true }));
  const app = await createNestApplication({ databaseUrl, storage:localStorage(root+'/objects'), collectBatchReviewEnabled:true,
    collectReader:new LocalCollectReader(root+'/batch') });
  t.after(() => app.close());
  const db = app.get(DatabaseContext), work = app.get(UnitOfWork), batches = app.get(BatchReviewService);
  const query = (sql: string, parameters?: unknown[]) => db.source.query(sql,parameters);
  await query(await readFile('apps/collector/src/main/resources/db/collector-v002.sql','utf8'));
  const lifecycle = await readFile('apps/collector/src/main/resources/db/collector-v004.sql','utf8');
  await query(lifecycle.slice(0,lifecycle.indexOf('CREATE OR REPLACE FUNCTION')));
  await query(await readFile('apps/collector/src/main/resources/db/collector-v007.sql','utf8'));
  await query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','example.invalid','fixture-v1')");
  const run = randomUUID();
  await query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'fixture','hot','WRITE_DB','COMPLETED',1,10,10000)",[run]);
  const settings: DiscordReviewSettings = { environment:'local_test',guildId:'111111111111111111',channelId:'222222222222222222',exportSince:new Date().toISOString(),
    botTokenFile:root+'/bot',workerTokenFile:root+'/worker',reviewersFile:root+'/reviewers.json',adminOperatorsFile:root+'/operators.json',actorSecretFile:root+'/actor' };
  const operators = [{ identity:'fixture-subject',operatorId:'fixture-owner',role:'OWNER',active:true }];
  await writeFile(settings.adminOperatorsFile,JSON.stringify(operators),{ mode:0o600 });
  await writeFile(settings.reviewersFile,JSON.stringify([{ discordUserId:'333333333333333333',operatorId:'fixture-owner' }]),{ mode:0o600 });
  await writeFile(settings.actorSecretFile,randomBytes(32).toString('hex'),{ mode:0o600 });
  const authority = new ReviewAuthority(settings), operator = authority.reviewers().get('333333333333333333'); assert.ok(operator);
  const repository = new TypeOrmReviewCommandRepository(db);
  const cleanup = new DiscordCleanupDispatcher(new DiscordCleanupService(new TypeOrmDiscordCleanupRepository(db),work,{
    deleteHead: async () => { throw Error('unexpected external call'); }, deleteThread: async () => { throw Error('unexpected external call'); },
  }));
  t.after(() => cleanup.onApplicationShutdown());
  const service = new ReviewCommandService(repository,batches,app.get(BatchReviewRepository),work,authority,cleanup,app.get(PostsService),app.get(PostsRepository));
  const bytes = await sharp({ create:{ width:8,height:8,channels:3,background:'#123456' } }).png().toBuffer();
  async function fixture(): Promise<AcceptReviewCommand> {
    const id = randomUUID(), url = 'https://example.invalid/'+id, mediaId = randomUUID(), key = `collect/media/${mediaId}/1`;
    await mkdir(root+'/batch/collect/media/'+mediaId,{ recursive:true }); await writeFile(root+'/batch/'+key,bytes);
    const blocks = [{ type:'TEXT',text:'유지 문장입니다. 제외 문장입니다.' },{ type:'IMAGE',imagePosition:1,alt:'유지' },{ type:'IMAGE',imagePosition:2,alt:'제외' }];
    await query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,sns_links,version)
      VALUES($1::uuid,$2,'fixture',$1::uuid::text,$3,$4,'FETCHED','검수 시험',$5,'[]',1)`,[id,run,url,createHash('sha256').update(url).digest(),JSON.stringify(blocks)]);
    await query(`INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,sha256,mime_type,byte_size,object_key)
      VALUES($1,$2,1,'IMAGE','https://example.invalid/1.png',$3,'image/png',$4,$5),
      ($6,$2,2,'IMAGE','https://example.invalid/2.png',$3,'image/png',$4,'collect/media/missing/2')`,[mediaId,id,createHash('sha256').update(bytes).digest(),bytes.length,key,randomUUID()]);
    const detail = (await batches.detail(id)).item, manifest = reviewManifest(detail.bodyBlocks,detail.contentDigest);
    const excluded = manifest.units.filter(unit => unit.block.type === 'TEXT' ? unit.block.text.includes('제외') : unit.block.type === 'IMAGE' && unit.block.imagePosition===2).map(unit=>unit.id);
    const selection = reviewSelection(manifest,excluded);
    const requestBody = { boardSlug:'meme' };
    return { itemId:id,origin:'DISCORD',action:'APPROVE_PUBLISH',actor:operator!.actor,operatorId:operator!.operatorId,
      reviewerIds:['333333333333333333'],expectedEpoch:0,itemVersion:1,reviewVersion:0,contentDigest:detail.contentDigest,
      selectionDigest:selection.digest,excludedUnitIds:excluded,evidence:{},requestBody,requestKey:randomUUID(),requestHash:collectionDigest({id,requestBody,selection:selection.digest}).toString('hex') };
  }
  await t.test('excluded text and missing image are not published; replay and recovery create one post/history',async () => {
    const input = await fixture(), accepted = await service.accept(input);
    assert.equal(accepted.stage,'APPROVED');
    const draft = await service.advance(accepted.id,'fixture'); assert.equal(draft.stage,'DRAFTED'); assert.ok(draft.postId);
    const blocks = rows(await query('SELECT type,text_content,image_id FROM content.board_post_block WHERE post_id=$1 ORDER BY position',[draft.postId]));
    assert.equal(blocks.length,2); assert.equal(blocks[0]?.text_content,'유지 문장입니다.'); assert.ok(blocks[1]?.image_id);
    assert.equal((await service.advance(accepted.id,'fixture')).stage,'PUBLISHED');
    assert.equal((await service.advance(accepted.id,'fixture')).stage,'PUBLISHED');
    assert.equal((await service.accept(input)).id,accepted.id);
    assert.equal(requiredRow(await query("SELECT count(*) FROM content.board_post_status_history WHERE post_id=$1 AND to_status='PUBLISHED'",[draft.postId])).count,'1');
  });
  await t.test('admin rejection after draft retains the link and blocks both worker and direct publish',async () => {
    const input = await fixture(), accepted = await service.accept(input), draft = await service.advance(accepted.id,'fixture');
    assert.ok(draft.postId);
    const rejected = await service.accept({ ...input,origin:'ADMIN',action:'REJECT',requestKey:randomUUID(),requestHash:'d'.repeat(64) });
    assert.equal(rejected.stage,'REJECTED');
    const review = await app.get(BatchReviewRepository).review(input.itemId);
    assert.equal(review?.postId,draft.postId); assert.equal(review?.status,'REJECTED');
    assert.equal((await service.advance(accepted.id,'fixture')).stage,'CANCELLED');
    await assert.rejects(app.get(PostsService).command({ action:'publish',params:{postId:String(draft.postId)},body:{mode:'IMMEDIATE',lockVersion:1} },operator.actor),{code:'BATCH_REVIEW_SUPERSEDED'});
    assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
  });
  await t.test('administrator can take over the existing draft with its current post version',async () => {
    const input = await fixture(), accepted = await service.accept(input), draft = await service.advance(accepted.id,'fixture');
    assert.ok(draft.postId);
    const approval = await service.accept({...input,origin:'ADMIN',requestKey:randomUUID(),requestHash:'e'.repeat(64),
      requestBody:{boardSlug:'meme',postVersion:draft.postVersion}});
    assert.equal(approval.stage,'DRAFTED');assert.equal(approval.postId,draft.postId);
    assert.equal((await service.advance(accepted.id,'fixture')).stage,'CANCELLED');
    assert.equal((await service.advance(approval.id,'fixture')).stage,'PUBLISHED');
    assert.equal(requiredRow(await query("SELECT count(*) FROM content.board_post_status_history WHERE post_id=$1 AND to_status='PUBLISHED'",[draft.postId])).count,'1');
  });
  await t.test('revoked operator cannot finish an already approved draft',async () => {
    const input = await fixture(), accepted = await service.accept(input), draft = await service.advance(accepted.id,'fixture');
    await writeFile(settings.adminOperatorsFile,JSON.stringify(operators.map(value=>({...value,active:false}))));
    const held = await service.advance(accepted.id,'fixture'); assert.equal(held.stage,'NEEDS_ADMIN');
    assert.equal((await app.get(PostsRepository).find(String(draft.postId)))?.status,'DRAFT');
    await writeFile(settings.adminOperatorsFile,JSON.stringify(operators));
  });
});
