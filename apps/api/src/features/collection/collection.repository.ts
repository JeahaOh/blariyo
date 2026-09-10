import type {
  SourceRecord,
  CandidateResultMetadata,
  SourceChange,
  CandidateRecord,
  CandidateImage,
  CandidateSearch,
} from './collection.model.js';
export abstract class CollectionRepository {
  abstract approve(
    candidateId: string,
    postId: string,
    images: { candidateImageId: string; imageId: string }[],
    actor: string
  ): Promise<void>;
  abstract activeSourceByHost(host: string): Promise<SourceRecord | null>;
  abstract originExists(hash: Buffer, excludingId?: string): Promise<boolean>;
  abstract duplicatePost(
    url: string,
    hashes?: Buffer[],
    imageIds?: string[]
  ): Promise<string | null>;
  abstract createCandidate(
    sourceId: string,
    url: string,
    hash: Buffer,
    duplicatePostId: string | null,
    actor: string
  ): Promise<CandidateRecord>;
  abstract replaceResult(
    candidateId: string,
    metadata: CandidateResultMetadata,
    actor: string
  ): Promise<void>;
  abstract finishResult(
    candidateId: string,
    status: 'NEW' | 'FETCH_FAILED',
    errorCode: string | null,
    warnings: string[],
    actor: string,
    resultDigest?: Buffer
  ): Promise<void>;
  abstract recordSourceFetch(
    sourceId: string,
    errorCode: string | null,
    actor: string
  ): Promise<void>;
  abstract storePreview(imageId: string, key: string, sourceHash?: Buffer): Promise<Date>;
  abstract markPreviewUploaded(candidateId: string, duplicatePostId: string | null): Promise<void>;
  abstract previewReferenced(key: string): Promise<boolean>;
  abstract clearPreviews(candidateId: string, actor: string): Promise<void>;
  abstract retryCandidate(candidateId: string, actor: string): Promise<void>;
  abstract rejectCandidate(candidateId: string, reason: string, actor: string): Promise<void>;
  abstract sourcesByIds(ids: string[]): Promise<SourceRecord[]>;
  abstract sources(): Promise<SourceRecord[]>;
  abstract source(id: string, lock?: boolean): Promise<SourceRecord | null>;
  abstract updateSource(
    id: string,
    version: number,
    change: SourceChange,
    actor: string
  ): Promise<SourceRecord | null>;
  abstract find(id: string, lock?: boolean): Promise<CandidateRecord | null>;
  abstract search(query: CandidateSearch): Promise<{ items: CandidateRecord[]; total: number }>;
  abstract images(candidateId: string): Promise<CandidateImage[]>;
  abstract livePreview(candidateId: string, imageId: string): Promise<CandidateImage | null>;
}
