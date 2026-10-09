export type ReviewCommandStage = 'ACCEPTED' | 'APPROVED' | 'PREPARING' | 'DRAFTED' | 'PUBLISHED' | 'REJECTED' | 'CANCELLED' | 'NEEDS_ADMIN' | 'FAILED';
export interface AcceptReviewCommand {
  itemId: string;
  origin: 'ADMIN' | 'DISCORD' | 'SYSTEM' | 'AUTO';
  action: 'APPROVE_PUBLISH' | 'REJECT';
  actor: string;
  operatorId: string | null;
  reviewerIds: string[];
  expectedEpoch: number;
  itemVersion: number;
  reviewVersion: number;
  contentDigest: string;
  selectionDigest: string;
  excludedUnitIds: string[];
  evidence: Record<string, unknown>;
  requestBody: Record<string, unknown>;
  requestKey: string;
  requestHash: string;
}
export interface ReviewCommandRecord {
  id: string;
  itemId: string;
  origin: AcceptReviewCommand['origin'];
  action: AcceptReviewCommand['action'];
  actor: string;
  operatorId: string | null;
  reviewerIds: string[];
  epoch: number;
  itemVersion: number;
  reviewVersion: number;
  contentDigest: string;
  selectionDigest: string;
  excludedUnitIds: string[];
  requestBody: Record<string, unknown>;
  stage: ReviewCommandStage;
  postId: number | null;
  postVersion: number | null;
  leaseToken: string | null;
  finished: boolean;
}
export abstract class ReviewCommandRepository {
  /** Caller owns the transaction; accept + review decision + cleanup must commit together. */
  abstract accept(input: AcceptReviewCommand): Promise<{ command: ReviewCommandRecord; created: boolean; preemptedDiscordReviewVersion: number | null }>;
  abstract replay(actor: string, key: string, hash: string): Promise<ReviewCommandRecord | null>;
  abstract find(id: string): Promise<ReviewCommandRecord | null>;
  abstract claim(id: string, workerId: string): Promise<ReviewCommandRecord | null>;
  /** Locks authority until the caller's final draft/publication transaction completes. */
  abstract assertActive(id: string, epoch: number, leaseToken: string): Promise<ReviewCommandRecord>;
  abstract progress(id: string, epoch: number, leaseToken: string, expected: ReviewCommandStage,
    stage: ReviewCommandStage, post?: { id: number; version: number }, reviewVersion?: number, safeCode?: string): Promise<ReviewCommandRecord>;
  abstract retry(id: string, epoch: number, leaseToken: string, safeCode: string): Promise<void>;
  abstract enqueueCleanup(itemId: string): Promise<string[]>;
}
