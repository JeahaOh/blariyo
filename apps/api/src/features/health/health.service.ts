import { Inject,Injectable } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';
export const HEALTH_OPTIONS=Symbol('HEALTH_OPTIONS');
export interface HealthOptions {discordReviewEnabled?:boolean;collectDirectInputEnabled?:boolean;collectBatchReviewEnabled?:boolean;collectManualUrlEnabled?:boolean;collectDiscordCommandEnabled?:boolean}
@Injectable()
export class HealthService {
 constructor(@Inject(HealthRepository) private readonly repository:HealthRepository,@Inject(HEALTH_OPTIONS) private readonly options:HealthOptions){}
 async ready(){try{return await this.repository.commonCodesReady() && await this.repository.ready(Boolean(this.options.collectManualUrlEnabled||this.options.collectDiscordCommandEnabled),Boolean(this.options.collectBatchReviewEnabled),Boolean(this.options.collectDirectInputEnabled),Boolean(this.options.discordReviewEnabled));}catch{return false;}}
}
