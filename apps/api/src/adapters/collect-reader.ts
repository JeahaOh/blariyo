import {open, realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
import {CollectReader} from '../shared/collect-reader.js';

function validate(key:string,maxBytes:number) {
  if (!/^collect\/media\/[A-Za-z0-9._/-]+$/.test(key) || key.split('/').some(p=>!p || p==='.' || p==='..') ||
    !Number.isSafeInteger(maxBytes) || maxBytes<1 || maxBytes>100*1024*1024) throw Error('COLLECT_OBJECT_INVALID');
}
export class LocalCollectReader extends CollectReader {
  constructor(private readonly root:string){super();}
  async read(key:string,maxBytes:number){
    validate(key,maxBytes);
    const base=await realpath(this.root),target=await realpath(resolve(base,key));
    if(!target.startsWith(base+sep))throw Error('COLLECT_OBJECT_INVALID');
    const file=await open(target,'r');
    try{
      const stat=await file.stat();
      if(!stat.isFile()||stat.size>maxBytes)throw Error('COLLECT_OBJECT_TOO_LARGE');
      const bytes=Buffer.alloc(stat.size);let offset=0;
      while(offset<bytes.length){const part=await file.read(bytes,offset,bytes.length-offset,offset);if(!part.bytesRead)throw Error('COLLECT_OBJECT_TRUNCATED');offset+=part.bytesRead;}
      return bytes;
    }finally{await file.close();}
  }
}
export class S3CollectReader extends CollectReader {
  private readonly client:S3Client;
  constructor(private readonly bucket:string,endpoint:string,accessKeyId:string,secretAccessKey:string){
    super();
    const target=new URL(endpoint);
    if(target.username||target.password||target.search||target.hash||
      (target.protocol!=='https:'&&!(target.protocol==='http:'&&['127.0.0.1','localhost'].includes(target.hostname)))||
      !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))throw Error('COLLECT_READER_INVALID');
    this.client=new S3Client({endpoint,region:'auto',forcePathStyle:true,credentials:{accessKeyId,secretAccessKey},maxAttempts:2});
  }
  onApplicationShutdown(){this.client.destroy();}
  async read(key:string,maxBytes:number){
    validate(key,maxBytes);
    const object=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)});
    if(!object.Body)throw Error('COLLECT_OBJECT_MISSING');
    // SDK body streaming with an enforced bound, independent of an untrusted Content-Length.
    const stream=object.Body.transformToWebStream(),reader=stream.getReader();
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;const chunk:unknown=part.value;if(!(chunk instanceof Uint8Array))throw Error('COLLECT_OBJECT_INVALID');size+=chunk.byteLength;if(size>maxBytes)throw Error('COLLECT_OBJECT_TOO_LARGE');chunks.push(chunk);}}
    finally{await reader.cancel();}
    return Buffer.concat(chunks);
  }
}
export class DisabledCollectReader extends CollectReader {
  async read():Promise<Buffer>{throw Error('COLLECT_READER_NOT_CONFIGURED');}
}
export function collectReader(env:Readonly<Record<string,string|undefined>>):CollectReader {
  if(env.COLLECT_BATCH_REVIEW_ENABLED!=='true')return new DisabledCollectReader();
  if(env.COLLECT_READER_DIRECTORY){
    if(env.NODE_ENV==='production')throw Error('COLLECT_LOCAL_READER_FORBIDDEN');
    return new LocalCollectReader(env.COLLECT_READER_DIRECTORY);
  }
  const endpoint=env.COLLECT_READER_S3_ENDPOINT,bucket=env.COLLECT_READER_S3_BUCKET;
  const access=env.COLLECT_READER_S3_ACCESS_KEY_ID,secret=env.COLLECT_READER_S3_SECRET_ACCESS_KEY;
  if(!endpoint||!bucket||!access||!secret)throw Error('COLLECT_READER_REQUIRED');
  if(env.NODE_ENV==='production'&&!endpoint.startsWith('https://'))throw Error('COLLECT_READER_HTTPS_REQUIRED');
  return new S3CollectReader(bucket,endpoint,access,secret);
}
