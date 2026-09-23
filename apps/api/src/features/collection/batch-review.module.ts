import {Module,type DynamicModule} from '@nestjs/common';
import {BatchReviewController,BatchReviewEnabledGuard} from './batch-review.controller.js';
import {BatchReviewService} from './batch-review.service.js';
import {BatchReviewRepository} from './batch-review.repository.js';
import {TypeOrmBatchReviewRepository} from '../../persistence/batch-review.repository.js';
import {BatchResultRepository} from './batch-result.repository.js';
import {TypeOrmBatchResultRepository} from '../../persistence/batch-result.repository.js';
import {CollectReader} from '../../shared/collect-reader.js';
import {AdminGuard,HTTP_OPTIONS} from '../../http/auth.guard.js';
import {COLLECTION_OPTIONS,CollectionMaintenanceGuard,type CollectionOptions} from './collection-admin.guard.js';
@Module({})
export class BatchReviewModule {
  static register(persistence:DynamicModule,images:DynamicModule,posts:DynamicModule,reader:CollectReader,options:CollectionOptions):DynamicModule{
    return {module:BatchReviewModule,imports:[persistence,images,posts],controllers:[BatchReviewController],providers:[
      BatchReviewService,BatchReviewEnabledGuard,AdminGuard,CollectionMaintenanceGuard,
      {provide:BatchReviewRepository,useClass:TypeOrmBatchReviewRepository},
      {provide:BatchResultRepository,useClass:TypeOrmBatchResultRepository},
      {provide:CollectReader,useValue:reader},{provide:HTTP_OPTIONS,useValue:options},{provide:COLLECTION_OPTIONS,useValue:options},
    ],exports:[BatchReviewService]};
  }
}
