// Read-only comparison of every rendered frame in the five observed large animations.
import pg from 'pg';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {validateCollectedImage} from '../../apps/api/dist/features/images/image-validation.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=await realpath('.local-data/collector-objects');
const c=new pg.Client({connectionString:'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local'});
const report={at:new Date().toISOString(),items:[],comparedFrames:0,pass:false};
await c.connect();
try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const rows=(await c.query(`SELECT m.*,encode(m.sha256,'hex') AS hash,i.source_post_key
    FROM collect.batch_media m JOIN collect.batch_item i ON i.id=m.item_id
    WHERE (m.item_id='f28a41b9-1244-4615-b497-56daa7f4a093' AND m.position IN (2,8,12,17))
       OR (m.item_id='e908741c-359e-4c3a-a118-835b05fe5798' AND m.position=39)
    ORDER BY m.item_id,m.position`)).rows;
  assert.equal(rows.length,5);
  for(const row of rows){
    const path=await realpath(resolve(root,row.object_key));
    assert.ok(row.object_key.startsWith('collect/media/')&&path.startsWith(root+sep));
    const before=await readFile(path);assert.equal(hash(before),row.hash);assert.equal(before.length,Number(row.byte_size));
    const [result]=await validateCollectedImage(before),after=result.bytes;
    const original=await sharp(before).metadata(),clean=await sharp(after).metadata();
    assert.equal(clean.pages,original.pages);assert.equal(clean.width,original.width);assert.equal(clean.height,original.height);
    assert.deepEqual(clean.delay,original.delay);assert.equal(clean.loop,original.loop);
    assert.equal(clean.exif,undefined);assert.equal(clean.xmp,undefined);
    const pixels=original.width*original.height,perFrame=pixels*4,frameHashes=[];
    const count=Math.max(1,Math.min(16,Math.floor(40_000_000/pixels)));
    for(let page=0;page<original.pages;page+=count){
      const pages=Math.min(count,original.pages-page),options={page,pages,limitInputPixels:40_000_000,failOn:'warning'};
      const a=await sharp(before,options).ensureAlpha().raw().toBuffer(),b=await sharp(after,options).ensureAlpha().raw().toBuffer();
      assert.equal(a.length,perFrame*pages);assert.equal(b.length,a.length);
      for(let i=0;i<pages;i++){
        const originalHash=hash(a.subarray(i*perFrame,(i+1)*perFrame));
        assert.equal(hash(b.subarray(i*perFrame,(i+1)*perFrame)),originalHash);frameHashes.push(originalHash);
      }
    }
    assert.equal(frameHashes.length,original.pages);report.comparedFrames+=frameHashes.length;
    report.items.push({itemId:row.item_id,sourcePostKey:row.source_post_key,position:row.position,format:original.format,
      frames:original.pages,comparedFrames:frameHashes.length,width:original.width,height:original.height,
      beforeBytes:before.length,afterBytes:after.length,originalSha256:row.hash,cleanSha256:hash(after),
      pixelSequenceSha256:hash(frameHashes.join('\n')),timingAndLoopUnchanged:true,pass:true});
  }
  await c.query('COMMIT');report.pass=true;
  await mkdir('.local-data/verification',{recursive:true,mode:0o700});
  await writeFile('.local-data/verification/collected-animations.json',JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify({items:report.items.length,comparedFrames:report.comparedFrames,pass:report.pass}));
}finally{await c.end();}
