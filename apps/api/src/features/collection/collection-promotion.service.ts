import { Inject, Injectable } from '@nestjs/common';
import type { operations } from '@blariyo/contracts/collection-api';
import { CollectionRepository } from './collection.repository.js';
import { CollectionService } from './collection.service.js';
import { collectionDigest } from './collection-url.js';
import { ImagesService } from '../images/images.service.js';
import { ImagesRepository } from '../images/images.repository.js';
import { validateImages, type ImageFile } from '../images/image-validation.js';
import { PostsService } from '../posts/posts.service.js';
import type { EditBlock } from '../posts/posts.model.js';
import { IdempotencyRepository } from '../../shared/idempotency.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { Storage } from '../../shared/storage.js';
import { fail, validId } from '../../shared/errors.js';
import { originalDraftBlocks } from './collection-content.js';

export type PromoteCandidate =
  operations['promoteCollectionCandidate']['requestBody']['content']['application/json'];

@Injectable()
export class CollectionPromotionService {
  constructor(
    @Inject(CollectionRepository) private readonly candidates: CollectionRepository,
    @Inject(CollectionService) private readonly collection: CollectionService,
    @Inject(ImagesService) private readonly uploads: ImagesService,
    @Inject(ImagesRepository) private readonly images: ImagesRepository,
    @Inject(PostsService) private readonly posts: PostsService,
    @Inject(IdempotencyRepository) private readonly receipts: IdempotencyRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(Storage) private readonly storage: Storage
  ) {}

  private async candidate(id: string, version: number, lock = false) {
    if (!validId(id)) fail(404, 'CANDIDATE_NOT_FOUND');
    const candidate = await this.candidates.find(id, lock);
    if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
    if (candidate.lockVersion !== version) fail(409, 'CANDIDATE_VERSION_CONFLICT');
    if (candidate.status !== 'NEW') fail(409, 'CANDIDATE_STATE_CONFLICT');
    return candidate;
  }

