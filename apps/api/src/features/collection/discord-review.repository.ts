import type { ReviewManifest, MessageObservation } from './discord-review-policy.js';
export interface DeliveryPart {
  ordinal: number; unitId: string; fragmentIndex: number; kind: string; imagePosition: number | null;
  messageId: string | null; sendState: string; seeded: boolean; nonce: string;
}
export interface ReviewDelivery {
  id: string; itemId: string; itemVersion: number; contentDigest: string; number: number;
  state: string; generation: number; channelId: string; guildId: string; headMessageId: string | null;
  threadId: string | null; headSeeded: boolean; headSendState: string; headNonce: string;
  leaseToken: string | null; readyAt: string | null; parts: DeliveryPart[];
}
export interface ExportAck {
  leaseToken: string; generation: number;
  event: 'HEAD_BEGIN' | 'HEAD_RETRY' | 'CANCEL_RESOLVED' | 'HEAD_SENT' | 'THREAD_BEGIN' | 'THREAD_SENT' | 'PART_BEGIN' | 'PART_RETRY' | 'PART_SENT' | 'HEAD_SEEDED' | 'PART_SEEDED' | 'READY' | 'ERROR';
  ordinal?: number; messageId?: string; code?: string; blocked?: boolean; retryAfterMs?: number;
}
export interface ReviewScan { id: string; leaseToken: string; cutoff: string }
export interface StoredObservation { startedAt: number; messages: MessageObservation[] }
export interface NoticeClaim {
  deliveryId: string; channelId: string; threadId: string; messageId: string | null;
  leaseToken: string; attemptId: string; nonce: string; text: string;
}
export interface NoticeAck { leaseToken: string; attemptId: string; messageId?: string; error?: string; unavailable?: boolean; blocked?: boolean; retryAfterMs?: number }
export abstract class DiscordReviewRepository {
  abstract claimNotice(id: string, workerId: string): Promise<NoticeClaim | null>;
  abstract acknowledgeNotice(id: string, ack: NoticeAck): Promise<void>;
  abstract candidates(since: string): Promise<string[]>;
  abstract blockCandidate(itemId: string, itemVersion: number, digest: string): Promise<void>;
  abstract reconcileExpired(): Promise<void>;
  abstract create(itemId: string, itemVersion: number, manifest: ReviewManifest): Promise<void>;
  abstract claimExport(workerId: string): Promise<ReviewDelivery | null>;
  abstract delivery(id: string): Promise<ReviewDelivery | null>;
  abstract exportAck(id: string, ack: ExportAck): Promise<void>;
  abstract epoch(itemId: string): Promise<number>;
  abstract startScan(workerId: string, slot: string): Promise<ReviewScan | null>;
  abstract nextScan(scan: ReviewScan): Promise<ReviewDelivery | null>;
  abstract appendObservation(scan: ReviewScan, deliveryId: string, index: number, messages: MessageObservation[]): Promise<void>;
  abstract observation(scan: ReviewScan, deliveryId: string): Promise<StoredObservation>;
  abstract finishObservation(scan: ReviewScan, deliveryId: string, reason: string): Promise<void>;
  abstract jobs(): Promise<{ commands: string[]; cleanup: string[]; notices: string[] }>;
  abstract status(itemId: string): Promise<Record<string, unknown>>;
}
