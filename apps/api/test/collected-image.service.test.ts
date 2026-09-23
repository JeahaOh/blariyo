import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validateImages, validateCollectedImage } from '../dist/features/images/image-validation.js';
import { ImagesService } from '../dist/features/images/images.service.js';
import { imageRepository, objectStorage, outboxRepository, immediateWork } from './doubles.js';

async function animation(frames: number) {
  return sharp({ create: { width: 2, height: 2 * frames, pageHeight: 2, channels: 3, background: 'red' } })
    .gif({ keepDuplicateFrames: true, delay: Array.from({ length: frames }, (_, i) => i % 2 ? 30 : 20), loop: 3 })
    .toBuffer();
}
await test('collect animation retains every frame, timing and loop while manual upload remains limited', async () => {
  const bytes = await animation(257), original = await sharp(bytes, { animated: true }).metadata();
  assert.equal(original.pages, 257);
  await assert.rejects(validateImages([{ bytes, mime: 'image/gif' }]), { status: 413 });
  const [image] = await validateCollectedImage(bytes);
  assert.ok(image);
  const result = await sharp(image.bytes, { animated: true }).metadata();
  assert.equal(result.pages, original.pages);
  assert.deepEqual(result.delay, original.delay);
  assert.equal(result.loop, original.loop);
  assert.equal(image.height, 2);
  await sharp(image.bytes, { animated: true }).stats();
});
await test('collect limits fail before private writes; accepted animation is stored with all frames', async () => {
  const writes: Buffer[] = [];
  const service = new ImagesService(imageRepository({ async create() { return '1'; } }),
    objectStorage({ async put(_bucket, _key, bytes) { writes.push(bytes); } }), immediateWork, outboxRepository());
  await assert.rejects(service.uploadCollected(await animation(501), 'actor'), { status: 413 });
  await assert.rejects(service.uploadCollected(Buffer.alloc(30 * 1024 * 1024 + 1), 'actor'), { status: 413 });
  await assert.rejects(service.uploadCollected(Buffer.from('broken'), 'actor'), { status: 415 });
  await assert.rejects(service.uploadCollected(await animation(257), 'actor', 1), { status: 413 });
  assert.equal(writes.length, 0);
  const result = await service.uploadCollected(await animation(257), 'actor');
  assert.equal(result.items.length, 1);
  assert.equal(writes.length, 1);
  assert.equal((await sharp(writes[0], { animated: true }).metadata()).pages, 257);
});

await test('collect accepts a valid image input above the manual 10MiB boundary and removes trailing bytes',async()=>{
  const png=await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer();
  const bytes=Buffer.concat([png,Buffer.alloc(11*1024*1024)]);
  await assert.rejects(validateImages([{bytes,mime:'image/png'}]),{status:413});
  const [image]=await validateCollectedImage(bytes);assert.ok(image);
  assert.equal(image.width,8);assert.equal(image.height,8);
  assert.ok(image.bytes.length<1024);await sharp(image.bytes).stats();
});
