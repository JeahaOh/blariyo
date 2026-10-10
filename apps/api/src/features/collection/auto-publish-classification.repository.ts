import type { AutoPublishClassification } from './auto-publish-classifier.js';
export interface ClassificationRecord extends AutoPublishClassification {
  itemId: string;
  itemVersion: number;
  policyVersion: number;
  contentDigest: string;
  title: string;
}
export abstract class AutoPublishClassificationRepository {
  abstract record(input: ClassificationRecord): Promise<void>;
  abstract duplicateTitle(title: string): Promise<boolean>;
}
