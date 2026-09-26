import { Inject, Injectable } from '@nestjs/common';
import { ScheduleAlertsRepository } from './schedule-alerts.repository.js';
import { UnitOfWork } from '../shared/unit-of-work.js';
import { ApiError } from '../shared/errors.js';
export interface ScheduleEvent {
  event: 'SCHEDULE_FAILED';
  groupKey: string;
  postId: number;
  scheduledAt: string;
  errorCode: string;
  attemptedAt: string;
  firstAttemptAt: string;
  attemptCount: number;
  newAttempts: number;
}
export type ScheduleSender = (event: ScheduleEvent) => Promise<void>;
export const SCHEDULE_SENDER = Symbol('SCHEDULE_SENDER');
@Injectable()
export class ScheduleAlertsService {
  constructor(
    @Inject(ScheduleAlertsRepository) private readonly repository: ScheduleAlertsRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(SCHEDULE_SENDER) private readonly send: ScheduleSender
  ) {}
  async deliver(now = new Date()): Promise<number> {
    try {
      return await this.work.lock(
        72498132,
        async () => {
          let delivered = 0,
            failed = false;
          for (const row of await this.repository.pending(now)) {
            try {
              await this.send({
                event: 'SCHEDULE_FAILED',
                groupKey: `${row.postId}:${row.scheduledAt.toISOString()}:${row.errorCode}`,
                postId: Number(row.postId),
                scheduledAt: row.scheduledAt.toISOString(),
                errorCode: row.errorCode,
                attemptedAt: row.lastAttemptAt.toISOString(),
                firstAttemptAt: row.firstAttemptAt.toISOString(),
                attemptCount: row.attemptCount,
                newAttempts: row.attemptCount - row.notifiedCount,
              });
              await this.repository.delivered(row, now);
              delivered++;
            } catch {
              failed = true;
            }
          }
          if (failed) throw new Error('SCHEDULE_ALERT_DELIVERY_FAILED');
          return delivered;
        },
        false
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'IDEMPOTENCY_IN_PROGRESS') return 0;
      throw error;
    }
  }
}
