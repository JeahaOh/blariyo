import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { CollectionRepository } from './collection.repository.js';
import {
  CollectorReceiptRepository,
  type CollectorReceiptKey,
} from './collector-receipt.repository.js';
import type { CandidateRecord } from './collection.model.js';
import { Storage } from '../../shared/storage.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { validateImages, type ImageFile } from '../images/image-validation.js';
import { ApiError, fail, validId } from '../../shared/errors.js';
export interface PreviewInput {
  collectorId: string;
  lockVersion: number;
}
export interface SpringPreview {
  executionId: string;
  receipt: CollectorReceiptKey;
}
@Injectable()
export class CollectorPreviewService {
  constructor(
    @Inject(CollectionRepository) private readonly repository: CollectionRepository,
    @Inject(Storage) private readonly storage: Storage,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository,
    @Inject(CollectorReceiptRepository) private readonly receipts: CollectorReceiptRepository
  ) {}
  private version(candidate: CandidateRecord, body: PreviewInput) {
    if (candidate.lockVersion !== body.lockVersion) fail(409, 'CANDIDATE_VERSION_CONFLICT');
    if (candidate.status !== 'NEW') fail(409, 'CANDIDATE_STATE_CONFLICT');
  }
  async upload(
    candidateId: string,
    imageId: string,
    body: PreviewInput,
    file: ImageFile,
    spring?: SpringPreview
  ) {
    if (!validId(imageId)) fail(404, 'IMAGE_NOT_FOUND');
    return this.work.lock(`collect:candidate:${candidateId}`, async () => {
      if (!validId(candidateId)) fail(404, 'CANDIDATE_NOT_FOUND');
      const candidate = await this.repository.find(candidateId);
      if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
      if (
        spring &&
        (candidate.collectorId !== body.collectorId ||
          candidate.collectorExecutionId !== spring.executionId.toLowerCase())
      )
        fail(409, 'CANDIDATE_EXECUTION_CONFLICT');
      this.version(candidate, body);
      if (candidate.collectorId !== body.collectorId) fail(403, 'COLLECTOR_FORBIDDEN');
      const image = (await this.repository.images(candidateId)).find(
        (image) => image.id === imageId
      );
      if (!image) fail(404, 'IMAGE_NOT_FOUND');
      const validated = (await validateImages([file]))[0];
      if (!validated) throw new Error('MISSING_VALIDATED_IMAGE');
      const key = `collect-preview/${candidateId}/${randomUUID()}.${validated.ext}`;
      const actor = 'system:collector';
      try {
        await this.storage.put('private', key, validated.bytes);
        return await this.work.transaction(async () => {
          const current = await this.repository.find(candidateId, true);
          if (!current) fail(404, 'CANDIDATE_NOT_FOUND');
          this.version(current, body);
          if (image.previewStorageKey)
            await this.outbox.enqueue({
              type: 'OBJECT_DELETE_PRIVATE',
              aggregateType: 'STORAGE_OBJECT',
              aggregateId: null,
              payload: { privateStorageKey: image.previewStorageKey },
              actor,
            });
          const expiresAt = await this.repository.storePreview(
            imageId,
            key,
            spring ? createHash('sha256').update(file.bytes).digest() : undefined
          );
          await this.repository.markPreviewUploaded(
            candidateId,
            await this.repository.duplicatePost(candidate.originUrl, [validated.hash])
          );
          const data = {
            candidateImageId: Number(imageId),
            previewPath: `/api/v1/admin/collect/candidates/${candidateId}/images/${imageId}/preview`,
            previewExpiresAt: expiresAt.toISOString(),
            lockVersion: candidate.lockVersion + 1,
          };
          if (spring) await this.receipts.save(spring.receipt, 200, data);
          return data;
        });
      } catch (error) {
        // A lost commit acknowledgment is not proof of rollback. Keep the object unless DB confirms it is unreferenced.
        const committed = await this.repository.previewReferenced(key).catch(() => null);
        if (committed === false) {
          try {
            await this.storage.delete('private', key);
          } catch {
            await this.outbox
              .enqueue({
                type: 'OBJECT_DELETE_PRIVATE',
                aggregateType: 'STORAGE_OBJECT',
                aggregateId: null,
                payload: { privateStorageKey: key },
                actor,
              })
              .catch(() => {});
          }
        }
        if (error instanceof ApiError) throw error;
        fail(503, 'DEPENDENCY_UNAVAILABLE');
      }
    });
  }
}
