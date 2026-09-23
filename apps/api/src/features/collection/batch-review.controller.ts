import {Controller,Get,Post,Inject,UseGuards,Injectable,type CanActivate} from '@nestjs/common';
import {schemaValidator} from '@blariyo/contracts';
import type {components} from '@blariyo/contracts/collection-api';
import {BatchReviewService} from './batch-review.service.js';
import {Actor,AdminGuard} from '../../http/auth.guard.js';
import {Input,ContractPipe,stringField,type RequestInput} from '../../http/contracts.js';
import {HttpResult,BinaryResult} from '../../http/response.js';
import {COLLECTION_OPTIONS,CollectionMaintenanceGuard,type CollectionOptions} from './collection-admin.guard.js';
import {fail} from '../../shared/errors.js';
@Injectable()
export class BatchReviewEnabledGuard implements CanActivate {
  constructor(@Inject(COLLECTION_OPTIONS) private readonly options:CollectionOptions){}
  canActivate(){if(!this.options.collectBatchReviewEnabled)fail(404,'BATCH_ITEM_NOT_FOUND');return true;}
}
function reviewIs(value:unknown):value is components['schemas']['BatchReviewRequest']{return schemaValidator({$ref:'#/components/schemas/BatchReviewRequest'})(value);}
function draftIs(value:unknown):value is components['schemas']['BatchDraftRequest']{return schemaValidator({$ref:'#/components/schemas/BatchDraftRequest'})(value);}
@Controller('/api/v1/admin/collect/batch-items')
@UseGuards(BatchReviewEnabledGuard,AdminGuard,CollectionMaintenanceGuard)
export class BatchReviewController {
  constructor(@Inject(BatchReviewService) private readonly service:BatchReviewService){}
  @Get() async list(@Input(ContractPipe) input:RequestInput){
    return new HttpResult(await this.service.list(Number(stringField(input.query,'page','1')),stringField(input.query,'source')||undefined,stringField(input.query,'state')||undefined,stringField(input.query,'reviewStatus')||undefined),{},200,'private, no-store');
  }
  @Get(':itemId') async detail(@Input(ContractPipe) input:RequestInput){
    return new HttpResult(await this.service.detail(stringField(input.params,'itemId')),{},200,'private, no-store');
  }
  @Get(':itemId/media/:position/preview') async preview(@Input(ContractPipe) input:RequestInput){
    const result=await this.service.preview(stringField(input.params,'itemId'),Number(stringField(input.params,'position')));
    return new BinaryResult(result.bytes,result.mime);
  }
  @Post(':itemId/review') async review(@Input(ContractPipe) input:RequestInput,@Actor() actor:string){
    if(!reviewIs(input.body))fail(400,'VALIDATION_FAILED');
    const result=await this.service.review(stringField(input.params,'itemId'),input.body,actor,stringField(input.headers,'idempotency-key'));
    return new HttpResult(result.data,{},result.status,'private, no-store');
  }
  @Post(':itemId/draft') async draft(@Input(ContractPipe) input:RequestInput,@Actor() actor:string){
    if(!draftIs(input.body))fail(400,'VALIDATION_FAILED');
    const result=await this.service.promote(stringField(input.params,'itemId'),input.body,actor,stringField(input.headers,'idempotency-key'));
    return new HttpResult(result.data,{},result.status,'private, no-store');
  }
}
