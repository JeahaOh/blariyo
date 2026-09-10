import { Inject,Injectable } from '@nestjs/common';
import { ScheduleAlertsRepository,type ScheduleAlert } from '../operations/schedule-alerts.repository.js';
import { DatabaseContext } from './database.js';
import { OpsScheduleFailureAlertEntity } from './entities.js';
@Injectable()
export class TypeOrmScheduleAlertsRepository extends ScheduleAlertsRepository {
 constructor(@Inject(DatabaseContext) private readonly db:DatabaseContext){super();}
 async pending(now:Date){
  const rows=await this.db.manager.createQueryBuilder(OpsScheduleFailureAlertEntity,'a')
   .where('a.attempt_count > a.notified_count').andWhere("(a.notified_at IS NULL OR a.notified_at <= :now::timestamptz-interval '15 minutes')",{now})
   .orderBy('a.first_attempt_at','ASC').addOrderBy('a.post_id','ASC').getMany();
  return rows.map(row=>({postId:row.post_id,scheduledAt:row.scheduled_at,errorCode:row.error_code,lastAttemptAt:row.last_attempt_at,
    firstAttemptAt:row.first_attempt_at,attemptCount:row.attempt_count,notifiedCount:row.notified_count}));
 }
 async delivered(alert:ScheduleAlert,now:Date) {
  await this.db.manager.createQueryBuilder().update(OpsScheduleFailureAlertEntity)
    .set({notified_count:alert.attemptCount,notified_at:now,updated_at:()=> 'now()'})
    .where('post_id=:postId AND scheduled_at=:scheduledAt AND error_code=:errorCode',alert).execute();
 }
}
