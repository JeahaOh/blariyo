import { Inject,Injectable } from '@nestjs/common';
import { PoliciesRepository } from './policies.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { policyArtifact,type PolicyOptions } from './policy-artifact.js';
@Injectable()
export class PoliciesService {
 constructor(@Inject(PoliciesRepository) private readonly repository:PoliciesRepository,
   @Inject(OutboxRepository) private readonly outbox:OutboxRepository,@Inject(UnitOfWork) private readonly work:UnitOfWork) {}
 async publish(input:unknown,options:PolicyOptions={}) {
  const artifact=policyArtifact(input,options),type=artifact.type==='terms'?'TERMS':'PRIVACY';
  return this.work.transaction(async()=>{
   await this.work.transactionLock('policy:'+artifact.type,true);
   const same=await this.repository.version(type,artifact.version);
   if(same){
    if(same.bodyHtml===artifact.bodyHtml&&same.title===artifact.title&&same.effectiveAt?.getTime()===artifact.effectiveAt.getTime())return artifact.version;
    throw new Error('POLICY_VERSION_CONFLICT');
   }
   const current=await this.repository.effective(type);
   if(current?.effectiveAt&&current.effectiveAt>=artifact.effectiveAt)throw new Error('POLICY_EFFECTIVE_ORDER');
   await this.repository.retire(type,artifact.effectiveAt);
   const id=await this.repository.publish({...artifact,type});
   const origin=options.siteOrigin??'http://localhost:3000';
   await this.outbox.enqueue({type:'CACHE_PURGE',aggregateType:'POLICY',aggregateId:id,
    payload:{urls:[`${origin}/api/v1/policies/${artifact.type}`,`${origin}/${artifact.type}`]},actor:'system:policy-publisher'});
   return artifact.version;
  });
 }
 async assertProductionReady(){if(await this.repository.effectiveTypeCount()!==2)throw new Error('POLICY_RELEASE_REQUIRED');}
}
