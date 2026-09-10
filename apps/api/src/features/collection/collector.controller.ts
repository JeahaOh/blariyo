import { Controller, Get, Post, Inject, UseGuards } from '@nestjs/common';
import { CollectorGuard } from '../../http/collector.guard.js';
import {
  CollectorInput,
  CollectorInputPipe,
  collectorCommand,
  collectorBody,
  type CollectorInputValue,
} from '../../http/collector-input.js';
import { stringField } from '../../http/contracts.js';
import { HttpResult } from '../../http/response.js';
import { CollectorCommandsService } from './collector-commands.service.js';
import { CollectorStateService } from './collector-state.service.js';
import { CollectorQuotaService } from './collector-quota.service.js';
@Controller('/internal/collect')
@UseGuards(CollectorGuard)
export class CollectorController {
  constructor(
    @Inject(CollectorCommandsService) private readonly commands: CollectorCommandsService,
    @Inject(CollectorStateService) private readonly state: CollectorStateService,
    @Inject(CollectorQuotaService) private readonly quota: CollectorQuotaService
  ) {}
  private async command(value: CollectorInputValue) {
    const command = collectorCommand(value);
    const result =
      value.collector.contractVersion === 'SPRING_V2'
        ? await this.commands.spring(command, value.collector.collectorId, value.key)
        : await this.commands.legacy(command, value.collector.collectorId, value.key);
    return new HttpResult(result.data, {}, result.status, 'private, no-store');
  }
  @Post('candidates') create(@CollectorInput(CollectorInputPipe) value: CollectorInputValue) {
    return this.command(value);
  }
  @Post('candidates/claim') claim(@CollectorInput(CollectorInputPipe) value: CollectorInputValue) {
    return this.command(value);
  }
  @Post('candidates/:candidateId/heartbeat') heartbeat(
    @CollectorInput(CollectorInputPipe) value: CollectorInputValue
  ) {
    return this.command(value);
  }
  @Post('candidates/:candidateId/result') result(
    @CollectorInput(CollectorInputPipe) value: CollectorInputValue
  ) {
    return this.command(value);
  }
  @Post('candidates/:candidateId/images/:candidateImageId/preview') preview(
    @CollectorInput(CollectorInputPipe) value: CollectorInputValue
  ) {
    return this.command(value);
  }
  @Get('status') async status(@CollectorInput(CollectorInputPipe) value: CollectorInputValue) {
    return new HttpResult(
      await this.state.status(Number(stringField(value.input.query, 'windowHours', '24'))),
      {},
      200,
      'private, no-store'
    );
  }
  @Get('candidates/:candidateId/execution-state') async execution(
    @CollectorInput(CollectorInputPipe) value: CollectorInputValue
  ) {
    return new HttpResult(
      await this.state.executionState(
        stringField(value.input.params, 'candidateId'),
        value.collector.collectorId,
        stringField(value.input.query, 'collectorExecutionId')
      ),
      {},
      200,
      'private, no-store'
    );
  }
  @Post('sources/:sourceId/request-reservations') async reserve(
    @CollectorInput(CollectorInputPipe) value: CollectorInputValue
  ) {
    return new HttpResult(
      await this.quota.reserve(
        stringField(value.input.params, 'sourceId'),
        value.collector.collectorId,
        value.key,
        collectorBody(value.input, 'collectorReservation')
      ),
      {},
      201,
      'private, no-store'
    );
  }
  @Post('operational-events') async event(
    @CollectorInput(CollectorInputPipe) value: CollectorInputValue
  ) {
    return new HttpResult(
      await this.state.event(
        value.collector.collectorId,
        value.key,
        collectorBody(value.input, 'collectorOperationalEvent')
      ),
      {},
      202,
      'private, no-store'
    );
  }
}
