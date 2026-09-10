export interface Replay {
  hash: Buffer;
  status: number;
  data: unknown;
}
export interface IdempotencyReceipt {
  actor: string;
  scope: string;
  key: string;
  hash: Buffer;
  status: number;
  data: unknown;
  resourceType: 'POST' | 'CANDIDATE';
  resourceId: string;
}
export abstract class IdempotencyRepository {
  abstract find(
    actor: string,
    scope: string,
    key: string,
    activeOnly?: boolean
  ): Promise<Replay | null>;
  abstract save(receipt: IdempotencyReceipt, replaceExpired?: boolean): Promise<void>;
}
