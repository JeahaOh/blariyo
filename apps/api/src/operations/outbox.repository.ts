export interface OutboxMessage {
  type: 'CACHE_PURGE' | 'OBJECT_DELETE_PUBLIC' | 'OBJECT_DELETE_PRIVATE';
  aggregateType: 'POST' | 'IMAGE' | 'POLICY' | 'STORAGE_OBJECT';
  aggregateId: string | null;
  payload: Record<string, unknown>;
  actor: string;
  delay?: number;
}
export interface OutboxTask {
  id: string;
  type: OutboxMessage['type'];
  aggregateType: OutboxMessage['aggregateType'];
  aggregateId: string | null;
  payload: Record<string, unknown>;
  claimedAt: Date;
}
export abstract class OutboxRepository {
  abstract recoverExpired(actor: string): Promise<void>;
  abstract claim(actor: string): Promise<OutboxTask | null>;
  abstract owns(task: OutboxTask, lock?: boolean): Promise<boolean>;
  abstract succeed(id: string): Promise<void>;
  abstract fail(task: OutboxTask): Promise<void>;
  abstract enqueue(message: OutboxMessage): Promise<void>;
}
