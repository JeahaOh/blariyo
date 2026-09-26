import sharp, { type Metadata } from 'sharp';
export const MAX_ANIMATION_PIXELS = 200_000_000;
const FRAME_PIXELS = 40_000_000;
const STACK_PIXELS = 64 * 1024 * 1024;
const requireBytes = (ok: boolean) => {
  if (!ok) throw Error('ANIMATION_CONTAINER_INVALID');
};
const limit = (ok: boolean) => {
  if (!ok) throw Error('ANIMATION_DECODE_LIMIT');
};

/** Every frame is decoded, with bounded output buffers instead of one tall image. */
export async function decodeCollectedFrames(bytes: Buffer, supplied?: Metadata) {
  const metadata =
    supplied ??
    (await sharp(bytes, { limitInputPixels: FRAME_PIXELS, failOn: 'warning' }).metadata());
  const frames = metadata.pages || 1,
    height = metadata.pageHeight || metadata.height;
  const pixels = metadata.width * height,
    totalPixels = pixels * frames;
  limit(
    bytes.length <= 30 * 1024 * 1024 &&
      frames <= 500 &&
      pixels > 0 &&
      pixels <= FRAME_PIXELS &&
      totalPixels <= MAX_ANIMATION_PIXELS
  );
  if (totalPixels <= STACK_PIXELS) {
    await sharp(bytes, { animated: true, limitInputPixels: STACK_PIXELS, failOn: 'warning' })
      .timeout({ seconds: 30 })
      .stats();
    return { frames, decodedFrames: frames, chunks: 1, totalPixels };
  }
  limit(metadata.format === 'gif' || metadata.format === 'webp');
  const chunkSize = Math.max(1, Math.min(16, Math.floor(FRAME_PIXELS / pixels)));
  const deadline = Date.now() + 30_000;
  let chunks = 0,
    decodedFrames = 0;
  for (let page = 0; page < frames; page += chunkSize) {
    const count = Math.min(chunkSize, frames - page),
      seconds = Math.min(10, Math.floor((deadline - Date.now()) / 1000));
    limit(seconds > 0);
    // stats consumes all selected pixels without retaining raw output in the JS heap.
    await sharp(bytes, { page, pages: count, limitInputPixels: FRAME_PIXELS, failOn: 'warning' })
      .timeout({ seconds })
      .stats();
    decodedFrames += count;
    chunks++;
  }
  limit(Date.now() <= deadline);
  return { frames, decodedFrames, chunks, totalPixels };
}

/** Preserve display blocks verbatim, removing only non-display metadata and trailing bytes. */
function gif(bytes: Buffer) {
  requireBytes(bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)));
  const width = bytes.readUInt16LE(6),
    height = bytes.readUInt16LE(8),
    packed = bytes.readUInt8(10);
  let at = 13 + (packed & 128 ? 3 * 2 ** ((packed & 7) + 1) : 0),
    frames = 0,
    loops = 0;
  requireBytes(at < bytes.length && width > 0 && height > 0);
  const parts = [bytes.subarray(0, at)];
  function take(length: number) {
    requireBytes(at + length <= bytes.length);
    at += length;
  }
  function subBlocks() {
    while (true) {
      take(1);
      const length = bytes.readUInt8(at - 1);
      if (!length) return;
      take(length);
    }
  }
  while (at < bytes.length) {
    const start = at,
      marker = bytes.readUInt8(at++);
    if (marker === 0x3b) {
      requireBytes(frames > 1);
      parts.push(bytes.subarray(start, at));
      return { bytes: Buffer.concat(parts), frames, width, height };
    }
    if (marker === 0x2c) {
      take(9);
      const left = bytes.readUInt16LE(start + 1),
        top = bytes.readUInt16LE(start + 3);
      const w = bytes.readUInt16LE(start + 5),
        h = bytes.readUInt16LE(start + 7),
        flags = bytes.readUInt8(start + 9);
      requireBytes(w > 0 && h > 0 && left + w <= width && top + h <= height && !(flags & 0x18));
      if (flags & 128) take(3 * 2 ** ((flags & 7) + 1));
      take(1);
      const codeSize = bytes.readUInt8(at - 1);
      requireBytes(codeSize >= 2 && codeSize <= 8);
      subBlocks();
      parts.push(bytes.subarray(start, at));
      frames++;
      limit(frames <= 500);
      continue;
    }
    requireBytes(marker === 0x21);
    take(1);
    const label = bytes.readUInt8(at - 1);
    if (label === 0xf9) {
      take(6);
      requireBytes(bytes.readUInt8(start + 2) === 4 && bytes.readUInt8(at - 1) === 0);
      const flags = bytes.readUInt8(start + 3);
      requireBytes(!(flags & 0xe0) && ((flags >> 2) & 7) <= 3);
      parts.push(bytes.subarray(start, at));
    } else if (label === 0xfe) subBlocks();
    else if (label === 0xff) {
      take(1);
      requireBytes(bytes.readUInt8(at - 1) === 11);
      take(11);
      const application = bytes.toString('ascii', at - 11, at);
      subBlocks();
      // Unknown applications may affect rendering. Reject rather than silently discard them.
      requireBytes(['NETSCAPE2.0', 'ANIMEXTS1.0'].includes(application) && ++loops === 1);
      requireBytes(
        at - start === 19 && bytes.readUInt8(start + 14) === 3 && bytes.readUInt8(start + 15) === 1
      );
      parts.push(bytes.subarray(start, at));
    } else throw Error('ANIMATION_EXTENSION_UNSUPPORTED');
  }
  throw Error('ANIMATION_TRAILER_MISSING');
}

