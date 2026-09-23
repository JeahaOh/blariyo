import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {validateCollectedImage,validateImages} from '../dist/features/images/image-validation.js';
import {decodeCollectedFrames,sanitizeLargeAnimation} from '../dist/features/images/collected-animation.js';
const width=640,height=480,frames=224;
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

async function gifFixture(count=frames) {
  const colors=await Promise.all(['red','green'].map(background=>sharp({create:{width,height,channels:3,background}}).gif().toBuffer()));
  const first=colors[0]!;
  const tableEnd=(b:Buffer)=>13+3*(2**((b[10]!&7)+1));
  const header=Buffer.from(first.subarray(0,tableEnd(first)));header.write('GIF89a');
  const loop=Buffer.concat([Buffer.from([0x21,0xff,11]),Buffer.from('NETSCAPE2.0'),Buffer.from([3,1,2,0,0])]);
  const parts:Buffer[]=[header,loop];
  for(let i=0;i<count;i++){
    const single=colors[i%2]!,end=tableEnd(single),offset=single.indexOf(0x2c,end);
    assert.ok(offset>=end);assert.equal(single[offset+9]!&128,0);
    const descriptor=Buffer.from(single.subarray(offset,offset+10));descriptor[9]=128|(single[10]!&7);
    parts.push(Buffer.from([0x21,0xf9,4,4,i%2?3:2,0,0,0]),descriptor,single.subarray(13,end),single.subarray(offset+10,-1));
  }
  // Non-display comment and bytes after the trailer must not survive.
  parts.push(Buffer.from([0x21,0xfe,4]),Buffer.from('note'),Buffer.from([0,0x3b]));
  return Buffer.concat(parts);
}
function chunks(bytes:Buffer){
  const result:Buffer[]=[];for(let at=12;at<bytes.readUInt32LE(4)+8;){const size=bytes.readUInt32LE(at+4),end=at+8+size+(size&1);result.push(bytes.subarray(at,end));at=end;}return result;
}
function riff(parts:Buffer[]){const header=Buffer.from('RIFF\0\0\0\0WEBP','binary'),body=Buffer.concat(parts);header.writeUInt32LE(body.length+4,4);return Buffer.concat([header,body]);}
async function webpFixture(){
  const red=await sharp({create:{width,height,channels:4,background:'red'}}).raw().toBuffer();
  const green=await sharp({create:{width,height,channels:4,background:{r:0,g:200,b:0,alpha:0.5}}}).raw().toBuffer();
  const base=await sharp(Buffer.concat([red,green]),{raw:{width,height:height*2,pageHeight:height,channels:4}})
    .withExif({IFD0:{Artist:'PRIVATE_METADATA'}}).webp({lossless:true,loop:3,delay:[20,30]}).toBuffer();
  const blocks=chunks(base),frameBlocks=blocks.filter(b=>b.toString('ascii',0,4)==='ANMF');assert.equal(frameBlocks.length,2);
  const parts=blocks.filter(b=>['VP8X','ICCP','ANIM'].includes(b.toString('ascii',0,4)));
  for(let i=0;i<frames;i++)parts.push(frameBlocks[i%2]!);
  parts.push(...blocks.filter(b=>b.toString('ascii',0,4)==='EXIF'));
  return Buffer.concat([riff(parts),Buffer.from('TRAILING_PRIVATE_DATA')]);
}
async function sameFrames(before:Buffer,after:Buffer){
  const meta=await sharp(before).metadata(),result=await sharp(after).metadata();
  assert.equal(result.pages,meta.pages);assert.deepEqual(result.delay,meta.delay);assert.equal(result.loop,meta.loop);
  assert.equal(result.width,meta.width);assert.equal(result.height,meta.height);
  let compared=0;
  for(let page=0;page<(meta.pages||1);page+=16){
    const pages=Math.min(16,(meta.pages||1)-page);
    const options={page,pages,limitInputPixels:40_000_000,failOn:'warning' as const};
    const original=await sharp(before,options).ensureAlpha().raw().toBuffer(),clean=await sharp(after,options).ensureAlpha().raw().toBuffer();
    assert.equal(original.length,width*height*pages*4);
    for(let i=0;i<pages;i++){
      const start=i*width*height*4,end=start+width*height*4;
      assert.equal(digest(original.subarray(start,end)),digest(clean.subarray(start,end)));compared++;
    }
  }
  assert.equal(compared,frames);
}
await test('large GIF keeps all pixel frames, order, timing and loop while stripping comment/trailer',async()=>{
  const bytes=await gifFixture();await assert.rejects(validateImages([{bytes,mime:'image/gif'}]),{status:413});
  const [result]=await validateCollectedImage(bytes);assert.ok(result);
  assert.equal(result.bytes.includes(Buffer.from('note')),false);
  const cleanedTrailing=await sanitizeLargeAnimation(Buffer.concat([bytes,Buffer.from('TRAILING_PRIVATE_DATA')]),await sharp(bytes).metadata());
  assert.deepEqual(cleanedTrailing,result.bytes);assert.equal(cleanedTrailing.includes(Buffer.from('TRAILING_PRIVATE_DATA')),false);
  await sameFrames(bytes,result.bytes);
  const report=await decodeCollectedFrames(result.bytes);assert.equal(report.decodedFrames,frames);assert.ok(report.chunks>1);
});
await test('large animated WebP retains alpha/blending and every pixel frame while removing EXIF/trailer',async()=>{
  const bytes=await webpFixture();assert.ok((await sharp(bytes).metadata()).exif);
  const [result]=await validateCollectedImage(bytes);assert.ok(result);
  assert.equal((await sharp(result.bytes).metadata()).exif,undefined);assert.equal(result.bytes.includes(Buffer.from('TRAILING_PRIVATE_DATA')),false);
  await sameFrames(bytes,result.bytes);
});
await test('late truncated frames, unsupported display extension, bad frame count and excessive work fail',async()=>{
  const bytes=await gifFixture(),meta=await sharp(bytes).metadata();
  await assert.rejects(validateCollectedImage(bytes.subarray(0,bytes.length-100)),{status:415});
  const data=Buffer.from(bytes),comment=data.lastIndexOf(Buffer.from([0x21,0xfe,4]));data[comment+1]=1;
  await assert.rejects(validateCollectedImage(data),{status:415});
  await assert.rejects(sanitizeLargeAnimation(bytes,{...meta,pages:frames-1}));
  await assert.rejects(sanitizeLargeAnimation(bytes,{...meta,width:2000,height:1000,pages:200}),/ANIMATION_DECODE_LIMIT/);
  await assert.rejects(validateCollectedImage(await gifFixture(501)),{status:413});
});
await test('malformed WebP RIFF and orientation-dependent metadata are not silently accepted',async()=>{
  const bytes=await webpFixture(),meta=await sharp(bytes).metadata();
  await assert.rejects(sanitizeLargeAnimation(bytes,{...meta,orientation:6}));
  const broken=Buffer.from(bytes);broken.writeUInt32LE(0xffffffff,16);
  await assert.rejects(sanitizeLargeAnimation(broken,meta));
});
