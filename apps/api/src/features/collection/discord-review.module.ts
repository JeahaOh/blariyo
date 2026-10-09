import { SourcePublishPolicyController } from './source-publish-policy.controller.js';
import { SourcePublishPolicyRepository } from './source-publish-policy.repository.js';
import { TypeOrmSourcePublishPolicyRepository } from '../../persistence/source-publish-policy.repository.js';
import { SourceAutoPublishService } from './source-auto-publish.service.js';
import { BatchReviewEnabledGuard } from './batch-review.controller.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { AdminGuard, HTTP_OPTIONS } from '../../http/auth.guard.js';
import { COLLECTION_OPTIONS, CollectionMaintenanceGuard, type CollectionOptions } from './collection-admin.guard.js';
import { DISCORD_REVIEW_SETTINGS, ReviewAuthority, type DiscordReviewSettings } from './review-authority.js';
import { DiscordReviewController, DiscordReviewWorkerGuard, AdminReviewCommandController } from './discord-review.controller.js';
import { DiscordReviewService } from './discord-review.service.js';
import { DiscordReviewRepository } from './discord-review.repository.js';
import { TypeOrmDiscordReviewRepository } from '../../persistence/discord-review.repository.js';
import { ReviewCommandRepository } from './review-command.repository.js';
import { TypeOrmReviewCommandRepository } from '../../persistence/review-command.repository.js';
import { ReviewCommandService } from './review-command.service.js';
import { DiscordCleanupDispatcher, DiscordCleanupRepository, DiscordCleanupService, DiscordDeleteClient } from './discord-cleanup.js';
import { TypeOrmDiscordCleanupRepository } from '../../persistence/discord-cleanup.repository.js';
import { RestDiscordDeleteClient } from '../../adapters/discord-delete.js';
@Module({})
export class DiscordReviewModule {
  static register(persistence:DynamicModule,batches:DynamicModule,posts:DynamicModule,options:CollectionOptions,settings?:DiscordReviewSettings):DynamicModule {
    return {module:DiscordReviewModule,imports:[persistence,batches,posts],controllers:[SourcePublishPolicyController,...(settings?[DiscordReviewController,AdminReviewCommandController]:[])],
      providers:[AdminGuard,CollectionMaintenanceGuard,BatchReviewEnabledGuard,ReviewAuthority,ReviewCommandService,SourceAutoPublishService,
        {provide:SourcePublishPolicyRepository,useClass:TypeOrmSourcePublishPolicyRepository},
        ...(settings?[DiscordReviewWorkerGuard,DiscordReviewService,DiscordCleanupService,DiscordCleanupDispatcher]:[
          {provide:DiscordCleanupDispatcher,useValue:{notify:(_id:string)=>{}}}]),
        {provide:HTTP_OPTIONS,useValue:options},{provide:COLLECTION_OPTIONS,useValue:options},{provide:DISCORD_REVIEW_SETTINGS,useValue:settings ?? null},
        {provide:DiscordReviewRepository,useClass:TypeOrmDiscordReviewRepository},{provide:ReviewCommandRepository,useClass:TypeOrmReviewCommandRepository},
        {provide:DiscordCleanupRepository,useClass:TypeOrmDiscordCleanupRepository},
        {provide:DiscordDeleteClient,useFactory:()=>settings?new RestDiscordDeleteClient({tokenFile:settings.botTokenFile,channelId:settings.channelId,guildId:settings.guildId}):null}]};
  }
}
