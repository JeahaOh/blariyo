import { Inject,Injectable } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';
export const HEALTH_OPTIONS=Symbol('HEALTH_OPTIONS');
export interface HealthOptions {collectManualUrlEnabled?:boolean;collectDiscordCommandEnabled?:boolean}
@Injectable()
export class HealthService {
 constructor(@Inject(HealthRepository) private readonly repository:HealthRepository,@Inject(HEALTH_OPTIONS) private readonly options:HealthOptions){}
 async ready(){try{return await this.repository.ready(Boolean(this.options.collectManualUrlEnabled||this.options.collectDiscordCommandEnabled));}catch{return false;}}
}
