import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { createDataSource } from '../dist/persistence/database.js';
import { requiredRow } from '../dist/persistence/rows.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { LocalCollectReader } from '../dist/adapters/collect-reader.js';
import { localStorage } from '../dist/adapters/storage.js';
import { OutboxService } from '../dist/operations/outbox.service.js';
import { contractSuccess } from './contract-response.js';

const databaseUrl = process.env.TEST_NEST_DATABASE_URL;
assert.ok(databaseUrl);
await test('batch-owned objects pass through API review and draft before separate publication', async (t) => {
  const migration = await migrationContext(databaseUrl);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const pool = await createDataSource(databaseUrl).initialize();
  t.after(() => pool.destroy());
  await pool.query(await readFile('apps/collector/src/main/resources/db/collector-v002.sql', 'utf8'));
  // API fixture keeps ownership triggers out so corruption can be injected below.
  // Real V003/V004 triggers and legal transitions are exercised by Collector PostgreSQL tests.
  const lifecycle=await readFile('apps/collector/src/main/resources/db/collector-v004.sql','utf8');
  await pool.transaction(manager=>manager.query(lifecycle.slice(0,lifecycle.indexOf('CREATE OR REPLACE FUNCTION'))));
  const root = await mkdtemp('/private/tmp/blariyo-batch-review-');
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = localStorage(root + '/api');
  const token = randomBytes(32).toString('hex'), actor = 'admin:v1:' + randomBytes(32).toString('base64url');
  const app = await createNestApplication({databaseUrl, storage, serviceToken:token,
    collectBatchReviewEnabled:true, collectReader:new LocalCollectReader(root + '/batch')});
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const request = (path:string, body?:unknown, key=randomUUID(), auth=true) => fetch(origin+'/api/v1'+path, {
    method:body===undefined?'GET':'POST', headers:auth?{'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'Idempotency-Key':key,'content-type':'application/json'}:{},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const status = async (response:Promise<Response>, expected:number) => {const r=await response;assert.equal(r.status,expected,await r.text());};
  const id=randomUUID(), run=randomUUID(), mediaId=randomUUID(), key=`collect/media/${mediaId}/1`;
  const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#00a19b'}}).png().toBuffer();
  await mkdir(root+'/batch/collect/media/'+mediaId,{recursive:true});
  await writeFile(root+'/batch/'+key,bytes);
  const source='https://example.invalid/게시글-1';
  const blocks=[...Array.from({length:57},(_,i)=>({type:'TEXT',text:`원문 ${i+1}`})),
    {type:'IMAGE',imagePosition:1,alt:'수집 이미지'},
    {type:'LINK',url:'https://x.com/example/status/123456789',label:'원문 SNS'}];
  await pool.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','example.invalid','fixture-v1')");
  await pool.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'fixture','hot','WRITE_DB','COMPLETED',1,1,10000)",[run]);
  await pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,sns_links,version)
    VALUES($1,$2,'fixture','1',$3,$4,'FETCHED','격리 원문',$5,$6,1)`,[id,run,source,createHash('sha256').update(source).digest(),JSON.stringify(blocks),JSON.stringify(['https://x.com/example/status/123456789'])]);
  await pool.query("INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,sha256,mime_type,byte_size,object_key) VALUES($1,$2,1,'IMAGE','https://example.invalid/1.png',$3,'image/jpeg',$4,$5)",[mediaId,id,createHash('sha256').update(bytes).digest(),bytes.length,key]);
  const path='/admin/collect/batch-items/'+id;
  await t.test('authenticated list/detail retain long body and never expose object keys',async()=>{
    await status(request('/admin/collect/batch-items',undefined,randomUUID(),false),401);
    const list=await contractSuccess('listBatchItems',await request('/admin/collect/batch-items'));
    assert.equal(list.data.totalItems,1);
    const detail=await contractSuccess('getBatchItem',await request(path));
    assert.equal(detail.data.item.bodyBlocks.length,59);
    assert.equal(detail.data.item.canonicalUrl,new URL(source).href);
    assert.ok(!JSON.stringify(detail).includes(key));
    assert.equal(detail.data.item.review.status,'UNREVIEWED');
    await status(request(path+'/media/1/preview',undefined,randomUUID(),false),401);
    const preview=await request(path+'/media/1/preview');assert.equal(preview.status,200);
    assert.equal(preview.headers.get('content-type'),'image/png');
    assert.equal(preview.headers.get('cache-control'),'private, no-store');
    assert.equal((await sharp(Buffer.from(await preview.arrayBuffer())).metadata()).format,'png');
    await status(request(path+'/media/2/preview'),404);
    assert.equal((await storage.inventory('private')).length,0);
  });
  await t.test('review state/version and idempotency are enforced',async()=>{
    await status(request(path+'/review',{itemVersion:1,lockVersion:0,decision:'APPROVED'}),409);
    const receipt=randomUUID(), body={itemVersion:1,lockVersion:0,decision:'REVIEWING'};
    const started=(await contractSuccess('reviewBatchItem',await request(path+'/review',body,receipt),'POST')).data;
    assert.equal(started.review.lockVersion,1);
    const repeated=(await contractSuccess('reviewBatchItem',await request(path+'/review',body,receipt),'POST')).data;
    assert.deepEqual(repeated,started);
    await status(request(path+'/review',{...body,decision:'REJECTED'},receipt),409);
    await status(request(path+'/review',{itemVersion:1,lockVersion:0,decision:'APPROVED'}),409);
    const approved=await contractSuccess('reviewBatchItem',await request(path+'/review',{itemVersion:1,lockVersion:1,decision:'APPROVED'}),'POST');
    assert.equal(approved.data.review.lockVersion,2);
    await assert.rejects(pool.query("UPDATE collect.batch_review SET status='REJECTED' WHERE item_id=$1",[id]));
  });
  let postId=0;
  const draftKey=randomUUID(), draftBody={itemVersion:1,lockVersion:2,boardSlug:'meme'};
  await t.test('corrupt collect object fails without draft and restored bytes allow the same request',async()=>{
    await writeFile(root+'/batch/'+key,Buffer.alloc(bytes.length));
    await status(request(path+'/draft',draftBody,draftKey),409);
    assert.equal(Number(requiredRow(await pool.query('SELECT count(*) FROM content.board_post')).count),0);
    assert.equal((await storage.inventory('private')).length,0);
    await writeFile(root+'/batch/'+key,bytes);
    const created=(await contractSuccess('promoteBatchItem',await request(path+'/draft',draftBody,draftKey),'POST')).data;
    assert.equal(created.status,'DRAFT');postId=created.postId;
    assert.equal(created.lockVersion,1);assert.equal(created.reviewLockVersion,3);
    assert.equal((await storage.inventory('public')).length,0);
    assert.equal((await storage.inventory('private')).length,1);
    assert.equal(Number(requiredRow(await pool.query('SELECT count(*) FROM content.board_post_block WHERE post_id=$1',[postId])).count),60);
    const replay=(await contractSuccess('promoteBatchItem',await request(path+'/draft',draftBody,draftKey),'POST')).data;
    assert.deepEqual(replay,created);
    await status(request(path+'/draft',draftBody),409);
    await status(request('/boards/meme/posts/'+postId),404);
    const item=requiredRow(await pool.query('SELECT state,version FROM collect.batch_item WHERE id=$1',[id]));
    assert.equal(item.state,'FETCHED');assert.equal(String(item.version),'1');
  });
  await t.test('separate publish/hide/outbox/republish preserves private copy and recreates public copy',async()=>{
    const base='/admin/posts/'+postId;
    const published=(await contractSuccess('publishPost',await request(base+'/publish',{lockVersion:1,mode:'IMMEDIATE'}),'POST')).data;
    const image=requiredRow(await pool.query('SELECT public_storage_key,private_storage_key FROM content.board_post_image WHERE post_id=$1',[postId]));
    const publicKey=String(image.public_storage_key),privateKey=String(image.private_storage_key);
    assert.ok(publicKey.startsWith(`content/published/posts/${postId}/`));
    assert.ok(privateKey.startsWith('content/private/staging/'));
    const original=await storage.get('private',privateKey);
    assert.deepEqual(await storage.get('public',publicKey),original);
    const detail=await contractSuccess('getPost',await request('/boards/meme/posts/'+postId));
    assert.equal(detail.data.post.blocks.length,60);
    const hidden=(await contractSuccess('hidePost',await request(base+'/hide',{lockVersion:published.lockVersion,reasonCode:'RIGHTS_EMAIL'}),'POST')).data;
    await app.get(OutboxService).run();
    await assert.rejects(storage.get('public',publicKey));
    assert.deepEqual(await storage.get('private',privateKey),original);
    await contractSuccess('republishPost',await request(base+'/republish',{lockVersion:hidden.lockVersion,pinnedPosition:null}),'POST');
    assert.deepEqual(await storage.get('public',publicKey),original);
  });
  const seed = async (suffix:string,body:unknown,sourceUrl=`https://example.invalid/${suffix}`) => {
    const itemId=randomUUID();
    await pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,version)
      VALUES($1,$2,'fixture',$3,$4,$5,'FETCHED','격리 원문',$6,1)`,[itemId,run,suffix,sourceUrl,createHash('sha256').update(sourceUrl).digest(),JSON.stringify(body)]);
    return {id:itemId,path:'/admin/collect/batch-items/'+itemId};
  };
  const approve = async (path:string) => {
    await status(request(path+'/review',{itemVersion:1,lockVersion:0,decision:'REVIEWING'}),200);
    await status(request(path+'/review',{itemVersion:1,lockVersion:1,decision:'APPROVED'}),200);
  };
  await t.test('one corrupt body cannot break list and changed content requires a new review snapshot',async()=>{
    const bad=await seed('bad',{bad:'structure'});
    await status(request('/admin/collect/batch-items'),200);
    await status(request(bad.path),409);
    const next=await seed('changed',[{type:'TEXT',text:'first version'}]);
    await status(request(next.path+'/review',{itemVersion:1,lockVersion:0,decision:'REVIEWING'}),200);
    await pool.query('UPDATE collect.batch_item SET body_blocks=$1 WHERE id=$2',[JSON.stringify([{type:'TEXT',text:'unversioned change'}]),next.id]);
    await status(request(next.path+'/review',{itemVersion:1,lockVersion:1,decision:'APPROVED'}),409);
    await status(request(next.path+'/review',{itemVersion:1,lockVersion:1,decision:'REVIEWING'}),200);
    await status(request(next.path+'/review',{itemVersion:1,lockVersion:2,decision:'APPROVED'}),200);
    await pool.query('UPDATE collect.batch_item SET version=version+1 WHERE id=$1',[next.id]);
    await status(request(next.path+'/draft',{itemVersion:1,lockVersion:3,boardSlug:'meme'}),409);
    await status(request(next.path+'/draft',{itemVersion:2,lockVersion:3,boardSlug:'meme'}),409);
  });
  await t.test('second image failure is compensated and same-key concurrent retry creates one private draft',async()=>{
    const next=await seed('partial',[{type:'IMAGE',imagePosition:1,alt:'first'},{type:'IMAGE',imagePosition:2,alt:'second'}]);
    const dir=`${root}/batch/collect/media/${next.id}`;await mkdir(dir,{recursive:true});
    for(const position of [1,2]){
      await writeFile(`${dir}/${position}`,position===1?bytes:Buffer.alloc(bytes.length));
      await pool.query("INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key) VALUES($1,$2,$3,'IMAGE',$4,'image/png',$5,$6)",[randomUUID(),next.id,position,createHash('sha256').update(bytes).digest(),bytes.length,`collect/media/${next.id}/${position}`]);
    }
    await approve(next.path);
    const body={itemVersion:1,lockVersion:2,boardSlug:'meme'},key=randomUUID();
    await status(request(next.path+'/draft',body,key),409);
    assert.equal(Number(requiredRow(await pool.query("SELECT count(*) FROM content.board_post WHERE status='DRAFT'")).count),0);
    assert.equal(Number(requiredRow(await pool.query("SELECT count(*) FROM content.board_post_image WHERE status='PRIVATE_DELETE_PENDING'")).count),1);
    await app.get(OutboxService).run();
    assert.equal((await storage.inventory('private')).length,1);
    await writeFile(`${dir}/2`,bytes);
    const responses=await Promise.all([request(next.path+'/draft',body,key),request(next.path+'/draft',body,key)]);
    const values=await Promise.all(responses.map(r=>contractSuccess('promoteBatchItem',r,'POST')));
    assert.deepEqual(values[0]?.data,values[1]?.data);
    assert.equal((await storage.inventory('public')).length,1);
    assert.equal((await storage.inventory('private')).length,3);
  });
  await t.test('legacy canonical duplicate and source post key uniqueness are enforced',async()=>{
    const next=await seed('encoded-duplicate',[{type:'TEXT',text:'same source'}],new URL(source).href);
    await approve(next.path);
    await status(request(next.path+'/draft',{itemVersion:1,lockVersion:2,boardSlug:'meme'}),409);
    await assert.rejects(seed('encoded-duplicate',[{type:'TEXT',text:'different URL'}],'https://example.invalid/another-source'));
    await assert.rejects(seed('different-key',[{type:'TEXT',text:'same URL'}],new URL(source).href));
  });
  await t.test('257-frame collect animation survives authenticated preview and private draft promotion', async () => {
    const animatedId=randomUUID(), animatedKey=`collect/media/${animatedId}/1`, canonical=`https://example.invalid/${animatedId}`;
    const animation=await sharp({create:{width:2,height:514,pageHeight:2,channels:3,background:'blue'}})
      .gif({keepDuplicateFrames:true,delay:Array(257).fill(20),loop:2}).toBuffer();
    await mkdir(root+'/batch/collect/media/'+animatedId,{recursive:true});
    await writeFile(root+'/batch/'+animatedKey,animation);
    await pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,version)
      VALUES($1::uuid,$2,'fixture',$1::text,$3,$4,'FETCHED','애니메이션 검수',$5,1)`,
      [animatedId,run,canonical,createHash('sha256').update(canonical).digest(),JSON.stringify([{type:'IMAGE',imagePosition:1,alt:'257프레임'}])]);
    await pool.query(`INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key)
      VALUES($1,$2,1,'IMAGE',$3,'image/gif',$4,$5)`,[randomUUID(),animatedId,createHash('sha256').update(animation).digest(),animation.length,animatedKey]);
    const animatedPath='/admin/collect/batch-items/'+animatedId;
    const preview=await request(animatedPath+'/media/1/preview');assert.equal(preview.status,200);
    assert.equal((await sharp(Buffer.from(await preview.arrayBuffer()),{animated:true}).metadata()).pages,257);
    await status(request(animatedPath+'/review',{itemVersion:1,lockVersion:0,decision:'REVIEWING'}),200);
    await status(request(animatedPath+'/review',{itemVersion:1,lockVersion:1,decision:'APPROVED'}),200);
    const promoted=(await contractSuccess('promoteBatchItem',await request(animatedPath+'/draft',{itemVersion:1,lockVersion:2,boardSlug:'meme'}),'POST')).data;
    const row=requiredRow(await pool.query('SELECT private_storage_key,public_storage_key FROM content.board_post_image WHERE post_id=$1',[promoted.postId]));
    assert.equal(row.public_storage_key,null);
    const result=await sharp(await storage.get('private',String(row.private_storage_key)),{animated:true}).metadata();
    assert.equal(result.pages,257);assert.equal(result.loop,2);assert.deepEqual(result.delay,Array(257).fill(20));
    await status(request('/boards/meme/posts/'+promoted.postId),404);
  });

  await t.test('failed and policy-skipped items expose reasons and cannot enter review',async()=>{
    for(const [state,code,reason] of [['FAILED','SOURCE_GONE',null],['SKIPPED_POLICY',null,'SOURCE_DATE_UNKNOWN']] as const){
      const item=randomUUID(),url='https://example.invalid/'+item;
      await pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,failure_code,skip_reason)
        VALUES($1::uuid,$2,'fixture',$1::text,$3,$4,$5,$6,$7)`,[item,run,url,createHash('sha256').update(url).digest(),state,code,reason]);
      const response=await contractSuccess('getBatchItem',await request('/admin/collect/batch-items/'+item));
      assert.equal(response.data.item.state,state);assert.equal(response.data.item.failureCode,code);assert.equal(response.data.item.skipReason,reason);
      assert.deepEqual(response.data.item.bodyBlocks,[]);
      await status(request('/admin/collect/batch-items/'+item+'/review',{itemVersion:0,lockVersion:0,decision:'REVIEWING'}),409);
    }
    const listing=await contractSuccess('listBatchItems',await request('/admin/collect/batch-items'));
    assert.ok(listing.data.items.some(i=>i.state==='SKIPPED_POLICY'&&i.skipReason==='SOURCE_DATE_UNKNOWN'));
  });

  await t.test('49 images survive review, draft and separate publication without truncation',async()=>{
    const blocks=Array.from({length:49},(_,i)=>({type:'IMAGE',imagePosition:i+1,alt:`image ${i+1}`}));
    const next=await seed('gallery-49',blocks);
    const dir=`${root}/batch/collect/media/${next.id}`;await mkdir(dir,{recursive:true});
    for(let position=1;position<=49;position++){
      await writeFile(`${dir}/${position}`,bytes);
      await pool.query("INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key) VALUES($1,$2,$3,'IMAGE',$4,'image/png',$5,$6)",[randomUUID(),next.id,position,createHash('sha256').update(bytes).digest(),bytes.length,`collect/media/${next.id}/${position}`]);
    }
    await status(request(next.path+'/media/49/preview'),200);
    await approve(next.path);
    const beforePublic=(await storage.inventory('public')).length;
    const promoted=(await contractSuccess('promoteBatchItem',await request(next.path+'/draft',{itemVersion:1,lockVersion:2,boardSlug:'meme'}),'POST')).data;
    assert.equal(promoted.status,'DRAFT');
    assert.equal((await storage.inventory('public')).length,beforePublic);
    const rows=await pool.query<{private_storage_key:string}[]>('SELECT private_storage_key FROM content.board_post_image WHERE post_id=$1',[promoted.postId]);
    assert.equal(rows.length,49);
    for(const row of rows)await sharp(await storage.get('private',String(row.private_storage_key))).stats();
    await status(request('/admin/posts/'+promoted.postId+'/publish',{lockVersion:1,mode:'IMMEDIATE'}),200);
    const response=await contractSuccess('getPost',await request('/boards/meme/posts/'+promoted.postId));
    assert.equal(response.data.post.blocks.length,49);
    assert.equal((await storage.inventory('public')).length,beforePublic+49);
  });
  await t.test('aggregate media size is rejected before any private writes or object reads',async()=>{
    const next=await seed('gallery-over-budget',Array.from({length:6},(_,i)=>({type:'IMAGE',imagePosition:i+1,alt:'large'})));
    for(let position=1;position<=6;position++)await pool.query("INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key) VALUES($1,$2,$3,'IMAGE',$4,'image/png',$5,$6)",[randomUUID(),next.id,position,createHash('sha256').update(bytes).digest(),30*1024*1024,`collect/media/${next.id}/${position}`]);
    await approve(next.path);
    const before=(await storage.inventory('private')).length;
    await status(request(next.path+'/draft',{itemVersion:1,lockVersion:2,boardSlug:'meme'}),413);
    assert.equal((await storage.inventory('private')).length,before);
    assert.equal(Number(requiredRow(await pool.query('SELECT count(*) FROM collect.batch_review WHERE item_id=$1 AND post_id IS NOT NULL',[next.id])).count),0);
  });

  await t.test('expired preparation compensates private images and permits the same-key retry',async(t)=>{
    const next=await seed('preparation-timeout',[{type:'IMAGE',imagePosition:1,alt:'deadline'}]);
    const objectKey=`collect/media/${next.id}/1`;
    await mkdir(`${root}/batch/collect/media/${next.id}`,{recursive:true});
    await writeFile(`${root}/batch/${objectKey}`,bytes);
    await pool.query("INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key) VALUES($1,$2,1,'IMAGE',$3,'image/png',$4,$5)",
      [randomUUID(),next.id,createHash('sha256').update(bytes).digest(),bytes.length,objectKey]);
    await approve(next.path);
    const before=(await storage.inventory('private')).length;
    const beforePublic=(await storage.inventory('public')).length;
    const now=performance.now.bind(performance),put=storage.put.bind(storage);
    let elapsed=0;
    const clock=t.mock.method(performance,'now',()=>now()+elapsed);
    const writer=t.mock.method(storage,'put',async(...args:Parameters<typeof put>)=>{
      await put(...args);elapsed=120001;
    });
    const body={itemVersion:1,lockVersion:2,boardSlug:'meme'},key=randomUUID();
    try {await status(request(next.path+'/draft',body,key),503);}
    finally {clock.mock.restore();writer.mock.restore();}
    assert.equal(Number(requiredRow(await pool.query('SELECT count(*) FROM collect.batch_review WHERE item_id=$1 AND post_id IS NOT NULL',[next.id])).count),0);
    await app.get(OutboxService).run();
    assert.equal((await storage.inventory('private')).length,before);
    assert.equal((await storage.inventory('public')).length,beforePublic);
    assert.deepEqual(await readFile(`${root}/batch/${objectKey}`),bytes);
    const promoted=(await contractSuccess('promoteBatchItem',await request(next.path+'/draft',body,key),'POST')).data;
    assert.equal(promoted.status,'DRAFT');
    assert.equal((await storage.inventory('private')).length,before+1);
    await status(request('/boards/meme/posts/'+promoted.postId),404);
    const replay=(await contractSuccess('promoteBatchItem',await request(next.path+'/draft',body,key),'POST')).data;
    assert.deepEqual(replay,promoted);
  });

  await t.test('file attachment remains a source link through review and publish without public collect access',async()=>{
    const remote='https://example.invalid/document.pdf';
    const next=await seed('file-attachment',[{type:'LINK',url:remote,label:'document.pdf'}]);
    const file=Buffer.from('%PDF-1.7\nfixture bytes retained in collect only\n%%EOF');
    const objectKey=`collect/media/${next.id}/1`;
    await mkdir(`${root}/batch/collect/media/${next.id}`,{recursive:true});
    await writeFile(`${root}/batch/${objectKey}`,file);
    await pool.query('UPDATE collect.batch_item SET attachment_metadata=$2 WHERE id=$1',
      [next.id,JSON.stringify([{position:1,remoteUrl:remote,label:'document.pdf'}])]);
    await pool.query("INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,sha256,mime_type,byte_size,object_key) VALUES($1,$2,1,'FILE',$3,$4,'application/pdf',$5,$6)",
      [randomUUID(),next.id,remote,createHash('sha256').update(file).digest(),file.length,objectKey]);
    const detail=(await contractSuccess('getBatchItem',await request(next.path))).data.item;
    assert.equal(detail.attachments.length,1);assert.equal(detail.media[0]?.kind,'FILE');
    assert.equal(detail.attachments[0]?.remoteUrl,remote);
    await status(request(next.path+'/media/1/preview'),404);
    await approve(next.path);
    const beforePrivate=(await storage.inventory('private')).length,beforePublic=(await storage.inventory('public')).length;
    const promoted=(await contractSuccess('promoteBatchItem',await request(next.path+'/draft',{itemVersion:1,lockVersion:2,boardSlug:'meme'}),'POST')).data;
    await status(request('/boards/meme/posts/'+promoted.postId),404);
    await status(request('/admin/posts/'+promoted.postId+'/publish',{lockVersion:1,mode:'IMMEDIATE'}),200);
    const published=(await contractSuccess('getPost',await request('/boards/meme/posts/'+promoted.postId))).data.post;
    assert.deepEqual(published.blocks.map(b=>b.type==='TEXT'?b.text:null),['document.pdf',remote]);
    assert.equal((await storage.inventory('private')).length,beforePrivate);
    assert.equal((await storage.inventory('public')).length,beforePublic);
    assert.deepEqual(await readFile(`${root}/batch/${objectKey}`),file);
  });

  await t.test('combined source/state/review filters count and paginate unreviewed rows consistently', async () => {
    const filterRun = randomUUID(), ids: string[] = [];
    await pool.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('filter-fixture','filter.invalid','fixture-v1')");
    await pool.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'filter-fixture','hot','WRITE_DB','COMPLETED',1,30,10000)", [filterRun]);
    for (let index = 0; index < 23; index++) {
      const id = randomUUID(), url = `https://filter.invalid/${id}`;
      ids.push(id);
      await pool.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,version)
        VALUES($1::uuid,$2,'filter-fixture',$1::text,$3,$4,$5,'필터 표본',$6,1)`,
      [id,filterRun,url,createHash('sha256').update(url).digest(),index === 22 ? 'FAILED' : 'FETCHED',JSON.stringify([{type:'TEXT',text:'filter fixture'}])]);
    }
    const reviewed = '/admin/collect/batch-items/' + ids[0];
    await status(request(reviewed+'/review',{itemVersion:1,lockVersion:0,decision:'REVIEWING'}),200);
    await status(request(reviewed+'/review',{itemVersion:1,lockVersion:1,decision:'REJECTED'}),200);
    const query = '/admin/collect/batch-items?source=filter-fixture&state=FETCHED&reviewStatus=UNREVIEWED';
    const first = (await contractSuccess('listBatchItems',await request(query))).data;
    const second = (await contractSuccess('listBatchItems',await request(query+'&page=2'))).data;
    assert.equal(first.totalItems,21);assert.equal(first.totalPages,2);assert.equal(first.items.length,20);
    assert.equal(second.totalItems,21);assert.equal(second.page,2);assert.equal(second.items.length,1);
    assert.equal(new Set([...first.items,...second.items].map(item=>item.itemId)).size,21);
    assert.ok([...first.items,...second.items].every(item=>item.sourceKey==='filter-fixture'&&item.state==='FETCHED'&&item.review.status==='UNREVIEWED'));
    const rejected = (await contractSuccess('listBatchItems',await request(query.replace('UNREVIEWED','REJECTED')))).data;
    assert.equal(rejected.totalItems,1);assert.equal(rejected.items[0]?.itemId,ids[0]);
    const failed = (await contractSuccess('listBatchItems',await request(query.replace('FETCHED','FAILED')))).data;
    assert.equal(failed.totalItems,1);assert.equal(failed.items[0]?.itemId,ids[22]);
    const empty = (await contractSuccess('listBatchItems',await request(query.replace('UNREVIEWED','APPROVED')))).data;
    assert.equal(empty.totalItems,0);assert.equal(empty.totalPages,1);assert.deepEqual(empty.items,[]);
    await status(request('/admin/collect/batch-items?state=INVALID'),400);
    await status(request('/admin/collect/batch-items?reviewStatus=INVALID'),400);
  });
});
