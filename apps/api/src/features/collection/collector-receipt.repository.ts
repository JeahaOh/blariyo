export interface CollectorReceiptKey {
  collectorId: string;
  operation: string;
  keyHash: Buffer;
  requestHash: Buffer;
}
export interface CollectorReceipt {
  requestHash: Buffer;
  status: number;
  data: unknown;
}
export abstract class CollectorReceiptRepository {
  abstract find(
    collectorId: string,
    operation: string,
    keyHash: Buffer
  ): Promise<CollectorReceipt | null>;
  abstract save(key: CollectorReceiptKey, status: number, data: unknown): Promise<void>;
}
