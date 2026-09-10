import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { fail, type FieldError } from '../../shared/errors.js';
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
const formats: Readonly<Record<string, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};
export async function validateImages(files: ImageFile[]): Promise<ValidatedImage[]> {
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
    if (file.bytes.length > 10 * 1024 * 1024) {
      tooLarge = true;
      errors.push({ field: `files[${index}]`, reason: 'fileSize' });
      continue;
    }
    try {
      const decoder = sharp(file.bytes, {
        animated: true,
        limitInputPixels: 40000000,
        failOn: 'warning',
      });
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
        frames > 200 ||
        metadata.width * height * frames * 4 > 256 * 1024 * 1024
      ) {
        tooLarge = true;
        errors.push({ field: `files[${index}]`, reason: 'decodeLimit' });
        continue;
      }
      const { data, info } = await decoder
        .rotate()
        .toFormat(metadata.format)
        .toBuffer({ resolveWithObject: true });
      validated.push({
        bytes: data,
        width: info.width,
        height: info.pageHeight || info.height,
        mime,
        ext: metadata.format === 'jpeg' ? 'jpg' : metadata.format,
        hash: createHash('sha256').update(data).digest(),
      });
    } catch (error) {
      if (error instanceof Error && /pixel limit/.test(error.message)) {
        tooLarge = true;
        errors.push({ field: `files[${index}]`, reason: 'decodeLimit' });
      } else errors.push({ field: `files[${index}]`, reason: 'decode' });
    }
  }
  if (errors.length)
    fail(tooLarge ? 413 : 415, tooLarge ? 'UPLOAD_TOO_LARGE' : 'UNSUPPORTED_MEDIA_TYPE', errors);
  return validated;
}
