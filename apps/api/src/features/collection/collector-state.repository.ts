import type { operations } from '@blariyo/contracts/collection-api';
export type CollectorEventInput =
  operations['collectorOperationalEvent']['requestBody']['content']['application/json'];
export interface EventReceipt {
  id: string;
  createdAt: Date;
  requestHash: Buffer;
}
export abstract class CollectorStateRepository {
  abstract candidateCounts(): Promise<{ status: string; count: number }[]>;
  abstract recentErrors(hours: number): Promise<{ code: string; count: number }[]>;
  abstract disabledSources(): Promise<number>;
  abstract delivery(collectorId: string, deliveryId: string): Promise<EventReceipt | null>;
  abstract createEvent(
    collectorId: string,
    body: CollectorEventInput,
    hash: Buffer
  ): Promise<EventReceipt>;
  abstract refreshOwnership(
    candidateId: string,
    collectorId: string,
    executionId: string
  ): Promise<void>;
  abstract missingPreviews(
    candidateId: string
  ): Promise<{ id: string; position: number; remoteUrl: string }[]>;
}
