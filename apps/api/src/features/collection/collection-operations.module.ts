import { Module, type DynamicModule } from '@nestjs/common';
import { CollectionOperationsService } from './collection-operations.service.js';
import { CollectionOperationsRepository } from './collection-operations.repository.js';
import { TypeOrmCollectionOperationsRepository } from '../../persistence/collection-operations.repository.js';
import { CollectionOperationsController } from './collection-operations.controller.js';
import {
  CollectionEnabledGuard,
  CollectionMaintenanceGuard,
  COLLECTION_OPTIONS,
  type CollectionOptions,
} from './collection-admin.guard.js';
import { AdminGuard, HTTP_OPTIONS } from '../../http/auth.guard.js';
@Module({})
export class CollectionOperationsModule {
  static register(persistence: DynamicModule, options: CollectionOptions = {}): DynamicModule {
    return {
      module: CollectionOperationsModule,
      imports: [persistence],
      controllers: [CollectionOperationsController],
      providers: [
        CollectionOperationsService,
        CollectionEnabledGuard,
        CollectionMaintenanceGuard,
        AdminGuard,
        {
          provide: CollectionOperationsRepository,
          useClass: TypeOrmCollectionOperationsRepository,
        },
        { provide: HTTP_OPTIONS, useValue: options },
        { provide: COLLECTION_OPTIONS, useValue: options },
      ],
      exports: [CollectionOperationsService],
    };
  }
}
