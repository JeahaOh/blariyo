import type { BatchResultRow } from './batch-result.repository.js';
export interface Review {
  itemId: string;
  contentDigest: Buffer;
  itemVersion: number;
  status: 'REVIEWING' | 'REJECTED' | 'APPROVED';
  lockVersion: number;
  postId: number | null;
}
export interface BatchMedia {
  id: string;
  position: number;
  kind: 'IMAGE' | 'FILE';
  remoteUrl: string | null;
  mime: string | null;
  size: number | null;
  hash: Buffer | null;
  key: string | null;
}
export interface BatchReceipt {
  hash: Buffer;
  status: number;
  data: unknown;
}
export abstract class BatchReviewRepository {
  abstract list(
    page: number,
    source?: string,
    state?: string,
    reviewStatus?: string
  ): Promise<{ items: BatchResultRow[]; total: number }>;
  abstract item(id: string): Promise<BatchResultRow | null>;
  abstract media(id: string): Promise<BatchMedia[]>;
  abstract review(id: string): Promise<Review | null>;
  abstract setReview(
    item: BatchResultRow,
    decision: Review['status'],
    version: number,
    actor: string,
    canonicalHash: Buffer,
    contentDigest: Buffer
  ): Promise<Review>;
  abstract promote(id: string, version: number, postId: number, actor: string): Promise<Review>;
  abstract existingPost(canonicalUrl: string): Promise<string | null>;
  abstract receipt(actor: string, scope: string, key: string): Promise<BatchReceipt | null>;
  abstract saveReceipt(
    actor: string,
    scope: string,
    key: string,
    hash: Buffer,
    status: number,
    data: unknown
  ): Promise<void>;
}
