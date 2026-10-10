import type { SourceFailureLog } from './failure-diagnostics.js';
export interface SourcePublishPolicy {
  sourceKey: string;
  displayName: string;
  autoPublishEnabled: boolean;
  sourceUrl: string | null;
  collectionEnabled: boolean | null;
  collectionAvailable: boolean;
  collectionBlockedReason: string | null;
  collectionLockVersion: number;
  enabledSince: string | null;
  lockVersion: number;
  updatedAt: string | null;
  lastCollectedAt: string | null;
  lastRunAt: string | null;
  lastRunState: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'BLOCKED' | null;
  lastFailureCodes: string[];
  lastFailures: SourceFailureLog[];
}
export abstract class SourcePublishPolicyRepository {
  abstract list(): Promise<SourcePublishPolicy[]>;
  abstract update(source: string, enabled: boolean, version: number, actor: string, collection?: { enabled: boolean; version: number }): Promise<SourcePublishPolicy>;
  abstract candidates(limit: number): Promise<{ itemId: string; sourceKey: string; policyVersion: number }[]>;
  abstract pending(limit: number): Promise<string[]>;
  /** In a transaction the policy share lock lasts through the final write. */
  abstract assertEligible(itemId: string, body: Record<string, unknown>): Promise<void>;
}
