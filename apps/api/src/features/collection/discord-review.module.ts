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
  static register(persistence:DynamicModule,batches:DynamicModule,posts:DynamicModule,options:CollectionOptions,settings:DiscordReviewSettings):DynamicModule {
    return {module:DiscordReviewModule,imports:[persistence,batches,posts],controllers:[DiscordReviewController,AdminReviewCommandController],
      providers:[AdminGuard,CollectionMaintenanceGuard,DiscordReviewWorkerGuard,ReviewAuthority,DiscordReviewService,ReviewCommandService,DiscordCleanupService,DiscordCleanupDispatcher,
        {provide:HTTP_OPTIONS,useValue:options},{provide:COLLECTION_OPTIONS,useValue:options},{provide:DISCORD_REVIEW_SETTINGS,useValue:settings},
        {provide:DiscordReviewRepository,useClass:TypeOrmDiscordReviewRepository},{provide:ReviewCommandRepository,useClass:TypeOrmReviewCommandRepository},
        {provide:DiscordCleanupRepository,useClass:TypeOrmDiscordCleanupRepository},
        {provide:DiscordDeleteClient,useFactory:()=>new RestDiscordDeleteClient({tokenFile:settings.botTokenFile,channelId:settings.channelId,guildId:settings.guildId})}]};
  }
}