function webp(bytes: Buffer) {
  requireBytes(
    bytes.length >= 30 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
  );
  const end = bytes.readUInt32LE(4) + 8;
  requireBytes(end <= bytes.length && end >= 30);
  let at = 12,
    frames = 0,
    width = 0,
    height = 0,
    anim = 0,
    icc = 0,
    expectedIcc = false;
  const parts: Buffer[] = [];
  while (at < end) {
    requireBytes(at + 8 <= end);
    const start = at,
      name = bytes.toString('ascii', at, at + 4),
      size = bytes.readUInt32LE(at + 4);
    at += 8 + size + (size & 1);
    requireBytes(at <= end);
    if (size & 1) requireBytes(bytes.readUInt8(at - 1) === 0);
    const data = bytes.subarray(start + 8, start + 8 + size);
    if (start === 12) requireBytes(name === 'VP8X');
    if (name === 'VP8X') {
      requireBytes(
        start === 12 &&
          size === 10 &&
          (data.readUInt8(0) & 2) !== 0 &&
          !(data.readUInt8(0) & 0xc1) &&
          data.readUIntLE(1, 3) === 0
      );
      width = data.readUIntLE(4, 3) + 1;
      height = data.readUIntLE(7, 3) + 1;
      expectedIcc = Boolean(data.readUInt8(0) & 0x20);
      const clean = Buffer.from(bytes.subarray(start, at));
      clean[8] = clean.readUInt8(8) & ~0x0c;
      parts.push(clean);
    } else if (name === 'ICCP') {
      requireBytes(++icc === 1 && !anim && size > 0);
      parts.push(bytes.subarray(start, at));
    } else if (name === 'ANIM') {
      requireBytes(++anim === 1 && frames === 0 && size === 6);
      parts.push(bytes.subarray(start, at));
    } else if (name === 'ANMF') {
      requireBytes(anim === 1 && size >= 24);
      const x = data.readUIntLE(0, 3) * 2,
        y = data.readUIntLE(3, 3) * 2;
      const w = data.readUIntLE(6, 3) + 1,
        h = data.readUIntLE(9, 3) + 1;
      requireBytes(x + w <= width && y + h <= height && !(data.readUInt8(15) & 0xfc));
      let sub = 16,
        image = 0,
        alpha = 0;
      while (sub < size) {
        requireBytes(sub + 8 <= size);
        const tag = data.toString('ascii', sub, sub + 4),
          n = data.readUInt32LE(sub + 4);
        sub += 8 + n + (n & 1);
        requireBytes(sub <= size && n > 0);
        if (n & 1) requireBytes(data.readUInt8(sub - 1) === 0);
        if (tag === 'ALPH') requireBytes(++alpha === 1 && image === 0);
        else {
          requireBytes(
            ['VP8 ', 'VP8L'].includes(tag) && ++image === 1 && !(tag === 'VP8L' && alpha)
          );
        }
      }
      requireBytes(image === 1);
      parts.push(bytes.subarray(start, at));
      frames++;
      limit(frames <= 500);
    } else {
      // EXIF/XMP and top-level unknown chunks do not contain frame pixels (RIFF spec).
      requireBytes(!['VP8 ', 'VP8L', 'ALPH'].includes(name));
    }
  }
  requireBytes(frames > 1 && anim === 1 && expectedIcc === Boolean(icc));
  const body = Buffer.concat(parts),
    header = Buffer.from('RIFF\0\0\0\0WEBP', 'binary');
  header.writeUInt32LE(body.length + 4, 4);
  return { bytes: Buffer.concat([header, body]), frames, width, height };
}

export async function sanitizeLargeAnimation(bytes: Buffer, original: Metadata) {
  limit(
    (original.pages || 1) <= 500 &&
      original.width * (original.pageHeight || original.height) * (original.pages || 1) <=
        MAX_ANIMATION_PIXELS
  );
  requireBytes(original.orientation === undefined || original.orientation === 1);
  const clean =
    original.format === 'gif' ? gif(bytes) : original.format === 'webp' ? webp(bytes) : null;
  requireBytes(Boolean(clean));
  if (!clean) throw Error('ANIMATION_FORMAT');
  requireBytes(
    clean.frames === original.pages &&
      clean.width === original.width &&
      clean.height === (original.pageHeight || original.height)
  );
  const after = await sharp(clean.bytes, {
    limitInputPixels: FRAME_PIXELS,
    failOn: 'warning',
  }).metadata();
  requireBytes(
    after.pages === original.pages &&
      after.loop === original.loop &&
      JSON.stringify(after.delay) === JSON.stringify(original.delay)
  );
  await decodeCollectedFrames(clean.bytes, after);
  return clean.bytes;
}
