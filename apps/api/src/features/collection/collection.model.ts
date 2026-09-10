import type { components, operations } from '@blariyo/contracts/collection-api';
export type UpdateSource =
  operations['updateCollectionSource']['requestBody']['content']['application/json'];
export interface SourceRecord {
  id: string;
  name: string;
  baseUrl: string;
  host: string;
  fetchMode: 'URL_ONLY';
  parserType: 'MANUAL';
  listUrl: null;
  isListCrawlEnabled: false;
  isActive: boolean;
  robotsAllowed: boolean | null;
  robotsCheckedAt: Date | null;
  requestIntervalMs: number;
  dailyFetchLimit: number;
  lastFetchedAt: Date | null;
  lastErrorCode: string | null;
  disabledReasonCode: string | null;
  lockVersion: number;
  updatedAt: Date;
  nextRequestAt: Date | null;
  consecutiveErrorCount: number;
}
export interface SourceChange {
  isActive: boolean;
  robotsAllowed: boolean | null;
  robotsCheckedAt: Date | null;
  requestIntervalMs: number;
  dailyFetchLimit: number;
  disabledReasonCode: string | null;
}
export interface CandidateRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  imageCount: number;
  originUrl: string;
  originUrlSha256: Buffer;
  title: string | null;
  status: components['schemas']['CollectionCandidate']['status'];
  discoveryMode: 'MANUAL_URL';
  duplicatePostId: string | null;
  postId: string | null;
  rejectReasonCode: string | null;
  fetchErrorCode: string | null;
  requestedAt: Date;
  claimedAt: Date | null;
  fetchedAt: Date | null;
  reviewedAt: Date | null;
  lockVersion: number;
  collectorId: string | null;
  collectorExecutionId: string | null;
  leaseUntil: Date | null;
  attemptCount: number;
  warnings: string[];
  parserVersion: string | null;
  sourcePublishedAt: Date | null;
  resultPayloadSha256: Buffer | null;
  lastHeartbeatAt: Date | null;
}
export interface CandidateImage {
  id: string;
  candidateId: string;
  position: number;
  remoteUrl: string;
  status: components['schemas']['CollectionCandidateImage']['status'];
  imageId: string | null;
  previewStorageKey: string | null;
  previewExpiresAt: Date | null;
  fetchErrorCode: string | null;
  previewSourceSha256: Buffer | null;
  previewUploadedAt: Date | null;
}
export interface CandidateSearch {
  status: string;
  sourceId: string;
  discoveryMode: string;
  duplicateOnly: boolean;
  page: number;
}

export type CreateCandidate =
  operations['createCollectionCandidate']['requestBody']['content']['application/json'];
export type RetryCandidate =
  operations['retryCollectionCandidate']['requestBody']['content']['application/json'];
export type RejectCandidate =
  operations['rejectCollectionCandidate']['requestBody']['content']['application/json'];
export type CollectionCommand =
  | { action: 'create'; params: Record<string, string>; body: CreateCandidate }
  | { action: 'retry'; params: { candidateId: string }; body: RetryCandidate }
  | { action: 'reject'; params: { candidateId: string }; body: RejectCandidate };

export interface CandidateResultMetadata {
  title: string;
  url: string;
  hash: Buffer;
  parserVersion: string;
  sourcePublishedAt: Date | null;
  duplicatePostId: string | null;
  images: { position: number; remoteUrl: string }[];
}
