import { Controller,Get,Post,Inject,UseGuards,Injectable,type CanActivate,type ExecutionContext } from '@nestjs/common';
import { DirectRequestService } from './direct-request.service.js';
import { COLLECTION_OPTIONS,CollectionMaintenanceGuard,type CollectionOptions } from './collection-admin.guard.js';
import { Actor,AdminGuard } from '../../http/auth.guard.js';
import { Input,ContractPipe,stringField,type RequestInput,type CoreRequest } from '../../http/contracts.js';
import { HttpResult } from '../../http/response.js';
import { ApiError,fail } from '../../shared/errors.js';
@Injectable()
export class DirectEnabledGuard implements CanActivate {
 constructor(@Inject(COLLECTION_OPTIONS) private readonly options:CollectionOptions){}
 canActivate(){if(!this.options.collectDirectInputEnabled)fail(404,'COLLECTION_REQUEST_NOT_FOUND');return true;}
}
@Injectable()
export class DirectReadLimitGuard implements CanActivate {
 private readonly limits=new Map<string,{count:number;expires:number}>();
 canActivate(context:ExecutionContext){
  const request=context.switchToHttp().getRequest<CoreRequest>();if(request.method!=='GET')return true;
  const actor=request.actor;if(!actor)fail(401,'ADMIN_AUTH_REQUIRED');const now=Date.now();
  for(const [key,value] of this.limits)if(value.expires<=now)this.limits.delete(key);
  const value=this.limits.get(actor)??{count:0,expires:now+60000};value.count++;this.limits.set(actor,value);
  if(value.count>120)throw new ApiError(429,'RATE_LIMITED',undefined,Math.max(1,Math.ceil((value.expires-now)/1000)));
  return true;
 }
}
function fields(value:unknown):Record<string,unknown>{
 if(typeof value!=='object'||value===null||Array.isArray(value))fail(400,'VALIDATION_FAILED');return Object.fromEntries(Object.entries(value));
}
@Controller('/api/v1/admin/collect')
@UseGuards(DirectEnabledGuard,AdminGuard,CollectionMaintenanceGuard,DirectReadLimitGuard)
export class DirectRequestController {
 constructor(@Inject(DirectRequestService) private readonly service:DirectRequestService){}
 @Post('requests') async create(@Input(ContractPipe) input:RequestInput,@Actor() actor:string){
  return new HttpResult(await this.service.create(stringField(fields(input.body),'url'),actor,stringField(input.headers,'idempotency-key')),{},202,'private, no-store');
 }
 @Get('requests/:requestId') async get(@Input(ContractPipe) input:RequestInput){
  return new HttpResult(await this.service.get(stringField(input.params,'requestId')),{},200,'private, no-store');
 }
 @Post('requests/:requestId/retry') async retry(@Input(ContractPipe) input:RequestInput,@Actor() actor:string){
  const version=fields(input.body).expectedVersion;if(typeof version!=='number'||!Number.isSafeInteger(version)||version<0)fail(400,'VALIDATION_FAILED');
  return new HttpResult(await this.service.retry(stringField(input.params,'requestId'),version,actor,stringField(input.headers,'idempotency-key')),{},202,'private, no-store');
 }
 @Get('runtime-sources') async runtime(@Input(ContractPipe) _input:RequestInput){
  return new HttpResult(await this.service.runtime(),{},200,'private, no-store');
 }
}
