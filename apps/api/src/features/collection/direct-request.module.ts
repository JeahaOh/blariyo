import { Module,type DynamicModule } from '@nestjs/common';
import { DirectRequestController,DirectEnabledGuard,DirectReadLimitGuard } from './direct-request.controller.js';
import { DirectRequestService } from './direct-request.service.js';
import { DirectRequestRepository } from './direct-request.repository.js';
import { TypeOrmDirectRequestRepository } from '../../persistence/direct-request.repository.js';
import { COLLECTION_OPTIONS,CollectionMaintenanceGuard,type CollectionOptions } from './collection-admin.guard.js';
import { HTTP_OPTIONS,AdminGuard } from '../../http/auth.guard.js';
@Module({})
export class DirectRequestModule {
 static register(persistence:DynamicModule,options:CollectionOptions):DynamicModule {
  return {module:DirectRequestModule,imports:[persistence],controllers:[DirectRequestController],providers:[
   DirectRequestService,DirectEnabledGuard,DirectReadLimitGuard,CollectionMaintenanceGuard,AdminGuard,
   {provide:DirectRequestRepository,useClass:TypeOrmDirectRequestRepository},{provide:HTTP_OPTIONS,useValue:options},
   {provide:COLLECTION_OPTIONS,useValue:options}],exports:[DirectRequestService]};
 }
}
