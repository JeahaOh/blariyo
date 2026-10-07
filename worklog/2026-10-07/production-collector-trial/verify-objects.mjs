// Read-only GET checks; credentials are loaded from a private ignored input.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const dir=resolve('.local-data/production-collector-trial-20261007');
const config=JSON.parse(await readFile(dir+'/setup-input.json','utf8')).objectEnv;
const evidence=JSON.parse(await readFile(dir+'/evidence.json','utf8'));
const sdk=createRequire(resolve('apps/api/package.json'))('@aws-sdk/client-s3');
const client=new sdk.S3Client({region:'auto',endpoint:config.COLLECTOR_OBJECT_STORE_S3_ENDPOINT,credentials:{accessKeyId:config.COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID,secretAccessKey:config.COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY}});
const objects=[...evidence.readback.items.filter(i=>i.raw_object_key).map(i=>({key:i.raw_object_key,kind:'raw'})),...evidence.readback.media.map(m=>({key:m.object_key,kind:'media',sha256:m.sha256,bytes:Number(m.byte_size)})),{key:`collect/report/${evidence.readback.run.id}.jsonl`,kind:'report'}];
const results=[];
try {
 for(const o of objects){
  if(!o.key.startsWith('collect/'))throw Error('OBJECT_SCOPE');
  const got=await client.send(new sdk.GetObjectCommand({Bucket:config.COLLECTOR_OBJECT_STORE_S3_BUCKET,Key:o.key}),{abortSignal:AbortSignal.timeout(30000)});
  const hash=createHash('sha256');let bytes=0;
  for await(const b of got.Body){hash.update(b);bytes+=b.length;}
  const sha256=hash.digest('hex');
  if(!bytes || o.sha256 && (sha256!==o.sha256||bytes!==o.bytes))throw Error('OBJECT_HASH_MISMATCH');
  results.push({kind:o.kind,bytes,sha256,expectedHashMatched:!!o.sha256});
 }
 const report={state:'PASS',objects:results.length,raw:results.filter(r=>r.kind==='raw').length,media:results.filter(r=>r.kind==='media').length,totalBytes:results.reduce((a,r)=>a+r.bytes,0),results};
 await writeFile(dir+'/object-verification.json',JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify({...report,results:undefined}));
}finally{client.destroy();}
