import { CollectionPromotionService } from './collection-promotion.service.js';
import { CollectionCleanupService } from './collection-cleanup.service.js';
import { CollectionCleanupRepository } from './collection-cleanup.repository.js';
import { TypeOrmCollectionCleanupRepository } from '../../persistence/collection-cleanup.repository.js';
import { CollectionOperationsModule } from './collection-operations.module.js';
import { CollectorController } from './collector.controller.js';
import { CollectorGuard } from '../../http/collector.guard.js';
import { CollectorInputPipe } from '../../http/collector-input.js';
import { CollectorCommandsService } from './collector-commands.service.js';
import { CollectorProtocolService } from './collector-protocol.service.js';
import { CollectorStateService } from './collector-state.service.js';
import { CollectorStateRepository } from './collector-state.repository.js';
import { TypeOrmCollectorStateRepository } from '../../persistence/collector-state.repository.js';
import { CollectorQuotaService } from './collector-quota.service.js';
import { CollectorQuotaRepository } from './collector-quota.repository.js';
import { TypeOrmCollectorQuotaRepository } from '../../persistence/collector-quota.repository.js';
import { CollectorPreviewService } from './collector-preview.service.js';
import { CollectorReceiptRepository } from './collector-receipt.repository.js';
import { TypeOrmCollectorReceiptRepository } from '../../persistence/collector-receipt.repository.js';
import { CollectorResultService } from './collector-result.service.js';
import { CollectorLeaseService } from './collector-lease.service.js';
import { CollectorLeaseRepository } from './collector-lease.repository.js';
import { TypeOrmCollectorLeaseRepository } from '../../persistence/collector-lease.repository.js';
import { IdempotencyRepository } from '../../shared/idempotency.repository.js';
import { TypeOrmIdempotencyRepository } from '../../persistence/idempotency.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { TypeOrmOutboxRepository } from '../../persistence/outbox.repository.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { CollectionService } from './collection.service.js';
import { CollectionRepository } from './collection.repository.js';
import { TypeOrmCollectionRepository } from '../../persistence/collection.repository.js';
import { CollectionController } from './collection.controller.js';
import {
  CollectionEnabledGuard,
  CollectionMaintenanceGuard,
  COLLECTION_OPTIONS,
  type CollectionOptions,
} from './collection-admin.guard.js';
import { AdminGuard, HTTP_OPTIONS } from '../../http/auth.guard.js';
import { Storage } from '../../shared/storage.js';
import { BatchResultRepository } from './batch-result.repository.js';
import { TypeOrmBatchResultRepository } from '../../persistence/batch-result.repository.js';
@Module({})
export class CollectionModule {
  static register(
    persistence: DynamicModule,
    storage: Storage,
    options: CollectionOptions,
    images: DynamicModule,
    posts: DynamicModule
  ): DynamicModule {
    return {
      module: CollectionModule,
      imports: [
        persistence,
        images,
        posts,
        CollectionOperationsModule.register(persistence, options),
      ],
      controllers: [CollectionController, CollectorController],
      providers: [
        CollectionPromotionService,
        CollectionCleanupService,
        { provide: CollectionCleanupRepository, useClass: TypeOrmCollectionCleanupRepository },
        CollectorGuard,
        CollectorInputPipe,
        CollectorCommandsService,
        CollectorProtocolService,
        CollectorStateService,
        CollectorQuotaService,
        { provide: CollectorStateRepository, useClass: TypeOrmCollectorStateRepository },
        { provide: CollectorQuotaRepository, useClass: TypeOrmCollectorQuotaRepository },
        CollectorPreviewService,
        { provide: CollectorReceiptRepository, useClass: TypeOrmCollectorReceiptRepository },
        CollectorResultService,
        CollectorLeaseService,
        { provide: CollectorLeaseRepository, useClass: TypeOrmCollectorLeaseRepository },
        { provide: IdempotencyRepository, useClass: TypeOrmIdempotencyRepository },
        { provide: OutboxRepository, useClass: TypeOrmOutboxRepository },
        CollectionService,
        CollectionEnabledGuard,
        CollectionMaintenanceGuard,
        AdminGuard,
        { provide: CollectionRepository, useClass: TypeOrmCollectionRepository },
        { provide: BatchResultRepository, useClass: TypeOrmBatchResultRepository },
        { provide: Storage, useValue: storage },
        { provide: HTTP_OPTIONS, useValue: options },
        { provide: COLLECTION_OPTIONS, useValue: options },
      ],
      exports: [
        CollectionCleanupService,
        CollectionService,
        CollectorLeaseService,
        CollectorResultService,
        CollectorPreviewService,
      ],
    };
  }
}
