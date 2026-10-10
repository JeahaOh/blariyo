import { Inject,Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { schemaValidator } from '@blariyo/contracts';
import { DirectRequestRepository,type DirectInsert,type DirectRequest,type RuntimeIdentity,type RuntimeSource } from '../features/collection/direct-request.repository.js';
import { DatabaseContext } from './database.js';
import { requiredRow,rows } from './rows.js';
import { ApiError,fail } from '../shared/errors.js';

const directSchema=schemaValidator({$ref:'#/components/schemas/DirectCollectionRequest'});
const runtimeSchema=schemaValidator({$ref:'#/components/schemas/DirectRuntimeSource'});
function isDirect(value:unknown):value is DirectRequest{return directSchema(value);}
function isRuntime(value:unknown):value is RuntimeSource{return runtimeSchema(value);}
function instant(value:unknown):string {if(!(value instanceof Date))throw Error('INVALID_DATABASE_TIME');return value.toISOString();}
function text(value:unknown):string|null{return typeof value==='string'?value:null;}
function bytes(value:unknown):Buffer {if(!Buffer.isBuffer(value)||value.length!==32)throw Error('INVALID_DATABASE_HASH');return value;}

@Injectable()
export class TypeOrmDirectRequestRepository extends DirectRequestRepository {
 constructor(@Inject(DatabaseContext) private readonly db:DatabaseContext){super();}
 async ready(){
  const row=requiredRow(await this.db.manager.query("SELECT ((((((ops.is_schema_ready('V017') OR ops.is_schema_ready('V016')) OR ops.is_schema_ready('V015') OR ops.is_schema_ready('V014')) OR ops.is_schema_ready('V013')) OR ops.is_schema_ready('V012')) OR ops.is_schema_ready('V011')) OR ops.is_schema_ready('V010')) AND to_regclass('collect.batch_input_projection') IS NOT NULL AND to_regclass('collect.batch_runtime_projection') IS NOT NULL AS ready"));
  return row.ready===true;
 }
 async sources():Promise<RuntimeIdentity[]> {
  return rows(await this.db.manager.query('SELECT * FROM collect.batch_runtime_projection ORDER BY source_key')).map(row=>{
   const effective=row.effective_policy===null?null:requiredRow([row.effective_policy]);
   const data={sourceKey:row.source_key,configVersion:row.config_version,loadedAt:row.loaded_at===null?null:instant(row.loaded_at),
    observedAt:row.heartbeat_at===null?null:instant(row.heartbeat_at),freshness:row.freshness,
    enabled:effective?.enabled??null,blockedReason:effective?.blockedReason??null,collectionPolicy:effective?.collectionPolicy??null,
    allowedHosts:effective?.allowedHosts??null,requestIntervalMs:effective?.requestIntervalMs??null,dailyRequestLimit:effective?.dailyRequestLimit??null,
    maxPages:effective?.maxPages??null,maxItems:effective?.maxItems??null,mediaLimits:effective?.mediaLimits??null,normalizationVersion:row.normalization_version};
   if(!isRuntime(data))throw Error('INVALID_RUNTIME_PROJECTION');
   const hosts=row.identity_hosts;if(!Array.isArray(hosts)||!hosts.every((host:unknown)=>typeof host==='string'))throw Error('INVALID_IDENTITY_HOSTS');
   return {data,hosts,parser:text(row.identity_parser),registeredEnabled:row.registered_enabled===true,version:Number(row.registered_normalization_version)};
  });
 }
 async request(id:string){
  const row=rows(await this.db.manager.query(`SELECT w.*,b.state AS receipt_state,b.item_id,b.error_code,b.retryable,b.version,b.updated_at,
    COALESCE(s.freshness,'ABSENT') AS freshness,w.accept_before<=clock_timestamp() AS expired,
    CASE WHEN b.state='FAILED' AND b.retryable AND i.state='FAILED' AND l.retention_state='LIVE' AND l.expires_at>clock_timestamp()
      THEN i.canonical_url END AS retry_url
    FROM collect.web_collection_request w LEFT JOIN collect.batch_input_projection b ON b.request_id=w.id
    LEFT JOIN collect.batch_runtime_projection s ON s.source_key=w.source_key LEFT JOIN collect.batch_item i ON i.id=b.item_id
    LEFT JOIN collect.batch_retention l ON l.item_id=b.item_id
    WHERE w.id=$1 AND (b.item_id IS NULL OR l.item_id IS NULL OR l.expires_at>clock_timestamp())`,[id]))[0];
  if(!row)return null;
  const receipt=typeof row.receipt_state==='string';
  // A stopped batch cannot write a terminal receipt. Project only a waiting request's
  // own deadline; never infer a running job's success or failure from elapsed time.
  const expired=row.expired===true&&(receipt?row.receipt_state==='ACCEPTED':row.state==='PENDING');
  const state=expired?'EXPIRED':receipt?row.receipt_state:row.state;
  const data={requestId:row.id,previousRequestId:row.previous_request_id,sourceKey:row.source_key,state,
   requestedAt:instant(row.requested_at),acceptBefore:instant(row.accept_before),
   updatedAt:instant(expired||row.state==='EXPIRED'?row.accept_before:receipt?row.updated_at:row.requested_at),
   version:receipt?Number(row.version)+(expired?1:0):state==='PENDING'?0:1,itemId:row.item_id??null,errorCode:expired&&receipt?'BATCH_QUEUE_EXPIRED':row.error_code??null,
   retryable:row.retryable===true&&typeof row.retry_url==='string',configFreshness:row.freshness};
  if(!isDirect(data))throw Error('INVALID_REQUEST_PROJECTION');
  return {data,canonicalHash:bytes(row.canonical_hash),postHash:bytes(row.post_key_hash),normalizationVersion:Number(row.normalization_version),retryUrl:text(row.retry_url)};
 }
 async alias(actor:string,key:string){
  const row=rows(await this.db.manager.query(`SELECT request_id AS id,request_hash FROM collect.web_collection_request_key WHERE actor=$1 AND idempotency_key=$2 AND expires_at>clock_timestamp()
    UNION ALL SELECT id,request_hash FROM collect.web_collection_request WHERE actor=$1 AND idempotency_key=$2 LIMIT 1`,[actor,key]))[0];
  return row?{id:String(row.id),hash:bytes(row.request_hash)}:null;
 }
 async saveAlias(actor:string,key:string,hash:Buffer,id:string){
  await this.db.manager.query(`INSERT INTO collect.web_collection_request_key(actor,idempotency_key,request_hash,request_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(actor,idempotency_key) DO UPDATE SET request_hash=EXCLUDED.request_hash,request_id=EXCLUDED.request_id,expires_at=EXCLUDED.expires_at
    WHERE web_collection_request_key.expires_at<=clock_timestamp()`,[actor,key,hash,id]);
 }
 async active(source:string,version:number,canonicalHash:Buffer,postHash:Buffer){
  return rows(await this.db.manager.query(`SELECT id,source_key FROM collect.web_collection_request WHERE closed_at IS NULL
   AND normalization_version=$2 AND (canonical_hash=$3 OR (source_key=$1 AND post_key_hash=$4))`,[source,version,canonicalHash,postHash])).map(row=>{
    if(row.source_key!==source)fail(409,'DEDUP_IDENTITY_CONFLICT');return String(row.id);
   });
 }
 async dedup(source:string,version:number,canonicalHash:Buffer,postHash:Buffer){
  const matches=rows(await this.db.manager.query(`SELECT id,source_key FROM collect.batch_dedup_key WHERE normalization_version=$2
   AND (canonical_hash=$3 OR (source_key=$1 AND post_key_hash=$4))`,[source,version,canonicalHash,postHash]));
  if(matches.length>1||matches.some(row=>row.source_key!==source))fail(409,'DEDUP_IDENTITY_CONFLICT');
  return matches.length===1;
 }
 async insert(value:DirectInsert){
  const id=randomUUID();
  await this.db.manager.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_url,
   canonical_hash,post_key_hash,normalization_version,previous_request_id,state,requested_at,accept_before,closed_at)
   SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,at,at+interval '24 hours',CASE WHEN $12 THEN at END
   FROM (SELECT clock_timestamp()::timestamptz(3) at) time`,[id,value.actor,value.key,value.hash,value.source,
    value.duplicate?null:value.url,value.canonicalHash,value.postHash,value.version,value.previous,value.duplicate?'DUPLICATE':'PENDING',value.duplicate]);
  return id;
 }
 async rate(actor:string){
  const row=requiredRow(await this.db.manager.query(`SELECT count(*) FILTER(WHERE actor=$1) AS own,count(*) AS total,
   GREATEST(1,ceil(extract(epoch FROM min(expires_at)-interval '23 hours 59 minutes'-clock_timestamp()))) AS retry
   FROM collect.web_collection_request_key WHERE expires_at>clock_timestamp()+interval '23 hours 59 minutes'`,[actor]));
  if(Number(row.own)>=10||Number(row.total)>=60)throw new ApiError(429,'RATE_LIMITED',undefined,Number(row.retry)||60);
 }
 async cleanup(){await this.db.manager.query('SELECT collect.cleanup_web_requests()');}
}
