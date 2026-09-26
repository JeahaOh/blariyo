import { Controller, Get, Inject } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { PlainResult } from '../../http/response.js';
@Controller('/internal/health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly service: HealthService) {}
  @Get('live') live() {
    return { status: 'UP' };
  }
  @Get('ready') async ready() {
    const ready = await this.service.ready();
    return new PlainResult({ status: ready ? 'READY' : 'NOT_READY' }, ready ? 200 : 503);
  }
}