  async promote(id: string, body: PromoteCandidate, actor: string, key: string, scope: string) {
    const hash = collectionDigest({ params: { candidateId: id }, body });
    return this.work.lock(
      `collect:key:${actor}:${scope}:${key}`,
      async () => {
        const previous = await this.receipts.find(actor, scope, key, true);
        if (previous) {
          if (!previous.hash.equals(hash)) fail(409, 'IDEMPOTENCY_CONFLICT');
          return { status: previous.status, data: previous.data };
        }
        return this.work.lock(`collect:candidate:${id}`, async () => {
          const candidate = await this.candidate(id, body.lockVersion);
          const ids = body.candidateImageIds,
            options = body.imageOptions;
          if (
            options.length !== ids.length ||
            new Set(options.map((item) => item.candidateImageId)).size !== ids.length ||
            options.some((item) => !ids.includes(item.candidateImageId))
          )
            fail(400, 'VALIDATION_FAILED');
          const uploaded = options.flatMap((item) =>
            item.uploadedImageId ? [String(item.uploadedImageId)] : []
          );
          if (new Set(uploaded).size !== uploaded.length) fail(400, 'VALIDATION_FAILED');
          const images = await this.candidates.images(id);
          if (candidate.contentBlocks) {
            if (
              body.leadText !== undefined ||
              ids.length !== images.length ||
              images.some((image) => !ids.includes(Number(image.id)))
            )
              fail(400, 'VALIDATION_FAILED');
          } else if (!ids.length) fail(400, 'VALIDATION_FAILED');
          const selected = ids.map((selectedId) => {
            const image = images.find((item) => Number(item.id) === selectedId);
            const option = options.find((item) => item.candidateImageId === selectedId);
            if (!image || !option) fail(400, 'VALIDATION_FAILED');
            return { image, option };
          });
          const files: ImageFile[] = [];
          for (const item of selected) {
            if (item.option.uploadedImageId) continue;
            const image = item.image;
            if (
              !image.previewStorageKey ||
              !image.previewExpiresAt ||
              image.previewExpiresAt <= new Date()
            )
              fail(409, 'IMAGE_STATE_CONFLICT');
            try {
              const mime = new Map([
                ['jpg', 'image/jpeg'],
                ['png', 'image/png'],
                ['webp', 'image/webp'],
                ['gif', 'image/gif'],
              ]).get(image.previewStorageKey.split('.').at(-1) ?? '');
              if (!mime) throw new Error('INVALID_PREVIEW_KEY');
              files.push({
                bytes: await this.storage.get('private', image.previewStorageKey),
                mime,
              });
            } catch {
              fail(503, 'DEPENDENCY_UNAVAILABLE');
            }
          }
          const title = (body.title ?? candidate.title ?? '').trim();
          if (!title || [...title].length > 200) fail(400, 'VALIDATION_FAILED');
          const hashes: Buffer[] = [];
          for (let start = 0; start < files.length; start += 10)
            hashes.push(
              ...(await validateImages(files.slice(start, start + 10))).map((image) => image.hash)
            );
          if (
            (await this.candidates.duplicatePost(candidate.originUrl, hashes, uploaded)) &&
            !body.acknowledgeDuplicate
          )
            fail(409, 'CANDIDATE_DUPLICATE');
          const stored: number[] = [];
          for (let start = 0; start < files.length; start += 10)
            stored.push(
              ...(await this.uploads.upload(files.slice(start, start + 10), actor)).items.map(
                (image) => image.imageId
              )
            );
          let next = 0;
          const prepared = selected.map((item) => {
            const imageId = item.option.uploadedImageId ?? stored[next++];
            if (imageId === undefined) throw new Error('MISSING_PREPARED_IMAGE');
            return { ...item, imageId };
          });
          return this.work.transaction(async () => {
            const current = await this.candidate(id, body.lockVersion, true);
            for (const item of prepared) {
              const image = await this.images.find(String(item.imageId), true);
              if (!image || image.status !== 'STAGED' || image.postId !== null)
                fail(409, 'IMAGE_STATE_CONFLICT');
            }
            if (
              (await this.candidates.duplicatePost(
                current.originUrl,
                [],
                prepared.map((item) => String(item.imageId))
              )) &&
              !body.acknowledgeDuplicate
            )
              fail(409, 'CANDIDATE_DUPLICATE');
            const source = await this.candidates.source(current.sourceId);
            if (!source) fail(404, 'SOURCE_NOT_FOUND');
            const blocks: EditBlock[] = current.contentBlocks
              ? originalDraftBlocks(current.contentBlocks, (position) => {
                  const item = prepared.find((item) => item.image.position === position);
                  if (!item) fail(400, 'VALIDATION_FAILED');
                  return { type: 'IMAGE', imageId: item.imageId, alt: item.option.alt };
                })
              : [
                  ...(body.leadText ? [{ type: 'TEXT' as const, text: body.leadText }] : []),
                  ...prepared.map((item) => ({
                    type: 'IMAGE' as const,
                    imageId: item.imageId,
                    alt: item.option.alt,
                  })),
                ];
            const post = await this.posts.createDraftInTransaction(
              {
                boardSlug: body.boardSlug,
                title,
                source: body.source ?? { name: source.name, url: current.originUrl },
                pinnedPosition: null,
                blocks,
              },
              actor
            );
            await this.collection.discardPreviewsInTransaction(id, actor);
            await this.candidates.approve(
              id,
              String(post.postId),
              prepared.map((item) => ({
                candidateImageId: item.image.id,
                imageId: String(item.imageId),
              })),
              actor
            );
            const data = {
              ...post,
              candidateId: Number(id),
              storedImageIds: prepared.map((item) => item.imageId),
            };
            await this.receipts.save(
              {
                actor,
                scope,
                key,
                hash,
                status: 201,
                data,
                resourceType: 'POST',
                resourceId: String(post.postId),
              },
              true
            );
            return { status: 201, data };
          });
        });
      },
      false
    );
  }
}
