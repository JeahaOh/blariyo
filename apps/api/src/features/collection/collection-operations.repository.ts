import type { operations } from '@blariyo/contracts/collection-api';
type EventDto =
  operations['listCollectorOperationalEvents']['responses'][200]['content']['application/json']['data']['items'][number];
export interface TransitionState {
  legacyRunning: number;
  legacyPreviews: number;
  strict: boolean;
}
export interface OperationalEvent {
  eventId: string;
  candidateId: string | null;
  eventCode: string;
  severity: EventDto['severity'];
  occurredAt: Date;
  deliveryStatus: EventDto['deliveryStatus'];
}
export interface EventAcknowledgment {
  eventId: string;
  acknowledgedAt: Date;
}
export abstract class CollectionOperationsRepository {
  abstract schemaReady(): Promise<boolean>;
  abstract hasLegacyMutationData(): Promise<boolean>;
  abstract inspectTransition(): Promise<TransitionState>;
  abstract lockTransitionTables(): Promise<void>;
  abstract enforceTransitionConstraints(): Promise<void>;
  abstract eventsAvailable(): Promise<boolean>;
  abstract unacknowledgedEvents(): Promise<OperationalEvent[]>;
  abstract acknowledge(eventId: string): Promise<EventAcknowledgment | null>;
}
