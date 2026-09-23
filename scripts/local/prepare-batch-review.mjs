// Explicit, fixed-local migration and least-privilege setup. Startup itself never migrates.
import pg from 'pg';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,open,readdir,stat,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {migrationContext} from '../../apps/api/dist/commands/migrate.js';
import {MigrationsService} from '../../apps/api/dist/commands/migrations.service.js';
const args=process.argv.slice(2);
if(!args.includes('--apply')||args.some(a=>a!=='--apply'&&!a.startsWith('--import-root=')))throw Error('EXPECTED_APPLY_OPTIONAL_IMPORT_ROOT');
const target='postgresql://blariyo_local@127.0.0.1:5439/blariyo_local';
const directory=resolve('.local-data/development'),objectRoot=resolve('.local-data/collector-objects');
const configPath=join(directory,'batch-config.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function copyTree(source,destination){
  await mkdir(destination,{recursive:true,mode:0o700});
  for(const entry of await readdir(source,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw Error('SYMLINK_IMPORT_REJECTED');
    const from=join(source,entry.name),to=join(destination,entry.name);
    if(entry.isDirectory())await copyTree(from,to);
    else if(entry.isFile()){
      const bytes=await readFile(from);
      try{await writeFile(to,bytes,{flag:'wx',mode:0o600});}
      catch(error){if(error.code!=='EEXIST'||hash(await readFile(to))!==hash(bytes))throw Error('OBJECT_COPY_CONFLICT');}
    }else throw Error('UNSUPPORTED_IMPORT_OBJECT');
  }
}
async function processDone(command,args,output){
  const child=spawn(command,args,{stdio:['ignore',output,'pipe']});child.stderr.resume();
  await new Promise((ok,no)=>{child.on('error',()=>no(Error('BACKUP_START_FAILED')));child.on('exit',code=>code===0?ok():no(Error('BACKUP_FAILED')));});
}
async function denied(client,sql){
  await client.query('BEGIN');
  try{await client.query(sql);throw Error('ROLE_SCOPE_BROKEN');}
  catch(error){if(error.code!=='42501')throw error;}
  finally{await client.query('ROLLBACK');}
}
await mkdir(directory,{recursive:true,mode:0o700});
await mkdir('.local-data/backups',{recursive:true,mode:0o700});
const backup=resolve('.local-data/backups',`before-batch-review-${Date.now()}.dump`),file=await open(backup,'wx',0o600);
try{await processDone('docker',['exec','blariyo-m0-core-local-postgresql-1','pg_dump','-U','blariyo_local','-d','blariyo_local','-Fc'],file.fd);}finally{await file.close();}
if((await stat(backup)).size<1000)throw Error('EMPTY_BACKUP');
const importArgument=args.find(a=>a.startsWith('--import-root='));
if(importArgument){const root=await realpath(importArgument.slice('--import-root='.length));for(const prefix of ['raw','media','report']){
  try{await copyTree(join(root,'collect',prefix),join(objectRoot,'collect',prefix));}catch(error){if(error.code!=='ENOENT')throw error;}
}}
await mkdir(objectRoot,{recursive:true,mode:0o700});
let config;
try{config=JSON.parse(await readFile(configPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(!config){config={version:1,objectRoot,apiRole:'blariyo_api_local',batchRole:'blariyo_batch_local',apiPassword:randomBytes(32).toString('hex'),batchPassword:randomBytes(32).toString('hex')};await writeFile(configPath,JSON.stringify(config),{flag:'wx',mode:0o600});}
if(config.version!==1||config.apiRole!=='blariyo_api_local'||config.batchRole!=='blariyo_batch_local'||config.objectRoot!==objectRoot||
  !/^[a-f0-9]{64}$/.test(config.apiPassword)||!/^[a-f0-9]{64}$/.test(config.batchPassword))throw Error('LOCAL_CONFIG_INVALID');
const admin=new pg.Client({connectionString:target});await admin.connect();
try{
  await admin.query('BEGIN');
  for(const [role,password] of [[config.apiRole,config.apiPassword],[config.batchRole,config.batchPassword]]){
    const found=(await admin.query("SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1",[role])).rows[0];
    if(found){if(found.marker!=='blariyo-local-batch-review-v1')throw Error('EXISTING_ROLE_NOT_OWNED');}
    else{await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);await admin.query(`COMMENT ON ROLE ${role} IS 'blariyo-local-batch-review-v1'`);}
  }
  await admin.query('COMMIT');
  const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
  const collector=spawn(java,['-Dloader.main=com.blariyo.collector.ops.MigrationMain','-cp',resolve('apps/collector/build/libs/blariyo-collector-0.1.0.jar'),
    'org.springframework.boot.loader.launch.PropertiesLauncher'],{stdio:['ignore','ignore','pipe'],env:{...process.env,
      COLLECTOR_DB_URL:'jdbc:postgresql://127.0.0.1:5439/blariyo_local',COLLECTOR_DB_USER:'blariyo_local',COLLECTOR_DB_PASSWORD:''}});
  collector.stderr.resume();
  const collectorCode=await new Promise((ok,no)=>{collector.once('error',()=>no(Error('COLLECTOR_MIGRATION_START_FAILED')));collector.once('exit',ok);});
  if(collectorCode!==0)throw Error('COLLECTOR_MIGRATION_FAILED');
  const migration=await migrationContext(target);
  try{await migration.get(MigrationsService).migrate();await migration.get(MigrationsService).grantApplication(config.apiRole);}
  finally{await migration.close();}
  await admin.query(`GRANT CONNECT ON DATABASE blariyo_local TO ${config.apiRole},${config.batchRole};GRANT USAGE ON SCHEMA collect TO ${config.batchRole};
    REVOKE ALL ON ALL TABLES IN SCHEMA collect FROM ${config.batchRole};
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA collect FROM PUBLIC,${config.batchRole};
    GRANT SELECT,INSERT,UPDATE ON collect.batch_source,collect.batch_run,collect.batch_item,collect.batch_media,collect.batch_failure,collect.batch_report,collect.batch_checkpoint,collect.batch_queue,collect.batch_confirmation TO ${config.batchRole};
    GRANT DELETE ON collect.batch_media TO ${config.batchRole};
    GRANT EXECUTE ON FUNCTION collect.assert_source_owner(text),collect.assert_run_owner(uuid) TO ${config.batchRole};`);
  const files=(await admin.query("SELECT object_key,encode(sha256,'hex') AS hash,byte_size FROM collect.batch_media WHERE object_key IS NOT NULL")).rows;
  for(const f of files){
    if(!/^collect\/media\/[a-zA-Z0-9._/-]+$/.test(f.object_key)||f.object_key.split('/').includes('..'))throw Error('BAD_OBJECT_KEY');
    const bytes=await readFile(join(objectRoot,f.object_key));
    if(hash(bytes)!==f.hash||bytes.length!==Number(f.byte_size))throw Error('COLLECT_OBJECT_READBACK_FAILED');
  }
  for(const [role,password] of [[config.apiRole,config.apiPassword],[config.batchRole,config.batchPassword]]){
    const client=new pg.Client({host:'127.0.0.1',port:5439,database:'blariyo_local',user:role,password});await client.connect();
    try{
      const row=(await client.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.ok(Object.values(row).every(v=>v===false));
      await client.query('SELECT count(*) FROM collect.batch_item');
      await denied(client,'SELECT * FROM collect.batch_media_correction');
      assert.equal((await client.query("SELECT has_function_privilege(current_user,'collect.correct_batch_media_mime(uuid,uuid,text,text,bytea,bigint,bigint,bigint,text)','EXECUTE') AS ok")).rows[0].ok,false);
      if(role===config.apiRole){await denied(client,'SELECT * FROM collect.batch_confirmation');await denied(client,'SELECT * FROM collect.batch_queue');await denied(client,'UPDATE collect.batch_item SET version=version WHERE false');await client.query('UPDATE collect.batch_review SET lock_version=lock_version WHERE false');}
      else{await denied(client,'UPDATE content.board_post SET title=title WHERE false');await denied(client,'UPDATE collect.batch_review SET lock_version=lock_version WHERE false');await client.query('UPDATE collect.batch_item SET version=version WHERE false');}
    }finally{await client.end();}
  }
  console.log(JSON.stringify({migration:'API V008 / Collector V006',roles:'api-read-batch / batch-write-own-only',objectsVerified:files.length,backup:backup.replace(resolve('.')+'/',''),configuration:'.local-data/development/batch-config.json'}));
}catch(error){await admin.query('ROLLBACK');console.error(typeof error.code==='string'?error.code:'LOCAL_PREPARE_FAILED');process.exitCode=1;}
finally{await admin.end();}
