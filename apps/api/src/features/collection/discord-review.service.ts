import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { ApiError, fail } from '../../shared/errors.js';
import { DiscordReviewRepository, type ReviewScan, type ExportAck } from './discord-review.repository.js';
import { BatchReviewService } from './batch-review.service.js';
import { ReviewCommandService } from './review-command.service.js';
import { ReviewAuthority, DISCORD_REVIEW_SETTINGS, type DiscordReviewSettings } from './review-authority.js';
import { decideReview, reviewManifest, reviewSelection, type MessageObservation } from './discord-review-policy.js';
import { collectionDigest } from './collection-url.js';

/** Most recent due slot; a recovered run always reads current reactions, never reconstructs past votes. */
export function reviewSlot(now: number): string {
  const day=new Date(now+9*3600000).toISOString().slice(0,10);
  const morning=Date.parse(day+'T07:30:00+09:00'), evening=Date.parse(day+'T17:00:00+09:00');
  return new Date(now>=evening?evening:now>=morning?morning:evening-86400000).toISOString();
}
export interface AdminReviewCommand {
  action: 'APPROVE_PUBLISH' | 'REJECT'; itemVersion: number; lockVersion: number; contentDigest: string;
  boardSlug?: string; title?: string; postVersion?: number;
}
@Injectable()
export class DiscordReviewService {
  constructor(@Inject(DiscordReviewRepository) private readonly repository: DiscordReviewRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(BatchReviewService) private readonly batches: BatchReviewService,
    @Inject(ReviewCommandService) private readonly commands: ReviewCommandService,
    @Inject(ReviewAuthority) private readonly authority: ReviewAuthority,
    @Inject(DISCORD_REVIEW_SETTINGS) private readonly settings: DiscordReviewSettings) {}
  runtime() {
    return {environment:this.settings.environment,guildId:this.settings.guildId,channelId:this.settings.channelId,
      reviewerIds:[...this.authority.reviewers().keys()],serverTime:new Date().toISOString()};
  }
  async exportClaim(workerId: string) {
    for (const id of await this.repository.candidates(this.settings.exportSince)) {
      try {
        const detail=(await this.batches.detail(id)).item;
        try {
          const manifest=reviewManifest(detail.bodyBlocks,detail.contentDigest);
          await this.work.transaction(()=>this.repository.create(id,detail.version,manifest));
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'REVIEW_CONTENT_INVALID') throw error;
          await this.work.transaction(()=>this.repository.blockCandidate(id,detail.version,detail.contentDigest));
        }
      } catch (error) {
        if (!(error instanceof ApiError && [404,409,410].includes(error.status))) throw error;
      }
    }
    const delivery=await this.work.transaction(()=>this.repository.claimExport(workerId));
    if (!delivery) return {delivery:null};
    if (delivery.state==='CANCELLED') return {delivery:{...delivery,title:null,sourceUrl:null,fragments:[]}};
    try {
      const detail=(await this.batches.detail(delivery.itemId)).item;
      if(detail.contentDigest!==delivery.contentDigest||detail.version!==delivery.itemVersion)fail(409,'BATCH_ITEM_VERSION_CONFLICT');
      const manifest=reviewManifest(detail.bodyBlocks,detail.contentDigest);
      const fragments=manifest.units.flatMap(unit=>unit.fragments.map((text,index)=>({unitId:unit.id,fragmentIndex:index,
        text:unit.block.type==='IMAGE'?'이미지':text,imagePosition:unit.block.type==='IMAGE'?unit.block.imagePosition:null})));
      return {delivery:{...delivery,title:detail.title,sourceUrl:detail.canonicalUrl,fragments}};
    } catch(error) {
      await this.work.transaction(()=>this.repository.exportAck(delivery.id,{leaseToken:delivery.leaseToken??'',generation:delivery.generation,
        event:'ERROR',code:error instanceof ApiError?error.code:'DISCORD_EXPORT_FAILED',blocked:error instanceof ApiError&&[404,409,410].includes(error.status)}));
      throw error;
    }
  }
  async ack(id: string, ack: ExportAck) {
    await this.work.transaction(()=>this.repository.exportAck(id,ack));
    return {accepted:true};
  }
  async media(id: string, position: number, leaseToken: string, generation: number) {
    const delivery=await this.repository.delivery(id);
    if(!delivery||delivery.state!=='EXPORTING'||delivery.leaseToken!==leaseToken||delivery.generation!==generation||
      !delivery.parts.some(p=>p.imagePosition===position))fail(409,'DISCORD_EXPORT_LEASE_LOST');
    return this.batches.preview(delivery.itemId,position);
  }
  async scanClaim(workerId: string) {
    const slot=reviewSlot(Date.now());
    if(Date.parse(slot)<Date.parse(this.settings.exportSince))return {scan:null};
    return {scan:await this.work.transaction(()=>this.repository.startScan(workerId,slot))};
  }
  async scanNext(scan: ReviewScan) {
    return {delivery:await this.work.transaction(()=>this.repository.nextScan(scan))};
  }
  async chunk(scan: ReviewScan, id: string, index: number, messages: MessageObservation[]) {
    await this.work.transaction(()=>this.repository.appendObservation(scan,id,index,messages));
    return {accepted:true};
  }
  async finish(scan: ReviewScan, id: string) {
    const delivery=await this.repository.delivery(id);
    if(!delivery)fail(404,'DISCORD_DELIVERY_NOT_FOUND');
    let reason='READ_INCOMPLETE';
    const observation=await this.work.transaction(()=>this.repository.observation(scan,id));
    const reviewers=this.authority.reviewers();
    try {
      if(delivery.state!=='READY'||!delivery.readyAt||!delivery.headMessageId)fail(409,'BATCH_REVIEW_SUPERSEDED');
      const detail=(await this.batches.detail(delivery.itemId)).item;
      if(detail.contentDigest!==delivery.contentDigest||detail.version!==delivery.itemVersion)fail(409,'BATCH_ITEM_VERSION_CONFLICT');
      const manifest=reviewManifest(detail.bodyBlocks,detail.contentDigest);
      const head=observation.messages.find(m=>m.messageId===delivery.headMessageId);
      const decision=decideReview(manifest,{readyAt:Date.parse(delivery.readyAt),headMessageId:delivery.headMessageId,
        parts:delivery.parts.map(p=>({messageId:p.messageId??'',unitId:p.unitId}))},
      {observedAt:observation.startedAt,head:head??{messageId:'',complete:false,reactions:[]},
        parts:observation.messages.filter(m=>m.messageId!==delivery.headMessageId)},new Set(reviewers.keys()),Date.now());
      // Duplicate head observations cannot be hidden by find/filter.
      if(observation.messages.filter(m=>m.messageId===delivery.headMessageId).length!==1)reason='READ_INCOMPLETE';
      else if(decision.action==='HOLD')reason=decision.reason;
      else {
        const ids=decision.action==='APPROVE_PUBLISH'?decision.approverIds:decision.reviewerIds;
        const operator=ids.length?reviewers.get(ids[0]??''):null;
        const participants=[...new Set(observation.messages.flatMap(m=>m.reactions.flatMap(r=>r.users
          .filter(u=>!u.bot&&reviewers.has(u.id)).map(u=>u.id))))].sort();
        const reviewerBindings=Object.fromEntries(participants.map(userId=>[userId,reviewers.get(userId)?.operatorId]));
        const excluded=decision.action==='APPROVE_PUBLISH'?decision.excludedUnitIds:[];
        const action=decision.action,origin=operator?'DISCORD':'SYSTEM';
        if(origin==='SYSTEM'&&(action!=='REJECT'||decision.reason!=='EXPIRED'))fail(403,'ADMIN_FORBIDDEN');
        const requestBody={boardSlug:'meme',reviewerBindings};
        const command=await this.commands.accept({itemId:delivery.itemId,origin,action,
          actor:operator?.actor??'system:discord-review-expiry',operatorId:operator?.operatorId??null,
          reviewerIds:ids,expectedEpoch:await this.repository.epoch(delivery.itemId),itemVersion:detail.version,
          reviewVersion:detail.review.lockVersion,contentDigest:detail.contentDigest,
          selectionDigest:reviewSelection(manifest,excluded).digest,excludedUnitIds:excluded,requestBody,
          evidence:{scanId:scan.id,deliveryId:id,observedAt:new Date(observation.startedAt).toISOString(),participants},
          requestKey:`discord:${scan.id}:${id}`,requestHash:collectionDigest({id,scanId:scan.id,action,excluded,reviewerBindings}).toString('hex')});
        reason=command.stage;
      }
    }catch(error){
      if(error instanceof ApiError&&[403,404,409,410].includes(error.status))reason=error.code;
      else throw error;
    }
    await this.work.transaction(()=>this.repository.finishObservation(scan,id,reason));
    return {result:reason};
  }
  async adminCommand(itemId: string, body: AdminReviewCommand, actor: string, key: string) {
    const operator=this.authority.admin(actor);
    const requestHash=collectionDigest({itemId,...body}).toString('hex');
    const replay=await this.commands.replay(actor,key,requestHash);
    if (replay) return {commandId:replay.id,stage:replay.stage,postId:replay.postId};
    const detail=(await this.batches.detail(itemId)).item;
    const status = await this.repository.status(itemId);
    const prior = status.command;
    const excluded = detail.review.postId && prior && typeof prior === 'object' && 'excluded_unit_ids' in prior && Array.isArray(prior.excluded_unit_ids)
      ? prior.excluded_unit_ids.filter((id: unknown): id is string => typeof id === 'string') : [];
    const selection=reviewSelection(reviewManifest(detail.bodyBlocks,detail.contentDigest),excluded);
    const command=await this.commands.accept({itemId,origin:'ADMIN',action:body.action,actor,operatorId:operator.operatorId,reviewerIds:[],
      expectedEpoch:0,itemVersion:body.itemVersion,reviewVersion:body.lockVersion,contentDigest:body.contentDigest,
      selectionDigest:selection.digest,excludedUnitIds:excluded,evidence:{},requestBody:{...(body.postVersion===undefined?{}:{postVersion:body.postVersion}),boardSlug:body.boardSlug??'meme',...(body.title===undefined?{}:{title:body.title})},
      requestKey:key,requestHash});
    return {commandId:command.id,stage:command.stage,postId:command.postId};
  }
  async status(itemId: string) {
    const status = await this.repository.status(itemId);
    const command = status.command;
    if (!command || typeof command !== 'object' || !('excluded_unit_ids' in command) || !Array.isArray(command.excluded_unit_ids))
      return {...status,selection:null};
    let detail;
    try { detail = (await this.batches.detail(itemId)).item; }
    catch (error) {
      if (error instanceof ApiError && [404,409,410].includes(error.status)) return {...status,selection:null};
      throw error;
    }
    const excluded = command.excluded_unit_ids.filter((id:unknown): id is string => typeof id === 'string');
    return {...status,selection:reviewSelection(reviewManifest(detail.bodyBlocks,detail.contentDigest),excluded).blocks};
  }
  async jobs() {
    await this.work.transaction(()=>this.repository.reconcileExpired());
    return this.repository.jobs();
  }
  async advance(id: string, workerId: string) {
    const result=await this.commands.advance(id,workerId);
    return {commandId:result.id,stage:result.stage,postId:result.postId};
  }
}
