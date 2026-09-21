export interface ClaimCandidate {
  id: string;
  sourceId: string;
  originUrl: string;
  discoveryMode: 'MANUAL_URL' | 'LIST_CRAWL';
}
export interface LeaseGrant {
  attemptCount: number;
  lockVersion: number;
  leaseUntil: Date;
}
export abstract class CollectorLeaseRepository {
  abstract expireUnclaimable(candidateId: string | null): Promise<string[]>;
  abstract claimable(candidateId: string | null, maxItems: number): Promise<ClaimCandidate[]>;
  abstract claim(
    candidateId: string,
    collectorId: string,
    seconds: number,
    executionId?: string
  ): Promise<LeaseGrant>;
  abstract heartbeat(candidateId: string, seconds: number, spring: boolean): Promise<LeaseGrant>;
}
