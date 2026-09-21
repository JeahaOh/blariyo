import { Inject, Injectable } from '@nestjs/common';
import type { operations } from '@blariyo/contracts/collection-api';
import { CollectionRepository } from './collection.repository.js';
import { CollectionService } from './collection.service.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { collectionDigest, normalizeCollectionUrl } from './collection-url.js';
import { fail, validId } from '../../shared/errors.js';
import { validateContent } from './collection-content.js';
export type CollectorResultInput =
  operations['collectorResult']['requestBody']['content']['application/json'];
@Injectable()
export class CollectorResultService {
  constructor(
    @Inject(CollectionRepository) private readonly repository: CollectionRepository,
    @Inject(CollectionService) private readonly collection: CollectionService,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  /** The caller's receipt transaction may wrap this transaction; all repositories share its connection. */
  async submit(candidateId: string, body: CollectorResultInput, executionId?: string) {
    if (!validId(candidateId)) fail(404, 'CANDIDATE_NOT_FOUND');
    return this.work
      .lock(`collect:candidate:${candidateId}`, () =>
        this.work.transaction(async () => {
          const candidate = await this.repository.find(candidateId, true);
          if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
          if (
            executionId !== undefined &&
            (candidate.collectorId !== body.collectorId ||
              candidate.collectorExecutionId !== executionId.toLowerCase())
          )
            fail(409, 'CANDIDATE_EXECUTION_CONFLICT');
          if (
            candidate.status !== 'RUNNING' ||
            candidate.collectorId !== body.collectorId ||
            candidate.lockVersion !== body.lockVersion ||
            !candidate.leaseUntil ||
            candidate.leaseUntil <= new Date()
          )
            fail(409, 'CANDIDATE_LEASE_CONFLICT');
          const source = await this.repository.source(candidate.sourceId);
          if (!source) fail(404, 'SOURCE_NOT_FOUND');
          const actor = 'system:collector';
          if (body.status === 'NEW') {
            const contentBlocks = validateContent(
              body.contentBlocks,
              body.imageCandidates.map((image) => image.position)
            );
            if (!source.isActive || source.robotsAllowed !== true || !source.robotsCheckedAt)
              fail(403, 'SOURCE_NOT_ALLOWED');
            const url = normalizeCollectionUrl(body.canonicalUrl);
            if (new URL(url).hostname !== source.host) fail(403, 'SOURCE_NOT_ALLOWED');
            if (body.imageCandidates.some((image, index) => image.position !== index + 1))
              fail(400, 'VALIDATION_FAILED');
            const hash = collectionDigest(url);
            if (await this.repository.originExists(hash, candidateId))
              fail(409, 'CANDIDATE_DUPLICATE');
            const images = body.imageCandidates.map((image) => ({
              position: image.position,
              remoteUrl: normalizeCollectionUrl(image.remoteUrl),
            }));
            await this.collection.discardPreviewsInTransaction(candidateId, actor);
            await this.repository.replaceResult(
              candidateId,
              {
                title: body.title.trim(),
                contentBlocks,
                url,
                hash,
                parserVersion: body.parserVersion.trim(),
                sourcePublishedAt:
                  body.sourcePublishedAt === null ? null : new Date(body.sourcePublishedAt),
                duplicatePostId: await this.repository.duplicatePost(url),
                images,
              },
              actor
            );
          }
          const errorCode = body.status === 'FETCH_FAILED' ? body.fetchErrorCode || null : null;
          await this.repository.finishResult(
            candidateId,
            body.status,
            errorCode,
            body.warnings,
            actor,
            executionId === undefined ? undefined : collectionDigest(body)
          );
          await this.repository.recordSourceFetch(source.id, errorCode, actor);
          return {
            candidateId,
            status: body.status,
            lockVersion: candidate.lockVersion + 1,
            images:
              body.status === 'NEW'
                ? (await this.repository.images(candidateId)).map((image) => ({
                    id: image.id,
                    position: image.position,
                  }))
                : [],
          };
        })
      )
      .catch((error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === '23505' &&
          'constraint' in error &&
          typeof error.constraint === 'string' &&
          error.constraint.includes('origin')
        )
          fail(409, 'CANDIDATE_DUPLICATE');
        throw error;
      });
  }
}
