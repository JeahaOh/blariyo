import { Module,type DynamicModule } from '@nestjs/common';
import { PoliciesService } from './policies.service.js';
import { PoliciesRepository } from './policies.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { TypeOrmPoliciesRepository } from '../../persistence/policies.repository.js';
import { TypeOrmOutboxRepository } from '../../persistence/outbox.repository.js';
@Module({})
export class PoliciesModule {
 static register(persistence:DynamicModule):DynamicModule {
  return {module:PoliciesModule,imports:[persistence],providers:[PoliciesService,
   {provide:PoliciesRepository,useClass:TypeOrmPoliciesRepository},{provide:OutboxRepository,useClass:TypeOrmOutboxRepository}],exports:[PoliciesService]};
 }
}
