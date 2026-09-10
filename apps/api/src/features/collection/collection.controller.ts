import { CollectionPromotionService } from './collection-promotion.service.js';
import { Controller, Get, Post, Patch, Inject, UseGuards } from '@nestjs/common';
import { AdminGuard, Actor } from '../../http/auth.guard.js';
import { ContractPipe, Input, stringField, type RequestInput } from '../../http/contracts.js';
import { HttpResult, BinaryResult } from '../../http/response.js';
import { CollectionEnabledGuard, CollectionMaintenanceGuard } from './collection-admin.guard.js';
import { CollectionService } from './collection.service.js';
import {
  promotionBody,
  sourceDto,
  sourceUpdate,
  candidateDto,
  candidateDetailDto,
  collectionCommand,
} from './collection.dto.js';
@Controller('/api/v1/admin/collect')
@UseGuards(CollectionEnabledGuard, AdminGuard, CollectionMaintenanceGuard)
export class CollectionController {
  constructor(
    @Inject(CollectionService) private readonly service: CollectionService,
    @Inject(CollectionPromotionService) private readonly promotion: CollectionPromotionService
  ) {}
  @Post('candidates/:candidateId/draft') async draft(
    @Input(ContractPipe) input: RequestInput,
    @Actor() actor: string
  ) {
    const result = await this.promotion.promote(
      stringField(input.params, 'candidateId'),
      promotionBody(input),
      actor,
      stringField(input.headers, 'idempotency-key'),
      `${input.method} ${input.operation.pattern}`
    );
    return new HttpResult(result.data, {}, result.status, 'private, no-store');
  }
  private async execute(input: RequestInput, actor: string) {
    const result = await this.service.command(
      collectionCommand(input),
      actor,
      stringField(input.headers, 'idempotency-key'),
      `${input.method} ${input.operation.pattern}`
    );
    return new HttpResult(result.data, {}, result.status, 'private, no-store');
  }
  @Post('candidates') create(@Input(ContractPipe) input: RequestInput, @Actor() actor: string) {
    return this.execute(input, actor);
  }
  @Post('candidates/:candidateId/retry') retry(
    @Input(ContractPipe) input: RequestInput,
    @Actor() actor: string
  ) {
    return this.execute(input, actor);
  }
  @Post('candidates/:candidateId/reject') reject(
    @Input(ContractPipe) input: RequestInput,
    @Actor() actor: string
  ) {
    return this.execute(input, actor);
  }
  @Get('sources') async sources(@Input(ContractPipe) _input: RequestInput) {
    return new HttpResult(
      { items: (await this.service.sources()).map(sourceDto) },
      {},
      200,
      'private, no-store'
    );
  }
  @Patch('sources/:sourceId') async updateSource(
    @Input(ContractPipe) input: RequestInput,
    @Actor() actor: string
  ) {
    return new HttpResult(
      sourceDto(
        await this.service.updateSource(
          stringField(input.params, 'sourceId'),
          sourceUpdate(input),
          actor
        )
      ),
      {},
      200,
      'private, no-store'
    );
  }
  @Get('candidates') async search(@Input(ContractPipe) input: RequestInput) {
    const result = await this.service.search({
      status: stringField(input.query, 'status'),
      sourceId: stringField(input.query, 'sourceId'),
      discoveryMode: stringField(input.query, 'discoveryMode'),
      duplicateOnly: stringField(input.query, 'duplicateOnly') === 'true',
      page: Number(stringField(input.query, 'page', '1')),
    });
    return new HttpResult(
      { items: result.items.map(candidateDto) },
      result.meta,
      200,
      'private, no-store'
    );
  }
  @Get('candidates/:candidateId') async detail(@Input(ContractPipe) input: RequestInput) {
    return new HttpResult(
      candidateDetailDto(await this.service.detail(stringField(input.params, 'candidateId'))),
      {},
      200,
      'private, no-store'
    );
  }
  @Get('candidates/:candidateId/images/:candidateImageId/preview') async preview(
    @Input(ContractPipe) input: RequestInput
  ) {
    const result = await this.service.preview(
      stringField(input.params, 'candidateId'),
      stringField(input.params, 'candidateImageId')
    );
    return new BinaryResult(result.bytes, result.mime);
  }
}
