import type { Bucket } from '../shared/storage.js';
export abstract class CleanupRepository {
  abstract collectionAvailable(): Promise<boolean>;
  abstract lockExpiredStaged(): Promise<{ id: string; privateKey: string }[]>;
  abstract expireReceipts(): Promise<void>;
  abstract referenced(bucket: Bucket, key: string, collectionPreview: boolean): Promise<boolean>;
}
