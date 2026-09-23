// Runs only inside a caller-owned disposable container/network/database.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createNestApplication } from '/app/apps/api/dist/bootstrap/application.js';
import { localStorage } from '/app/apps/api/dist/adapters/storage.js';
import { OutboxService } from '/app/apps/api/dist/operations/outbox.service.js';
import { CleanupService } from '/app/apps/api/dist/operations/cleanup.service.js';
import { PostsService } from '/app/apps/api/dist/features/posts/posts.service.js';
const sharp = createRequire('/app/package.json')('sharp');
const mode = process.argv[2];
assert.ok(['seed', 'exercise', 'not-ready'].includes(mode));
const storage = localStorage('/compat-data/media');
const serviceToken = randomBytes(32).toString('hex');
const app = await createNestApplication({
  databaseUrl: process.env.DATABASE_URL, storage, serviceToken,
  collectManualUrlEnabled: false, collectDiscordCommandEnabled: false, collectBatchReviewEnabled: false,
});
try {
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  const response = await fetch(origin + '/internal/health/ready');
  assert.equal(response.status, mode === 'not-ready' ? 503 : 200);
  if (mode === 'not-ready') {
    console.log(JSON.stringify({mode, readiness:503, writes:0}));
  } else {
    const headers = {'X-Blariyo-Service-Token':serviceToken,'X-Blariyo-Admin-Actor':'admin:v1:'+'a'.repeat(43)};
    async function request(path, body, method='POST') {
      const response = await fetch(origin+'/api/v1'+path, {
        method:body === undefined ? 'GET' : method,
        headers:{...headers, 'Content-Type':'application/json','Idempotency-Key':randomUUID()},
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),
      });
      const data = await response.json();
      assert.ok(response.ok, JSON.stringify({status:response.status,error:data.error}));
      return data.data;
    }
    if (mode === 'exercise') {
      const previous = JSON.parse(await readFile('/compat-data/post.json','utf8'));
      const post = await request('/admin/posts/'+previous.postId);
      assert.equal(post.status,'PUBLISHED');assert.equal(post.title,previous.title);
      const image = post.blocks.find(block=>block.type==='IMAGE');
      assert.ok(image);assert.equal(image.imageId,previous.imageId);
      const preview = await fetch(origin+`/api/v1/admin/images/${image.imageId}/preview`,{headers});
      assert.equal(preview.status,200);
      assert.equal(createHash('sha256').update(Buffer.from(await preview.arrayBuffer())).digest('hex'),previous.previewHash);
      const hidden = await request('/admin/posts/'+previous.postId+'/hide',{lockVersion:post.lockVersion,reasonCode:'EDIT'});
      await app.get(OutboxService).run();
      assert.equal((await fetch(origin+`/api/v1/boards/meme/posts/${previous.postId}`)).status,404);
      const edited = await request('/admin/posts/'+previous.postId,{lockVersion:hidden.lockVersion,title:post.title+' edited',source:post.source,blocks:post.blocks.map(block=>block.type==='TEXT'?{type:'TEXT',text:block.text}:{type:'IMAGE',imageId:block.imageId,alt:block.alt})},'PATCH');
      await request('/admin/posts/'+previous.postId+'/republish',{lockVersion:edited.lockVersion,pinnedPosition:null});
      assert.equal((await fetch(origin+`/api/v1/boards/meme/posts/${previous.postId}`)).status,200);
    }
    const bytes = await sharp({create:{width:12,height:12,channels:3,background:'#008080'}}).png().toBuffer();
    const form = new FormData();form.append('files',new Blob([bytes],{type:'image/png'}),'fixture.png');
    const upload = await fetch(origin+'/api/v1/admin/images',{method:'POST',headers,body:form});
    assert.equal(upload.status,200);const image=(await upload.json()).data.items[0];
    const preview=await fetch(origin+`/api/v1/admin/images/${image.imageId}/preview`,{headers});assert.equal(preview.status,200);
    const previewHash=createHash('sha256').update(Buffer.from(await preview.arrayBuffer())).digest('hex');
    const title=`Compatibility ${randomUUID()}`;
    const draft=await request('/admin/posts',{boardSlug:'meme',title,source:null,pinnedPosition:null,blocks:[{type:'TEXT',text:'Isolated release compatibility fixture.'},{type:'IMAGE',imageId:image.imageId,alt:'Synthetic image'}]});
    await request(`/admin/posts/${draft.postId}/publish`,{lockVersion:draft.lockVersion,mode:'IMMEDIATE'});
    assert.equal((await fetch(origin+`/api/v1/boards/meme/posts/${draft.postId}`)).status,200);
    const scheduled=await request('/admin/posts',{boardSlug:'meme',title:'Schedule compatibility',source:null,pinnedPosition:null,blocks:[{type:'TEXT',text:'Cancellation test.'}]});
    const future=new Date(Date.now()+7*86400000);future.setUTCHours(8,30,0,0);
    const schedule=await request(`/admin/posts/${scheduled.postId}/publish`,{lockVersion:scheduled.lockVersion,mode:'SCHEDULED',scheduledAt:future.toISOString()});
    await request(`/admin/posts/${scheduled.postId}/unschedule`,{lockVersion:schedule.lockVersion});
    await app.get(PostsService).publishDue();
    await app.get(OutboxService).run();
    await app.get(CleanupService).run();
    assert.equal((await request('/admin/posts/'+scheduled.postId)).status,'DRAFT');
    await writeFile('/compat-data/post.json',JSON.stringify({postId:draft.postId,title,imageId:image.imageId,previewHash}));
    console.log(JSON.stringify({mode,readiness:200,postId:draft.postId,preview:true,published:true,editedPrevious:mode==='exercise',hideRepublish:mode==='exercise',scheduleCancel:true,workers:true}));
  }
} finally {await app.close();}
