import { Module,type DynamicModule } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';
import { HealthService,HEALTH_OPTIONS,type HealthOptions } from './health.service.js';
import { HealthController } from './health.controller.js';
import { TypeOrmHealthRepository } from '../../persistence/health.repository.js';
@Module({})
export class HealthModule {
 static register(persistence:DynamicModule,options:HealthOptions):DynamicModule{
  return {module:HealthModule,imports:[persistence],controllers:[HealthController],providers:[HealthService,
   {provide:HealthRepository,useClass:TypeOrmHealthRepository},{provide:HEALTH_OPTIONS,useValue:options}]};
 }
}
