export abstract class CollectionCleanupRepository {
  abstract expireOperationalData(): Promise<void>;
  abstract candidates(): Promise<string[]>;
  abstract expiredPreviews(candidateId: string): Promise<{ id: string; key: string }[]>;
  abstract clearPreview(imageId: string): Promise<void>;
  abstract removeCandidate(candidateId: string): Promise<void>;
}
