import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { fail, id } from './http.mjs';
import { enqueue } from './outbox.mjs';
const formats = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
export function imageService(pool, storage) {
  return {
    async upload(files, actor) {
      if (!files.length) fail(400, 'VALIDATION_FAILED');
      if (files.length > 10 || files.reduce((n, f) => n + f.bytes.length, 0) > 100 * 1024 * 1024)
        fail(413, 'UPLOAD_TOO_LARGE');
      const errors = [],
        validated = [];
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
          if (!formats[metadata.format] || formats[metadata.format] !== file.mime) {
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
            mime: formats[metadata.format],
            ext: metadata.format === 'jpeg' ? 'jpg' : metadata.format,
            hash: createHash('sha256').update(data).digest(),
          });
        } catch (e) {
          if (/pixel limit/.test(e.message)) {
            tooLarge = true;
            errors.push({ field: `files[${index}]`, reason: 'decodeLimit' });
          } else errors.push({ field: `files[${index}]`, reason: 'decode' });
        }
      }
      if (errors.length)
        fail(
          tooLarge ? 413 : 415,
          tooLarge ? 'UPLOAD_TOO_LARGE' : 'UNSUPPORTED_MEDIA_TYPE',
          errors
        );
      const stored = [],
        requestId = randomUUID(),
        createdAt = new Date().toISOString();
      try {
        for (const [i, image] of validated.entries()) {
          image.key = `staging/${createdAt.slice(0, 10).replaceAll('-', '/')}/${requestId}/${i}-${image.hash.toString('hex')}.${image.ext}`;
          stored.push(image.key);
          await storage.put('private', image.key, image.bytes);
        }
        return await transaction(pool, async (db) => {
          const items = [];
          for (const image of validated) {
            const row = (
              await db.query(
                `INSERT INTO content.board_post_image(private_storage_key,status,content_sha256,mime_type,byte_size,width,height,created_by,created_at,updated_by,updated_at) VALUES($1,'STAGED',$2,$3,$4,$5,$6,$7,now(),$7,now()) RETURNING id`,
                [
                  image.key,
                  image.hash,
                  image.mime,
                  image.bytes.length,
                  image.width,
                  image.height,
                  actor,
                ]
              )
            ).rows[0];
            items.push({
              imageId: Number(row.id),
              status: 'STAGED',
              mimeType: image.mime,
              byteSize: image.bytes.length,
              width: image.width,
              height: image.height,
              previewPath: `/api/v1/admin/images/${row.id}/preview`,
            });
          }
          return { items };
        });
      } catch {
        for (const key of stored) {
          try {
            await storage.delete('private', key);
          } catch {
            await transaction(pool, (db) =>
              enqueue(
                db,
                'OBJECT_DELETE_PRIVATE',
                'STORAGE_OBJECT',
                null,
                {
                  privateStorageKey: key,
                  objectCreatedAt: createdAt,
                  cleanupReason: 'UPLOAD_ROLLBACK',
                },
                actor
              )
            ).catch(() => {});
          }
        }
        fail(503, 'DEPENDENCY_UNAVAILABLE');
      }
    },
    async preview(imageId) {
      if (!id(imageId)) fail(404, 'IMAGE_NOT_FOUND');
      const row = (
        await pool.query(
          "SELECT * FROM content.board_post_image WHERE id=$1 AND status IN ('STAGED','PUBLIC','PUBLIC_DELETE_PENDING','PRIVATE_REVIEW')",
          [imageId]
        )
      ).rows[0];
      if (!row) fail(404, 'IMAGE_NOT_FOUND');
      try {
        return {
          bytes: await storage.get('private', row.private_storage_key),
          mime: row.mime_type,
        };
      } catch {
        fail(503, 'DEPENDENCY_UNAVAILABLE');
      }
    },
    async discard(imageId, actor) {
      if (!id(imageId)) fail(404, 'IMAGE_NOT_FOUND');
      return transaction(pool, async (db) => {
        const row = (
          await db.query('SELECT * FROM content.board_post_image WHERE id=$1 FOR UPDATE', [imageId])
        ).rows[0];
        if (!row) fail(404, 'IMAGE_NOT_FOUND');
        if (row.status !== 'STAGED' || row.post_id !== null) fail(409, 'IMAGE_STATE_CONFLICT');
        await db.query(
          "UPDATE content.board_post_image SET status='PRIVATE_DELETE_PENDING',updated_by=$2,updated_at=now() WHERE id=$1",
          [imageId, actor]
        );
        await enqueue(
          db,
          'OBJECT_DELETE_PRIVATE',
          'IMAGE',
          imageId,
          { privateStorageKey: row.private_storage_key },
          actor
        );
        return { imageId: Number(imageId), status: 'PRIVATE_DELETE_PENDING' };
      });
    },
  };
}
