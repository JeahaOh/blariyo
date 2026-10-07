import { Controller, Get, Post, Patch, Inject, UseGuards } from '@nestjs/common';
import { schemaValidator } from '@blariyo/contracts';
import type { components } from '@blariyo/contracts/collection-api';
import { CommonCodeService } from './common-code.service.js';
import { Actor, AdminGuard } from '../../http/auth.guard.js';
import { permitsAdminOperation } from '../../http/admin-permissions.js';
import { Input, ContractPipe, stringField, type RequestInput } from '../../http/contracts.js';
import { HttpResult } from '../../http/response.js';
import { fail } from '../../shared/errors.js';
function groupBody(value: unknown): value is components['schemas']['CreateCommonCodeGroup'] {
  return schemaValidator({ $ref: '#/components/schemas/CreateCommonCodeGroup' })(value);
}
function createBody(value: unknown): value is components['schemas']['CreateCommonCode'] {
  return schemaValidator({ $ref: '#/components/schemas/CreateCommonCode' })(value);
}
function updateBody(value: unknown): value is components['schemas']['UpdateCommonCode'] {
  return schemaValidator({ $ref: '#/components/schemas/UpdateCommonCode' })(value);
}
function response(data: unknown, status=200) { return new HttpResult(data,{},status,'private, no-store'); }
function canManage(input: RequestInput) { return permitsAdminOperation(stringField(input.headers,'x-blariyo-admin-role'),'createCommonCode'); }
@Controller('/api/v1/admin/common-code-groups')
@UseGuards(AdminGuard)
export class CommonCodeController {
  constructor(@Inject(CommonCodeService) private readonly service: CommonCodeService) {}
  @Get() async groups(@Input(ContractPipe) input: RequestInput) {
    return response({items:await this.service.groups(),canManage:canManage(input)});
  }
  @Post() async createGroup(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) {
    if(!groupBody(input.body)) fail(400,'VALIDATION_FAILED');
    return response(await this.service.createGroup(input.body.groupKey,input.body.displayName,actor),201);
  }
  @Patch(':groupKey') async updateGroup(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) {
    if(!updateBody(input.body)) fail(400,'VALIDATION_FAILED');
    return response(await this.service.updateGroup(stringField(input.params,'groupKey'),input.body.displayName,input.body.lockVersion,actor));
  }
  @Get(':groupKey/codes') async list(@Input(ContractPipe) input: RequestInput) {
    return response({items:await this.service.list(stringField(input.params,'groupKey')),canManage:canManage(input)});
  }
  @Post(':groupKey/codes') async create(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) {
    if(!createBody(input.body)) fail(400,'VALIDATION_FAILED');
    return response(await this.service.create(stringField(input.params,'groupKey'),input.body.code,input.body.displayName,input.body.referenceKey,actor),201);
  }
  @Patch(':groupKey/codes/:code') async update(@Input(ContractPipe) input: RequestInput,@Actor() actor: string) {
    if(!updateBody(input.body)) fail(400,'VALIDATION_FAILED');
    return response(await this.service.update(stringField(input.params,'groupKey'),stringField(input.params,'code'),input.body.displayName,input.body.lockVersion,actor));
  }
}
