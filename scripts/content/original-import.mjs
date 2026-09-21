import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { validateImages } from '../../apps/api/dist/features/images/image-validation.js';
import { ImagesRepository } from '../../apps/api/dist/features/images/images.repository.js';
import { Storage } from '../../apps/api/dist/shared/storage.js';

const execute = promisify(execFile);
export const originalDirectory = new URL(
  '../../.local-data/content-review/originals-20260920/',
  import.meta.url
);
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const ACTOR = 'system:collector';

export async function prepareOriginals() {
  const snapshot = JSON.parse(await readFile(new URL('snapshot.json', originalDirectory), 'utf8'));
  const bundle = JSON.parse(
    await readFile(new URL('./community-hot-20260920.json', import.meta.url), 'utf8')
  );
  assert.equal(snapshot.rights.basis, 'USER_CONFIRMED_PERMISSION');
  assert.equal(snapshot.posts.length, 25);
  assert.deepEqual(
    new Set(snapshot.posts.map((post) => post.sourceUrl)),
    new Set(bundle.items.map((item) => item.sourceUrl))
  );
  const prepared = new Map();
  for (const post of snapshot.posts) {
    assert.ok(
      post.articleHtml && post.sourceBlocks?.length && post.blocks.length,
      'Missing original body'
    );
    assert.ok(['FETCHED', 'PARTIAL'].includes(post.status));
    // Never replace an attachment failure with a fabricated description.
    assert.ok(
      post.issues.every(
        (issue) =>
          (issue.kind === 'social' && issue.error === 'X_LONG_TEXT_TRUNCATED') ||
          (issue.kind === 'image' && /HTTP Error 403/.test(issue.error))
      ),
      `Unresolved capture failure: ${post.sourceUrl}`
    );
    for (const block of post.blocks.filter((value) => value.kind === 'image')) {
      if (!block.asset) {
        assert.ok(
          post.issues.some(
            (issue) => issue.url === block.url && /HTTP Error 403/.test(issue.error)
          ),
          'Missing image bytes without an observed access denial'
        );
        continue;
      }
      const asset = block.asset;
      if (prepared.has(asset.sha256)) continue;
      assert.match(asset.filename, /^assets\/[a-f0-9]{64}\.(jpg|png|gif|webp)$/);
      const bytes = await readFile(new URL(asset.filename, originalDirectory));
      assert.equal(digest(bytes), asset.sha256, 'Original file checksum mismatch');
      let image;
      try {
        [image] = await validateImages([{ bytes, mime: asset.mime }]);
      } catch (error) {
        // Local importer exception: retain every GIF frame, validating by streaming decode.
        // Production upload limits remain unchanged; the original is never silently flattened.
        if (asset.mime !== 'image/gif') throw error;
        assert.ok(bytes.length <= 20 * 1024 * 1024);
        assert.ok(asset.width > 0 && asset.height > 0 && asset.frames <= 1500);
        assert.ok(asset.width * asset.height <= 40000000);
        assert.ok(asset.width * asset.height * asset.frames <= 600000000);
        await execute(
          '/opt/homebrew/bin/ffmpeg',
          [
            '-nostdin',
            '-v',
            'error',
            '-xerror',
            '-err_detect',
            'explode',
            '-threads',
            '1',
            '-i',
            fileURLToPath(new URL(asset.filename, originalDirectory)),
            '-f',
            'null',
            '-',
          ],
          { timeout: 90000, maxBuffer: 65536 }
        );
        image = {
          bytes,
          mime: asset.mime,
          width: asset.width,
          height: asset.height,
          ext: 'gif',
          hash: Buffer.from(asset.sha256, 'hex'),
          originalGifPreserved: true,
        };
      }
      prepared.set(asset.sha256, image);
    }
  }
  return { snapshot, bundle, prepared };
}

export function textBlocks(text) {
  const value = text.trim();
  if (!value) return [];
  const output = [];
  for (let position = 0; position < value.length; position += 19000)
    output.push({ type: 'TEXT', text: value.slice(position, position + 19000) });
  return output;
}

export async function stageOriginalBlocks(
  app,
  post,
  prepared,
  prefix,
  writtenKeys,
  existingImages = []
) {
  const repository = app.get(ImagesRepository);
  const storage = app.get(Storage);
  const blocks = [];
  const imageMappings = [];
  for (const [index, block] of post.blocks.entries()) {
    if (block.kind === 'image') {
      if (!block.asset) {
        blocks.push(...textBlocks(block.url));
        continue;
      }
      const image = prepared.get(block.asset.sha256);
      assert.ok(image);
      const existing = existingImages.find(
        (entry) => entry.remoteUrl === block.url && entry.originalSha256 === block.asset.sha256
      );
      if (existing) {
        assert.equal(existing.storedSha256, image.hash.toString('hex'));
        const stored = await repository.find(String(existing.imageId), true);
        assert.ok(stored);
        assert.equal(stored.hash.toString('hex'), existing.storedSha256);
        const alt = (block.alt || `${post.title} · 첨부 ${imageMappings.length + 1}`).slice(0, 300);
        blocks.push({ type: 'IMAGE', imageId: Number(existing.imageId), alt });
        imageMappings.push({ ...existing, blockPosition: blocks.length });
        continue;
      }
      const key = `staging/2026/09/20/originals-${prefix}/${index}-${image.hash.toString('hex')}.${image.ext}`;
      await storage.put('private', key, image.bytes);
      writtenKeys.push(key);
      const imageId = await repository.create({
        key,
        hash: image.hash,
        mime: image.mime,
        byteSize: image.bytes.length,
        width: image.width,
        height: image.height,
        actor: ACTOR,
      });
      const alt = (block.alt || `${post.title} · 첨부 ${imageMappings.length + 1}`).slice(0, 300);
      blocks.push({ type: 'IMAGE', imageId: Number(imageId), alt });
      imageMappings.push({
        blockPosition: blocks.length,
        imageId,
        remoteUrl: block.url,
        originalSha256: block.asset.sha256,
        storedSha256: image.hash.toString('hex'),
        originalGifPreserved: Boolean(image.originalGifPreserved),
        width: image.width,
        height: image.height,
      });
    } else if (block.kind === 'text') blocks.push(...textBlocks(block.text));
    else if (block.kind === 'social' || block.kind === 'embed')
      blocks.push(...textBlocks(block.url));
    else if (block.kind === 'link')
      blocks.push(
        ...textBlocks(
          block.label && block.label !== block.url ? `${block.label}\n${block.url}` : block.url
        )
      );
    else if (block.kind === 'video' || block.kind === 'audio')
      blocks.push(...textBlocks(block.urls.join('\n')));
    else throw new Error(`Unsupported original block: ${block.kind}`);
  }
  assert.ok(blocks.length >= 1 && blocks.length <= 40, 'Post exceeds existing block contract');
  assert.ok(imageMappings.length <= 20, 'Post exceeds existing image contract');
  return { blocks, imageMappings };
}
