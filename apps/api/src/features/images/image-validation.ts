import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { fail, type FieldError } from '../../shared/errors.js';
import { sanitizeLargeAnimation } from './collected-animation.js';
export interface ImageFile {
  bytes: Buffer;
  mime: string;
}
export interface ValidatedImage extends ImageFile {
  width: number;
  height: number;
  ext: string;
  hash: Buffer;
}
export const COLLECTED_FILE_BYTES = 30 * 1024 * 1024;
export const COLLECTED_TOTAL_BYTES = 150 * 1024 * 1024;
const formats: Readonly<Record<string, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};
/** Collect HTTP headers are advisory. The decoder determines the actual stored file format. */
export async function collectedImage(bytes: Buffer): Promise<ImageFile> {
  if (bytes.length > COLLECTED_FILE_BYTES) fail(413, 'UPLOAD_TOO_LARGE');
  try {
    const metadata = await sharp(bytes, {
      limitInputPixels: 40000000,
      failOn: 'warning',
    }).metadata();
    const mime = formats[metadata.format];
    if (mime) return { bytes, mime };
  } catch {
    /* Validation below returns a generalized format error. */
  }
  fail(415, 'UNSUPPORTED_MEDIA_TYPE');
}
export async function validateImages(files: ImageFile[]): Promise<ValidatedImage[]> {
  return validate(files, false);
}
/** Only server-owned collect objects use this path; ordinary HTTP uploads keep their existing limits. */
export async function validateCollectedImage(bytes: Buffer): Promise<ValidatedImage[]> {
  return validate([await collectedImage(bytes)], true);
}
async function validate(files: ImageFile[], collected: boolean): Promise<ValidatedImage[]> {
  if (!files.length) fail(400, 'VALIDATION_FAILED');
  if (
    files.length > 10 ||
    files.reduce((total, file) => total + file.bytes.length, 0) > 100 * 1024 * 1024
  )
    fail(413, 'UPLOAD_TOO_LARGE');
  const errors: FieldError[] = [],
    validated: ValidatedImage[] = [];
  let tooLarge = false;
  for (const [index, file] of files.entries()) {
    if (file.bytes.length > (collected ? COLLECTED_FILE_BYTES : 10 * 1024 * 1024)) {
      tooLarge = true;
      errors.push({ field: `files[${index}]`, reason: 'fileSize' });
      continue;
    }
    try {
      if (collected) {
        const first = await sharp(file.bytes, {
          limitInputPixels: 40000000,
          failOn: 'warning',
        }).metadata();
        const pixels = first.width * (first.pageHeight || first.height) * (first.pages || 1);
        if (pixels > 64 * 1024 * 1024) {
          if (!['gif', 'webp'].includes(first.format) || formats[first.format] !== file.mime)
            throw Error('ANIMATION_DECODE_LIMIT');
          const data = await sanitizeLargeAnimation(file.bytes, first);
          validated.push({
            bytes: data,
            mime: file.mime,
            ext: first.format,
            width: first.width,
            height: first.pageHeight || first.height,
            hash: createHash('sha256').update(data).digest(),
          });
          continue;
        }
      }
      const decoder = sharp(file.bytes, {
        animated: true,
        limitInputPixels: collected ? 64 * 1024 * 1024 : 40000000,
        failOn: 'warning',
      }).timeout({ seconds: 30 });
      const metadata = await decoder.metadata();
      const mime = formats[metadata.format];
      if (!mime || mime !== file.mime) {
        errors.push({ field: `files[${index}]`, reason: 'format' });
        continue;
      }
      const frames = metadata.pages || 1,
        height = metadata.pageHeight || metadata.height;
      if (
        metadata.width * height > 40000000 ||
        frames > (collected ? 500 : 200) ||
        metadata.width * height * frames * 4 > 256 * 1024 * 1024
      ) {
        tooLarge = true;
        errors.push({ field: `files[${index}]`, reason: 'decodeLimit' });
        continue;
      }
      const output = decoder.rotate();
      if (collected && metadata.format === 'gif') output.gif({ keepDuplicateFrames: true });
      else output.toFormat(metadata.format);
      const { data, info } = await output.toBuffer({ resolveWithObject: true });
      if (collected && data.length > COLLECTED_FILE_BYTES) {
        tooLarge = true;
        errors.push({ field: `files[${index}]`, reason: 'fileSize' });
        continue;
      }
      validated.push({
        bytes: data,
        width: info.width,
        height: info.pageHeight || info.height,
        mime,
        ext: metadata.format === 'jpeg' ? 'jpg' : metadata.format,
        hash: createHash('sha256').update(data).digest(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /pixel limit|ANIMATION_DECODE_LIMIT|timeout/i.test(error.message)
      ) {
        tooLarge = true;
        errors.push({ field: `files[${index}]`, reason: 'decodeLimit' });
      } else errors.push({ field: `files[${index}]`, reason: 'decode' });
    }
  }
  if (errors.length)
    fail(tooLarge ? 413 : 415, tooLarge ? 'UPLOAD_TOO_LARGE' : 'UNSUPPORTED_MEDIA_TYPE', errors);
  return validated;
}
