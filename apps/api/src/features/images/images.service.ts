import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Storage } from '../../shared/storage.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { ImagesRepository } from './images.repository.js';
import { validateImages, type ImageFile } from './image-validation.js';
import { fail, validId } from '../../shared/errors.js';
@Injectable()
export class ImagesService {
  constructor(
    @Inject(ImagesRepository) private readonly repository: ImagesRepository,
    @Inject(Storage) private readonly storage: Storage,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository
  ) {}
  async upload(files: ImageFile[], actor: string) {
    const validated = await validateImages(files);
    const stored: string[] = [],
      requestId = randomUUID(),
      createdAt = new Date().toISOString();
    const images = validated.map((image, index) => ({
      ...image,
      key: `staging/${createdAt.slice(0, 10).replaceAll('-', '/')}/${requestId}/${index}-${image.hash.toString('hex')}.${image.ext}`,
    }));
    try {
      for (const image of images) {
        stored.push(image.key);
        await this.storage.put('private', image.key, image.bytes);
      }
      return await this.work.transaction(async () => {
        const items = [];
        for (const image of images) {
          const id = await this.repository.create({
            ...image,
            byteSize: image.bytes.length,
            actor,
          });
          items.push({
            imageId: Number(id),
            status: 'STAGED' as const,
            mimeType: image.mime,
            byteSize: image.bytes.length,
            width: image.width,
            height: image.height,
            previewPath: `/api/v1/admin/images/${id}/preview`,
          });
        }
        return { items };
      });
    } catch {
      for (const key of stored) {
        try {
          await this.storage.delete('private', key);
        } catch {
          await this.work
            .transaction(() =>
              this.outbox.enqueue({
                type: 'OBJECT_DELETE_PRIVATE',
                aggregateType: 'STORAGE_OBJECT',
                aggregateId: null,
                payload: {
                  privateStorageKey: key,
                  objectCreatedAt: createdAt,
                  cleanupReason: 'UPLOAD_ROLLBACK',
                },
                actor,
              })
            )
            .catch(() => {});
        }
      }
      fail(503, 'DEPENDENCY_UNAVAILABLE');
    }
  }
  async localMedia(key: string) {
    if (!/^posts\/[1-9][0-9]*\/[1-9][0-9]*-[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(key)) fail(404, 'IMAGE_NOT_FOUND');
    const mime = new Map([['jpg','image/jpeg'], ['png','image/png'], ['webp','image/webp'], ['gif','image/gif']]).get(key.split('.').at(-1) ?? '');
    if (!mime) fail(404, 'IMAGE_NOT_FOUND');
    return { bytes: await this.storage.get('public', key), mime };
  }
  async preview(imageId: string) {
    if (!validId(imageId)) fail(404, 'IMAGE_NOT_FOUND');
    const image = await this.repository.find(imageId);
    if (
      !image ||
      !['STAGED', 'PUBLIC', 'PUBLIC_DELETE_PENDING', 'PRIVATE_REVIEW'].includes(image.status)
    )
      fail(404, 'IMAGE_NOT_FOUND');
    try {
      return { bytes: await this.storage.get('private', image.privateKey), mime: image.mime };
    } catch {
      fail(503, 'DEPENDENCY_UNAVAILABLE');
    }
  }
  async discard(imageId: string, actor: string) {
    if (!validId(imageId)) fail(404, 'IMAGE_NOT_FOUND');
    return this.work.transaction(async () => {
      const image = await this.repository.find(imageId, true);
      if (!image) fail(404, 'IMAGE_NOT_FOUND');
      if (image.status !== 'STAGED' || image.postId !== null) fail(409, 'IMAGE_STATE_CONFLICT');
      await this.repository.markPrivateDelete(imageId, actor);
      await this.outbox.enqueue({
        type: 'OBJECT_DELETE_PRIVATE',
        aggregateType: 'IMAGE',
        aggregateId: imageId,
        payload: { privateStorageKey: image.privateKey },
        actor,
      });
      return { imageId: Number(imageId), status: 'PRIVATE_DELETE_PENDING' as const };
    });
  }
}
