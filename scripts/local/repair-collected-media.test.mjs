import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {verifyImage,repair} from './repair-collected-media.mjs';

test('repair preflight rejects wrong bytes and MIME, and fully decodes the retained image',async()=>{
  const bytes=await sharp({create:{width:12,height:8,channels:3,background:'red'}}).jpeg().toBuffer();
  const row={hash:createHash('sha256').update(bytes).digest('hex'),byte_size:bytes.length,mime_type:'image/jpeg',width:12,height:8};
  await verifyImage(bytes,row);
  await assert.rejects(verifyImage(bytes,{...row,mime_type:'image/png'}),/IMAGE_METADATA_MISMATCH/);
  await assert.rejects(verifyImage(bytes,{...row,width:1}),/IMAGE_METADATA_MISMATCH/);
  await assert.rejects(verifyImage(Buffer.from('not the original'),row),/IMAGE_BYTES_MISMATCH/);
  await assert.rejects(repair('--remote'),/EXPECTED_DRY_RUN_APPLY_OR_ROLLBACK/);
});
