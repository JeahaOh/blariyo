export interface ScheduleAlert {
  postId: string;
  scheduledAt: Date;
  errorCode: string;
  lastAttemptAt: Date;
  firstAttemptAt: Date;
  attemptCount: number;
  notifiedCount: number;
}
export abstract class ScheduleAlertsRepository {
  abstract pending(now: Date): Promise<ScheduleAlert[]>;
  abstract delivered(alert: ScheduleAlert, now: Date): Promise<void>;
}
