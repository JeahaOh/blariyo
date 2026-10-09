import { Controller, Get, Post, Inject, UseGuards } from '@nestjs/common';
import { schemaValidator } from '@blariyo/contracts';
import type { components } from '@blariyo/contracts/collection-api';
import { Actor, AdminGuard } from '../../http/auth.guard.js';
import { permitsAdminOperation } from '../../http/admin-permissions.js';
import { Input, ContractPipe, stringField, type RequestInput } from '../../http/contracts.js';
import { HttpResult } from '../../http/response.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { fail } from '../../shared/errors.js';
import { BatchReviewEnabledGuard } from './batch-review.controller.js';
import { CollectionMaintenanceGuard } from './collection-admin.guard.js';
import { SourcePublishPolicyRepository } from './source-publish-policy.repository.js';
function valid(value: unknown): value is components['schemas']['UpdateSourcePublishPolicy'] {
  return schemaValidator({$ref:'#/components/schemas/UpdateSourcePublishPolicy'})(value);
}
@Controller('/api/v1/admin/collect/source-publish-policies')
@UseGuards(BatchReviewEnabledGuard,AdminGuard,CollectionMaintenanceGuard)
export class SourcePublishPolicyController {
  constructor(@Inject(SourcePublishPolicyRepository) private readonly policies: SourcePublishPolicyRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork) {}
  @Get() async list(@Input(ContractPipe) input: RequestInput) {
    return new HttpResult({items:await this.policies.list(),
      canManage:permitsAdminOperation(stringField(input.headers,'x-blariyo-admin-role'),'updateSourcePublishPolicy')},{},200,'private, no-store');
  }
  @Post(':sourceKey') async update(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) {
    if (!valid(input.body)) fail(400,'VALIDATION_FAILED');
    const body = input.body;
    if ((body.collectionEnabled === undefined) !== (body.collectionLockVersion === undefined)) fail(400,'VALIDATION_FAILED');
    const collection = body.collectionEnabled === undefined || body.collectionLockVersion === undefined ? undefined
      : { enabled: body.collectionEnabled, version: body.collectionLockVersion };
    const result = await this.work.transaction(()=>this.policies.update(stringField(input.params,'sourceKey'),body.autoPublishEnabled,body.lockVersion,actor,collection));
    return new HttpResult(result,{},200,'private, no-store');
  }
}
