import { CleanupService } from './cleanup.service.js';
import { CleanupRepository } from './cleanup.repository.js';
import { TypeOrmCleanupRepository } from '../persistence/cleanup.repository.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { ScheduleAlertsService, SCHEDULE_SENDER } from './schedule-alerts.service.js';
import { ScheduleAlertsRepository } from './schedule-alerts.repository.js';
import { TypeOrmScheduleAlertsRepository } from '../persistence/schedule-alerts.repository.js';
import { scheduleWebhook } from '../adapters/schedule-webhook.js';
import { OutboxService } from './outbox.service.js';
import { OutboxRepository } from './outbox.repository.js';
import { ImagesRepository } from '../features/images/images.repository.js';
import { TypeOrmOutboxRepository } from '../persistence/outbox.repository.js';
import { TypeOrmImagesRepository } from '../persistence/images.repository.js';
import { Storage, EdgeCache } from '../shared/storage.js';
@Module({})
export class OperationsModule {
  static register(
    persistence: DynamicModule,
    storage: Storage,
    cache: EdgeCache,
    collection: DynamicModule
  ): DynamicModule {
    return {
      module: OperationsModule,
      imports: [persistence, collection],
      providers: [
        CleanupService,
        { provide: CleanupRepository, useClass: TypeOrmCleanupRepository },
        ScheduleAlertsService,
        { provide: ScheduleAlertsRepository, useClass: TypeOrmScheduleAlertsRepository },
        { provide: SCHEDULE_SENDER, useFactory: () => scheduleWebhook() },
        OutboxService,
        { provide: OutboxRepository, useClass: TypeOrmOutboxRepository },
        { provide: ImagesRepository, useClass: TypeOrmImagesRepository },
        { provide: Storage, useValue: storage },
        { provide: EdgeCache, useValue: cache },
      ],
      exports: [CleanupService, OutboxService, ScheduleAlertsService],
    };
  }
}
