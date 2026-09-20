'use strict';
const fs = require('node:fs');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const keyPattern = /^db\/daily\/\d{8}T\d{6}Z-[a-f0-9]{12}\.dump\.age(?:\.json)?$/;
function eligibleForPrune(key,lastModified,cutoff,currentKey){
 return keyPattern.test(key) && Number.isFinite(lastModified.getTime()) && lastModified.getTime()<cutoff && key!==currentKey && key!==currentKey+'.json';
}
async function main(){
const sdk = createRequire('/app/package.json')('@aws-sdk/client-s3');
const cfg = JSON.parse(fs.readFileSync('/run/backup/r2.json','utf8'));
const client = new sdk.S3Client({region:'auto',endpoint:cfg.endpoint,credentials:{accessKeyId:cfg.accessKeyId,secretAccessKey:cfg.secretAccessKey}});
const send = c => client.send(c,{abortSignal:AbortSignal.timeout(180000)});

 const m=JSON.parse(fs.readFileSync('/run/spool/manifest.json','utf8'));
 if(cfg.bucket!=='blariyo-backup'||!keyPattern.test(m.key)||m.bytes<1)throw Error('INPUT');
 const hash=createHash('sha256');for await(const b of fs.createReadStream('/run/spool/archive.age'))hash.update(b);
 if(hash.digest('hex')!==m.sha256||fs.statSync('/run/spool/archive.age').size!==m.bytes)throw Error('LOCAL_HASH');
 await send(new sdk.PutObjectCommand({Bucket:cfg.bucket,Key:m.key,Body:fs.createReadStream('/run/spool/archive.age'),ContentLength:m.bytes,ContentType:'application/octet-stream',IfNoneMatch:'*'}));
 const got=await send(new sdk.GetObjectCommand({Bucket:cfg.bucket,Key:m.key}));
 const remote=createHash('sha256');let bytes=0;for await(const b of got.Body){remote.update(b);bytes+=b.length;}
 if(remote.digest('hex')!==m.sha256||bytes!==m.bytes)throw Error('REMOTE_HASH');
 await send(new sdk.PutObjectCommand({Bucket:cfg.bucket,Key:m.key+'.json',Body:JSON.stringify(m)+'\n',ContentType:'application/json',IfNoneMatch:'*'}));
 // Prune only this job's exact archive/manifest namespace, after verified upload.
 const cutoff=Date.now()-7*86400000;let cursor;let removed=0;
 do{
  const page=await send(new sdk.ListObjectsV2Command({Bucket:cfg.bucket,Prefix:'db/daily/',ContinuationToken:cursor}));
  for(const o of page.Contents||[]){if(eligibleForPrune(o.Key,o.LastModified,cutoff,m.key)){
   await send(new sdk.DeleteObjectCommand({Bucket:cfg.bucket,Key:o.Key}));removed++;
  }}cursor=page.IsTruncated?page.NextContinuationToken:undefined;
 }while(cursor);
 console.log('BACKUP_REMOTE_HASH_OK retainedDays=7 pruned='+removed);
 client.destroy();
}
module.exports={eligibleForPrune};
if(require.main===module)main().catch(()=>{console.error('BACKUP_R2_FAILED');process.exitCode=1;});
