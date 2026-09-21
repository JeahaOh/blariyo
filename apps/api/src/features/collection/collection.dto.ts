import type { components, operations } from '@blariyo/contracts/collection-api';
import { validateRequest } from '@blariyo/contracts';
import { stringField, type RequestInput } from '../../http/contracts.js';
import { fail } from '../../shared/errors.js';
import type {
  SourceRecord,
  CandidateRecord,
  CandidateImage,
  UpdateSource,
  CollectionCommand,
  CreateCandidate,
  RetryCandidate,
  RejectCandidate,
} from './collection.model.js';
export function sourceDto(source: SourceRecord): components['schemas']['CollectionSource'] {
  return {
    sourceId: Number(source.id),
    name: source.name,
    baseUrl: source.baseUrl,
    host: source.host,
    fetchMode: source.fetchMode,
    parserType: source.parserType,
    listUrl: source.listUrl,
    isActive: source.isActive,
    isListCrawlEnabled: source.isListCrawlEnabled,
    robotsAllowed: source.robotsAllowed,
    robotsCheckedAt: source.robotsCheckedAt?.toISOString() ?? null,
    requestIntervalMs: source.requestIntervalMs,
    dailyFetchLimit: source.dailyFetchLimit,
    lastFetchedAt: source.lastFetchedAt?.toISOString() ?? null,
    lastErrorCode: source.lastErrorCode,
    disabledReasonCode: source.disabledReasonCode,
    lockVersion: source.lockVersion,
    updatedAt: source.updatedAt.toISOString(),
  };
}
export function candidateDto(
  candidate: CandidateRecord
): components['schemas']['CollectionCandidate'] {
  return {
    candidateId: Number(candidate.id),
    sourceId: Number(candidate.sourceId),
    sourceName: candidate.sourceName,
    originUrl: candidate.originUrl,
    title: candidate.title,
    status: candidate.status,
    discoveryMode: candidate.discoveryMode,
    imageCandidateCount: candidate.imageCount,
    duplicatePostId: candidate.duplicatePostId === null ? null : Number(candidate.duplicatePostId),
    postId: candidate.postId === null ? null : Number(candidate.postId),
    rejectReasonCode: candidate.rejectReasonCode,
    fetchErrorCode: candidate.fetchErrorCode,
    requestedAt: candidate.requestedAt.toISOString(),
    claimedAt: candidate.claimedAt?.toISOString() ?? null,
    fetchedAt: candidate.fetchedAt?.toISOString() ?? null,
    lockVersion: candidate.lockVersion,
  };
}
export function candidateDetailDto(value: {
  candidate: CandidateRecord;
  images: CandidateImage[];
}): operations['getCollectionCandidate']['responses'][200]['content']['application/json']['data'] {
  return {
    ...candidateDto(value.candidate),
    warnings: value.candidate.warnings,
    contentBlocks: value.candidate.contentBlocks,
    imageCandidates: value.images.map((image) => ({
      candidateImageId: Number(image.id),
      position: image.position,
      remoteUrl: image.remoteUrl,
      status: image.status,
      imageId: image.imageId === null ? null : Number(image.imageId),
      previewPath:
        image.previewStorageKey && image.previewExpiresAt && image.previewExpiresAt > new Date()
          ? `/api/v1/admin/collect/candidates/${value.candidate.id}/images/${image.id}/preview`
          : null,
      previewExpiresAt: image.previewExpiresAt?.toISOString() ?? null,
      fetchErrorCode: image.fetchErrorCode,
    })),
  };
}
export function sourceUpdate(input: RequestInput): UpdateSource {
  const value = input.body;
  function isUpdate(body: unknown): body is UpdateSource {
    return (
      input.operation.operationId === 'updateCollectionSource' &&
      validateRequest(input.operation, { body, query: input.query, headers: input.headers })
    );
  }
  if (!isUpdate(value)) fail(400, 'VALIDATION_FAILED');
  return value;
}

export function collectionCommand(input: RequestInput): CollectionCommand {
  const body = input.body;
  function validated<
    K extends
      'createCollectionCandidate' | 'retryCollectionCandidate' | 'rejectCollectionCandidate',
  >(
    value: unknown,
    operationId: K
  ): value is {
    createCollectionCandidate: CreateCandidate;
    retryCollectionCandidate: RetryCandidate;
    rejectCollectionCandidate: RejectCandidate;
  }[K] {
    return (
      input.operation.operationId === operationId &&
      validateRequest(input.operation, { body: value, query: input.query, headers: input.headers })
    );
  }
  if (validated(body, 'createCollectionCandidate'))
    return { action: 'create', params: input.params, body };
  const params = { candidateId: stringField(input.params, 'candidateId') };
  if (validated(body, 'retryCollectionCandidate')) return { action: 'retry', params, body };
  if (validated(body, 'rejectCollectionCandidate')) return { action: 'reject', params, body };
  fail(400, 'VALIDATION_FAILED');
}

export function promotionBody(
  input: RequestInput
): import('./collection-promotion.service.js').PromoteCandidate {
  function valid(
    value: unknown
  ): value is import('./collection-promotion.service.js').PromoteCandidate {
    return (
      input.operation.operationId === 'promoteCollectionCandidate' &&
      validateRequest(input.operation, { body: value, query: input.query, headers: input.headers })
    );
  }
  if (!valid(input.body)) fail(400, 'VALIDATION_FAILED');
  return input.body;
}
