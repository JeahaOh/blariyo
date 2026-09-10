import { Controller, Get, Post, Inject, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../http/auth.guard.js';
import { ContractPipe, Input, stringField, type RequestInput } from '../../http/contracts.js';
import { fail } from '../../shared/errors.js';
import { HttpResult } from '../../http/response.js';
import { CollectionEnabledGuard, CollectionMaintenanceGuard } from './collection-admin.guard.js';
import { CollectionOperationsService } from './collection-operations.service.js';
@Controller('/api/v1/admin/collect/operational-events')
@UseGuards(CollectionEnabledGuard, AdminGuard, CollectionMaintenanceGuard)
export class CollectionOperationsController {
  constructor(
    @Inject(CollectionOperationsService) private readonly service: CollectionOperationsService
  ) {}
  @Get()
  async list(@Input(ContractPipe) _input: RequestInput) {
    const { items } = await this.service.events();
    return new HttpResult(
      {
        items: items.map((event) => ({
          ...event,
          candidateId: event.candidateId === null ? null : Number(event.candidateId),
          occurredAt: event.occurredAt.toISOString(),
        })),
      },
      {},
      200,
      'private, no-store'
    );
  }
  @Post(':eventId/acknowledge')
  async acknowledge(@Input(ContractPipe) input: RequestInput) {
    const eventId = stringField(input.params, 'eventId');
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(eventId))
      fail(400, 'VALIDATION_FAILED');
    const event = await this.service.acknowledge(eventId);
    return new HttpResult(
      {
        eventId: event.eventId,
        deliveryStatus: 'ACKNOWLEDGED',
        acknowledgedAt: event.acknowledgedAt.toISOString(),
      },
      {},
      200,
      'private, no-store'
    );
  }
}
