export interface QuotaClock {
  now: Date;
  day: string;
  midnight: Date;
}
export interface Reservation {
  id: string;
  sourceId: string;
  candidateId: string | null;
  collectorId: string;
  executionId: string;
  jobRequestId: string;
  requestKeyHash: Buffer;
  requestHash: Buffer;
  requestKind: string;
  day: string;
  reservedAt: Date;
  validUntil: Date;
  nextAllowedAt: Date;
  reservedCount: number;
  remainingCount: number;
}
export abstract class CollectorQuotaRepository {
  abstract clock(): Promise<QuotaClock>;
  abstract reservation(sourceId: string, requestKeyHash: Buffer): Promise<Reservation | null>;
  abstract lockedBudget(sourceId: string, day: string): Promise<number>;
  abstract saveReservation(reservation: Reservation): Promise<void>;
  abstract consume(sourceId: string, day: string, count: number, next: Date): Promise<void>;
}
