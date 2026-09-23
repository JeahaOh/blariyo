import {decodeCollectedFrames} from '../../apps/api/dist/features/images/collected-animation.js';
// Read-only DB/HTTP/object audit of the fixed local development target.
import pg from 'pg';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {validateCollectedImage} from '../../apps/api/dist/features/images/image-validation.js';
import {normalizeInput} from '@blariyo/contracts';
const origin='http://localhost:3000';
const root=resolve('.local-data/media');
const c=new pg.Client({connectionString:'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local'});
const report={at:new Date().toISOString(),origin,posts:[],images:[],bodies:[],sns:{total:0,missing:0},list:{pages:0,total:0,unique:0},negative:[]};
function path(bucket,key){const base=resolve(root,bucket),p=resolve(base,key);if(!p.startsWith(base+sep))throw Error('INVALID_KEY');return p;}
await c.connect();
try{
  const posts=(await c.query(`SELECT p.id::text,p.source_name,p.source_url,
    (SELECT count(*)::int FROM content.board_post_block b WHERE b.post_id=p.id) AS blocks
    FROM content.board_post p WHERE status='PUBLISHED' ORDER BY id`)).rows;
  const listIds=[];
  for(let page=1;page<=Math.ceil(posts.length/20);page++){
    const r=await fetch(`${origin}/api/v1/boards/meme/posts?page=${page}`),j=await r.json();
    if(!r.ok)throw Error('LIST_FAILED');
    listIds.push(...j.data.items.map(p=>String(p.postId)));report.list.pages++;
  }
  report.list.total=listIds.length;report.list.unique=new Set(listIds).size;
  for(const p of posts){
    const r=await fetch(`${origin}/api/v1/boards/meme/posts/${p.id}`),j=await r.json(),post=j.data?.post;
    report.posts.push({id:p.id,source:p.source_name,status:r.status,blocks:post?.blocks?.length??0,
      pass:r.ok&&post.blocks.length===p.blocks&&post.source?.url===new URL(p.source_url).href&&listIds.includes(p.id)});
  }
  const images=(await c.query(`SELECT id::text,post_id::text,public_storage_key,private_storage_key,
    encode(content_sha256,'hex') AS hash,byte_size,mime_type,width,height FROM content.board_post_image WHERE status='PUBLIC' ORDER BY id`)).rows;
  for(const i of images){
    const r=await fetch(`${origin}/media/${i.public_storage_key}`),bytes=Buffer.from(await r.arrayBuffer());
    let pass=false;
    try{
      const m=await sharp(bytes).metadata(),mime={jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}[m.format];
      const privateBytes=await readFile(path('private',i.private_storage_key));
      const publicBytes=await readFile(path('public',i.public_storage_key));
      await decodeCollectedFrames(bytes,m);
      pass=r.ok&&createHash('sha256').update(bytes).digest('hex')===i.hash&&bytes.length===i.byte_size&&
        mime===i.mime_type&&r.headers.get('content-type')?.split(';')[0]===mime&&m.width===i.width&&(m.pageHeight||m.height)===i.height&&
        bytes.equals(privateBytes)&&bytes.equals(publicBytes);
    }catch{}
    report.images.push({id:i.id,postId:i.post_id,status:r.status,pass,bytes:bytes.length});
  }
  const originals=(await c.query(`SELECT p.id,i.sns_links,
    (SELECT string_agg(b.text_content,E'\n' ORDER BY position) FROM content.board_post_block b WHERE b.post_id=p.id) AS text
    FROM content.board_post p JOIN collect.batch_item i ON i.canonical_url=p.source_url`)).rows;
  for(const row of originals)for(const link of row.sns_links){report.sns.total++;if(!(row.text||'').includes(link))report.sns.missing++;}
  const bodyRows=(await c.query(`SELECT p.id::text,i.body_blocks,
    EXISTS(SELECT 1 FROM collect.batch_review r WHERE r.item_id=i.id AND r.post_id=p.id) AS formally_promoted,
    (SELECT jsonb_object_agg(m.position::text,jsonb_build_object('key',m.object_key,'hash',encode(m.sha256,'hex'))) FROM collect.batch_media m WHERE m.item_id=i.id AND m.kind='IMAGE') AS originals,
    (SELECT jsonb_agg(jsonb_build_object('type',b.type,'text',b.text_content,'hash',encode(m.content_sha256,'hex')) ORDER BY b.position)
       FROM content.board_post_block b LEFT JOIN content.board_post_image m ON m.id=b.image_id WHERE b.post_id=p.id) AS stored,
    (SELECT jsonb_object_agg(m.position::text,encode(m.sha256,'hex')) FROM collect.batch_media m WHERE m.item_id=i.id AND m.kind='IMAGE') AS image_hashes
    FROM content.board_post p JOIN collect.batch_item i ON i.canonical_url=p.source_url OR EXISTS(SELECT 1 FROM collect.batch_review r WHERE r.item_id=i.id AND r.post_id=p.id) WHERE p.status='PUBLISHED' ORDER BY p.id`)).rows;
  for(const row of bodyRows){
    const imageHashes={...row.image_hashes};
    if(row.formally_promoted){
      for(const [position,original] of Object.entries(row.originals||{})){
        const base=resolve('.local-data/collector-objects');const source=resolve(base,original.key);
        if(!source.startsWith(base+sep)||!original.key.startsWith('collect/media/'))throw Error('INVALID_COLLECT_KEY');
        const bytes=await readFile(source);
        if(createHash('sha256').update(bytes).digest('hex')!==original.hash)throw Error('COLLECT_HASH_MISMATCH');
        // Formal promotion stores a validated re-encoded copy. Verify that exact transform,
        // alongside the independent public/private/DB binary audit above.
        const [validated]=await validateCollectedImage(bytes);
        imageHashes[position]=validated.hash.toString('hex');
      }
    }
    const blocks=row.formally_promoted?normalizeInput(row.body_blocks):row.body_blocks;
    const expected=blocks.flatMap(b=>b.type==='TEXT'?[{type:'TEXT',text:b.text,hash:null}]:
      b.type==='IMAGE'?[{type:'IMAGE',text:null,hash:imageHashes[b.imagePosition]}]:
      [...(b.label?.trim()&&b.label.trim()!==b.url?[{type:'TEXT',text:b.label.trim(),hash:null}]:[]),{type:'TEXT',text:b.url,hash:null}]);
    const pass=expected.length===row.stored.length&&expected.every((b,i)=>Object.entries(b).every(([key,value])=>row.stored[i][key]===value));
    report.bodies.push({id:row.id,formallyPromoted:row.formally_promoted,sourceBlocks:row.body_blocks.length,storedBlocks:row.stored.length,pass});
  }
  for(const key of ['collect/media/test/1','content/private/test.jpg']){
    const r=await fetch(`${origin}/media/${key}`);report.negative.push({key,status:r.status});
  }
  await mkdir('.local-data/verification',{recursive:true,mode:0o700});
  await writeFile('.local-data/verification/collected-content.json',JSON.stringify(report,null,2),{mode:0o600});
  const failures=report.posts.filter(x=>!x.pass).length+report.images.filter(x=>!x.pass).length+report.bodies.filter(x=>!x.pass).length+Number(report.bodies.length!==posts.length)+report.sns.missing+
    Number(listIds.length!==posts.length||new Set(listIds).size!==posts.length)+report.negative.filter(x=>x.status!==404).length;
  console.log(JSON.stringify({posts:report.posts.length,postFailures:report.posts.filter(x=>!x.pass),images:report.images.length,imageFailures:report.images.filter(x=>!x.pass),bodies:report.bodies.length,bodyFailures:report.bodies.filter(x=>!x.pass),sns:report.sns,list:report.list,failures}));
  if(failures)process.exitCode=1;
}finally{await c.end();}
