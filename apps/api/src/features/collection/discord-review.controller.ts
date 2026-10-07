import { Controller, Get, Post, Inject, UseGuards, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { matchOperation, validateRequest } from '@blariyo/contracts';
import type { operations } from '@blariyo/contracts/collection-api';
import { Input, ContractPipe, stringField, type RequestInput, type CoreRequest } from '../../http/contracts.js';
import { Actor, AdminGuard } from '../../http/auth.guard.js';
import { HttpResult, BinaryResult } from '../../http/response.js';
import { fail } from '../../shared/errors.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { DiscordReviewService } from './discord-review.service.js';
import { DiscordReviewRepository } from './discord-review.repository.js';
import { DiscordCleanupRepository } from './discord-cleanup.js';
import { privateReviewFile, DISCORD_REVIEW_SETTINGS, type DiscordReviewSettings } from './review-authority.js';
import { CollectionMaintenanceGuard } from './collection-admin.guard.js';

type Body<Id extends keyof operations> = operations[Id] extends {requestBody:{content:{'application/json':infer T}}} ? T : never;
function body<Id extends keyof operations>(input: RequestInput, id: Id): Body<Id> {
  const valid=(value:unknown):value is Body<Id> => input.operation.operationId===id &&
    validateRequest(input.operation,{query:input.query,headers:input.headers,body:value});
  if(!valid(input.body))fail(400,'VALIDATION_FAILED');
  return input.body;
}
const scanOf=(value:{scanId:string;leaseToken:string})=>({id:value.scanId,leaseToken:value.leaseToken,cutoff:''});
@Injectable()
export class DiscordReviewWorkerGuard implements CanActivate {
  constructor(@Inject(DISCORD_REVIEW_SETTINGS) private readonly settings: DiscordReviewSettings) {}
  canActivate(context: ExecutionContext) {
    const request=context.switchToHttp().getRequest<CoreRequest>();
    const operation=matchOperation(request.method,request.path);
    if(!operation)fail(404,'DISCORD_OPERATION_NOT_FOUND');
    const token=privateReviewFile(this.settings.workerTokenFile).trim(),given=request.get('X-Blariyo-Review-Token')??'';
    if(token.length<32||Buffer.byteLength(given)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(given)))fail(401,'DISCORD_WORKER_AUTH_REQUIRED');
    const scope=operation.operationId==='discordReviewMedia'||['claimDiscordReviewExport','ackDiscordReviewExport'].includes(operation.operationId)?'export':
      ['claimDiscordReviewScan','nextDiscordReviewScan','chunkDiscordReviewScan','finishDiscordReviewScan'].includes(operation.operationId)?'scan':'maintenance';
    if(request.get('X-Blariyo-Review-Scope')!==scope)fail(403,'DISCORD_WORKER_SCOPE_INVALID');
    return true;
  }
}
@Controller('/internal/discord-review/v1')
@UseGuards(DiscordReviewWorkerGuard,CollectionMaintenanceGuard)
export class DiscordReviewController {
  constructor(@Inject(DiscordReviewService) private readonly service: DiscordReviewService,
    @Inject(DiscordReviewRepository) private readonly repository: DiscordReviewRepository,
    @Inject(DiscordCleanupRepository) private readonly cleanup: DiscordCleanupRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork) {}
  @Get('runtime') runtime(@Input(ContractPipe) _input:RequestInput){return new HttpResult(this.service.runtime());}
  @Post('export/claim') async exportClaim(@Input(ContractPipe) input:RequestInput){
    return new HttpResult(await this.service.exportClaim(body(input,'claimDiscordReviewExport').workerId));
  }
  @Post('deliveries/:deliveryId/ack') async ack(@Input(ContractPipe) input:RequestInput){
    return new HttpResult(await this.service.ack(stringField(input.params,'deliveryId'),body(input,'ackDiscordReviewExport')));
  }
  @Get('deliveries/:deliveryId/media/:position') async media(@Input(ContractPipe) input:RequestInput){
    const result=await this.service.media(stringField(input.params,'deliveryId'),Number(stringField(input.params,'position')),
      stringField(input.query,'leaseToken'),Number(input.query.generation));
    return new BinaryResult(result.bytes,result.mime,'private, no-store',true,result.deadline);
  }
  @Post('scan/claim') async scanClaim(@Input(ContractPipe) input:RequestInput){return new HttpResult(await this.service.scanClaim(body(input,'claimDiscordReviewScan').workerId));}
  @Post('scan/next') async scanNext(@Input(ContractPipe) input:RequestInput){return new HttpResult(await this.service.scanNext(scanOf(body(input,'nextDiscordReviewScan'))));}
  @Post('scan/chunk') async chunk(@Input(ContractPipe) input:RequestInput){
    const value=body(input,'chunkDiscordReviewScan');return new HttpResult(await this.service.chunk(scanOf(value),value.deliveryId,value.index,value.messages));
  }
  @Post('scan/finish') async finish(@Input(ContractPipe) input:RequestInput){
    const value=body(input,'finishDiscordReviewScan');return new HttpResult(await this.service.finish(scanOf(value),value.deliveryId));
  }
  @Get('jobs') async jobs(@Input(ContractPipe) _input:RequestInput){return new HttpResult(await this.service.jobs());}
  @Post('commands/:commandId/advance') async advance(@Input(ContractPipe) input:RequestInput){
    return new HttpResult(await this.service.advance(stringField(input.params,'commandId'),body(input,'advanceDiscordReviewCommand').workerId));
  }
  @Post('deliveries/:deliveryId/cleanup/claim') async cleanupClaim(@Input(ContractPipe) input:RequestInput){
    const id=stringField(input.params,'deliveryId');
    if(!await this.repository.delivery(id))fail(404,'DISCORD_DELIVERY_NOT_FOUND');
    return new HttpResult({claim:await this.work.transaction(()=>this.cleanup.claim(id,body(input,'claimDiscordReviewCleanup').workerId))});
  }
  @Post('deliveries/:deliveryId/cleanup/ack') async cleanupAck(@Input(ContractPipe) input:RequestInput){
    const id=stringField(input.params,'deliveryId'),value=body(input,'ackDiscordReviewCleanup');
    const delivery=await this.repository.delivery(id);
    if(!delivery||value.claim.deliveryId!==id||value.claim.channelId!==delivery.channelId||
      value.claim.headMessageId!==delivery.headMessageId||value.claim.threadId!==delivery.threadId)fail(409,'DISCORD_CLEANUP_SCOPE_INVALID');
    return new HttpResult({accepted:await this.work.transaction(()=>this.cleanup.acknowledge(value.claim,value.result))});
  }
  @Post('deliveries/:deliveryId/notice/claim') async noticeClaim(@Input(ContractPipe) input:RequestInput){
    return new HttpResult({claim:await this.work.transaction(()=>this.repository.claimNotice(stringField(input.params,'deliveryId'),body(input,'claimDiscordReviewNotice').workerId))});
  }
  @Post('deliveries/:deliveryId/notice/ack') async noticeAck(@Input(ContractPipe) input:RequestInput){
    await this.work.transaction(()=>this.repository.acknowledgeNotice(stringField(input.params,'deliveryId'),body(input,'ackDiscordReviewNotice')));
    return new HttpResult({accepted:true});
  }
}
@Controller('/api/v1/admin/collect/batch-items')
@UseGuards(AdminGuard,CollectionMaintenanceGuard)
export class AdminReviewCommandController {
  constructor(@Inject(DiscordReviewService) private readonly service: DiscordReviewService) {}
  @Post(':itemId/commands') async command(@Input(ContractPipe) input:RequestInput,@Actor() actor:string){
    return new HttpResult(await this.service.adminCommand(stringField(input.params,'itemId'),body(input,'createBatchReviewCommand'),actor,stringField(input.headers,'idempotency-key')));
  }
  @Get(':itemId/commands/status') async status(@Input(ContractPipe) input:RequestInput){return new HttpResult(await this.service.status(stringField(input.params,'itemId')));}
}
