import { Inject,Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DirectRequestRepository,type DirectRecord,type RuntimeIdentity } from './direct-request.repository.js';
import { directIdentity,directIdentityHash,directHosts } from './direct-url.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { ApiError,fail } from '../../shared/errors.js';

@Injectable()
export class DirectRequestService {
 constructor(@Inject(DirectRequestRepository) private readonly repository:DirectRequestRepository,@Inject(UnitOfWork) private readonly work:UnitOfWork){}
 private async available<T>(action:()=>Promise<T>):Promise<T>{
  try {if(!await this.repository.ready())fail(503,'COLLECTION_UNAVAILABLE');return await action();}
  catch(error){
   if(error instanceof ApiError)throw error;
   if(error instanceof Error&&error.message==='REQUEST_RETRY_NOT_ALLOWED')fail(409,'REQUEST_RETRY_NOT_ALLOWED');
   fail(503,'COLLECTION_UNAVAILABLE');
  }
 }
 private async record(id:string):Promise<DirectRecord>{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))fail(400,'VALIDATION_FAILED');
  const value=await this.repository.request(id);if(!value)fail(404,'COLLECTION_REQUEST_NOT_FOUND');return value;
 }
 get(id:string){return this.available(async()=>(await this.record(id)).data);}
 runtime(){return this.available(async()=>({items:(await this.repository.sources()).map(source=>source.data)}));}
 create(url:string,actor:string,key:string){return this.submit(actor,key,createHash('sha256').update(JSON.stringify({url})).digest(),url,null);}
 retry(id:string,version:number,actor:string,key:string){
  return this.submit(actor,key,createHash('sha256').update(JSON.stringify({expectedVersion:version,previousRequestId:id})).digest(),null,{id,version});
 }
 private source(url:string,sources:RuntimeIdentity[]){
  const host=/^https:\/\/([a-z0-9.-]+)(?:[/?]|$)/i.exec(url)?.[1]?.toLowerCase();
  if(!host||!url.startsWith('https://')||url.length>2048)fail(400,'VALIDATION_FAILED');
  const matched=sources.filter(source=>source.hosts.map(value=>value.toLowerCase()).includes(host));
  if(matched.length===0)fail(422,'SOURCE_UNSUPPORTED');if(matched.length!==1)fail(503,'COLLECTION_UNAVAILABLE');
  const source=matched[0];if(!source)fail(503,'COLLECTION_UNAVAILABLE');
  if(source.data.freshness==='CONFLICT')fail(503,'COLLECTION_UNAVAILABLE');
  if(!source.registeredEnabled||source.data.enabled===false)fail(409,'SOURCE_DISABLED');
  if(source.version!==1||(source.data.normalizationVersion!==null&&source.data.normalizationVersion!==1))fail(503,'COLLECTION_UNAVAILABLE');
  const parser=source.parser??Object.entries(directHosts).find(([,value])=>value===host)?.[0];
  if(!parser)fail(422,'SOURCE_UNSUPPORTED');
  return {source,identity:directIdentity(url,parser)};
 }
 private submit(actor:string,key:string,hash:Buffer,url:string|null,retry:{id:string;version:number}|null){
  if(!/^[\x21-\x7e]{1,200}$/.test(key))fail(400,'VALIDATION_FAILED');
  return this.available(()=>this.work.transaction(async()=>{
   await this.work.transactionLock('web-input-key:'+actor+':'+key);
   const replay=await this.repository.alias(actor,key);
   if(replay){if(!replay.hash.equals(hash))fail(409,'IDEMPOTENCY_CONFLICT');return (await this.record(replay.id)).data;}
   // Short global lock serializes alias rate limits and both active identity constraints; no external I/O.
   await this.work.transactionLock('web-input-accept',true);
   await this.repository.cleanup();await this.repository.rate(actor);
   let input=url;
   if(retry){
    const previous=await this.record(retry.id);
    if(previous.data.version!==retry.version)fail(409,'REQUEST_VERSION_CONFLICT');
    if(previous.data.state!=='FAILED'||!previous.data.retryable||!previous.retryUrl)fail(409,'REQUEST_RETRY_NOT_ALLOWED');
    input=previous.retryUrl;
   }
   if(input===null)fail(400,'VALIDATION_FAILED');
   const {source,identity}=this.source(input,await this.repository.sources());
   const canonicalHash=directIdentityHash('v1',identity.canonicalUrl),postHash=directIdentityHash('v1',source.data.sourceKey,identity.postKey);
   const duplicate=await this.repository.dedup(source.data.sourceKey,1,canonicalHash,postHash);
   if(duplicate&&retry)fail(409,'REQUEST_RETRY_NOT_ALLOWED');
   const active=await this.repository.active(source.data.sourceKey,1,canonicalHash,postHash);
   if(active.length>1)fail(409,'DEDUP_IDENTITY_CONFLICT');
   const id=active[0]??await this.repository.insert({actor,key,hash,source:source.data.sourceKey,url:identity.canonicalUrl,
    canonicalHash,postHash,version:1,previous:retry?.id??null,duplicate});
   await this.repository.saveAlias(actor,key,hash,id);
   return (await this.record(id)).data;
  }));
 }
}
