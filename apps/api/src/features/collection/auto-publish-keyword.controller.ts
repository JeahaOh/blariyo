import { Controller, Get, Post, Patch, Inject, UseGuards } from '@nestjs/common';
import { schemaValidator } from '@blariyo/contracts';
import type { components } from '@blariyo/contracts/collection-api';
import { Actor, AdminGuard } from '../../http/auth.guard.js';
import { permitsAdminOperation } from '../../http/admin-permissions.js';
import { Input, ContractPipe, stringField, type RequestInput } from '../../http/contracts.js';
import { HttpResult } from '../../http/response.js';
import { fail } from '../../shared/errors.js';
import { BatchReviewEnabledGuard } from './batch-review.controller.js';
import { CollectionMaintenanceGuard } from './collection-admin.guard.js';
import { AutoPublishKeywordService } from './auto-publish-keyword.service.js';
function valid(value: unknown): value is components['schemas']['SaveAutoPublishKeyword'] {
  return schemaValidator({$ref:'#/components/schemas/SaveAutoPublishKeyword'})(value);
}
function validBulk(value: unknown): value is components['schemas']['BulkAutoPublishKeywords'] {
  return schemaValidator({$ref:'#/components/schemas/BulkAutoPublishKeywords'})(value);
}
@Controller('/api/v1/admin/collect/auto-publish-keywords')
@UseGuards(BatchReviewEnabledGuard,AdminGuard,CollectionMaintenanceGuard)
export class AutoPublishKeywordController {
  constructor(@Inject(AutoPublishKeywordService) private readonly service: AutoPublishKeywordService) {}
  @Get() async list(@Input(ContractPipe) input: RequestInput) {
    return new HttpResult({...await this.service.list(),canManage:permitsAdminOperation(stringField(input.headers,'x-blariyo-admin-role'),'createAutoPublishKeyword')},{},200,'private, no-store');
  }
  private async save(input: RequestInput, actor: string, id?: string) {
    if (!valid(input.body)) fail(400,'VALIDATION_FAILED');
    const {ruleVersion,...keyword} = input.body;
    return new HttpResult({...await this.service.save(keyword,ruleVersion,actor,id),canManage:true},{},200,'private, no-store');
  }
  @Post() create(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) { return this.save(input,actor); }
  @Post('bulk') async bulk(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) {
    if (!validBulk(input.body)) fail(400,'VALIDATION_FAILED');
    const {ruleVersion,...mutation} = input.body;
    return new HttpResult({...await this.service.bulk(mutation,ruleVersion,actor),canManage:true},{},200,'private, no-store');
  }
  @Patch(':keywordId') update(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) { return this.save(input,actor,stringField(input.params,'keywordId')); }
}
