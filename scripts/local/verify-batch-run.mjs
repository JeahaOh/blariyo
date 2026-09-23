import {decodeCollectedFrames} from '../../apps/api/dist/features/images/collected-animation.js';
// Readback only: fixed local DB + persistent collect objects. Does not fetch external sites.
import pg from 'pg';
import sharp from 'sharp';
import {readFile,realpath,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
const runId=process.argv[2];
if(process.argv.length!==3||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(runId||''))throw Error('EXPECTED_RUN_UUID');
const root=await realpath('.local-data/collector-objects');
async function object(key){
  if(!/^collect\/(raw|media|report)\//.test(key))throw Error('INVALID_COLLECT_KEY');
  const path=await realpath(resolve(root,key));if(!path.startsWith(root+sep))throw Error('INVALID_COLLECT_PATH');
  return readFile(path);
}
const c=new pg.Client({connectionString:'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local'});
await c.connect();
const report={at:new Date().toISOString(),runId,source:null,state:null,items:[],media:[],reportMatches:false};
try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const run=(await c.query('SELECT * FROM collect.batch_run WHERE id=$1',[runId])).rows[0];
  if(!run||!run.finished_at||!run.report_object_key)throw Error('RUN_NOT_FINISHED');
  report.source=run.source_key;report.state=run.state;
  const reportBytes=await object(run.report_object_key);
  const summary=JSON.parse(reportBytes.toString('utf8'));
  const ledger=(await c.query("SELECT object_key,encode(sha256,'hex') AS hash,jsonl_count FROM collect.batch_report WHERE run_id=$1",[runId])).rows[0];
  const checkpoint=(await c.query('SELECT * FROM collect.batch_checkpoint WHERE run_id=$1',[runId])).rows[0];
  report.ledgerRequired=run.owner_backend_pid!=null;
  report.ledgerMatches=Boolean(ledger&&checkpoint&&ledger.object_key===run.report_object_key&&
    ledger.hash===createHash('sha256').update(reportBytes).digest('hex')&&Number(ledger.jsonl_count)===reportBytes.toString('utf8').trim().split('\n').length&&
    JSON.stringify(checkpoint.state)===JSON.stringify(run.checkpoint)&&checkpoint.item_count===run.checkpoint.items&&checkpoint.page_number===(run.checkpoint.pages??0));
  const failures=(await c.query('SELECT phase,code,detail FROM collect.batch_failure WHERE run_id=$1 ORDER BY occurred_at,id',[runId])).rows;
  report.failures=failures;
  report.failureCountMatches=failures.length===summary.failures;
  report.reportMatches=summary.runId===runId&&summary.source===run.source_key&&summary.state===run.state&&summary.fetched===run.checkpoint.fetched;
  const items=(await c.query('SELECT id,state,canonical_url,raw_object_key,body_blocks,sns_links,failure_code,skip_reason FROM collect.batch_item WHERE run_id=$1',[runId])).rows;
  for(const item of items){
    const raw=item.raw_object_key?await object(item.raw_object_key):Buffer.alloc(0);
    report.items.push({id:item.id,state:item.state,url:item.canonical_url,blocks:item.body_blocks?.length??0,sns:item.sns_links?.length??0,rawBytes:raw.length,rawSha256:createHash('sha256').update(raw).digest('hex'),failureCode:item.failure_code,skipReason:item.skip_reason,pass:item.state==='FETCHED'?raw.length>0&&item.body_blocks?.length>0:item.state==='SKIPPED_POLICY'?['SOURCE_DATE_UNKNOWN','SOURCE_OUTSIDE_WINDOW'].includes(item.skip_reason):['FAILED','BLOCKED'].includes(item.state)&&Boolean(item.failure_code)});
    const media=(await c.query("SELECT id,kind,position,object_key,encode(sha256,'hex') AS hash,byte_size,mime_type FROM collect.batch_media WHERE item_id=$1 ORDER BY position",[item.id])).rows;
    for(const m of media){
      const bytes=await object(m.object_key);let decode=true,format,decoded,mime;
      if(m.kind==='IMAGE'){try{const meta=await sharp(bytes).metadata();format=meta.format;mime={jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'}[format];decoded=await decodeCollectedFrames(bytes,meta);decode=mime===m.mime_type;}catch{decode=false;}}
      report.media.push({id:m.id,itemId:item.id,position:m.position,kind:m.kind,bytes:bytes.length,format,decoded,pass:decode&&Number.isSafeInteger(Number(m.byte_size))&&bytes.length===Number(m.byte_size)&&createHash('sha256').update(bytes).digest('hex')===m.hash});
    }
  }
  await c.query('COMMIT');
  report.readbackPass=(!report.ledgerRequired||report.ledgerMatches)&&report.reportMatches&&report.failureCountMatches&&report.items.every(x=>x.pass)&&report.media.every(x=>x.pass)&&report.items.filter(x=>x.state==='FETCHED').length===summary.fetched;
  report.executionComplete=run.state==='COMPLETED'&&summary.failures===0;
  report.collectionComplete=report.readbackPass&&report.executionComplete&&summary.fetched>0&&(summary.skippedByDate??0)===0;
  await mkdir('.local-data/verification',{recursive:true,mode:0o700});
  await writeFile(`.local-data/verification/batch-run-${runId}.json`,JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify({runId,source:report.source,state:report.state,items:items.length,media:report.media.length,failures:failures.length,failureCountMatches:report.failureCountMatches,reportMatches:report.reportMatches,ledgerRequired:report.ledgerRequired,ledgerMatches:report.ledgerMatches,readbackPass:report.readbackPass,executionComplete:report.executionComplete,collectionComplete:report.collectionComplete}));
  if(!report.readbackPass)process.exitCode=1;
}finally{await c.end();}
