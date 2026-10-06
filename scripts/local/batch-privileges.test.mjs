// Disposable database on the fixed local cluster; no source HTTP or existing DB writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {migrationContext} from '../../apps/api/dist/commands/migrate.js';
import {MigrationsService} from '../../apps/api/dist/commands/migrations.service.js';
import {grantLocalBatchPrivileges} from './batch-privileges.mjs';

test('local batch privileges permit current intake and quota, deny Core/review writes', async()=>{
  const name='blariyo_local_grants_'+randomBytes(6).toString('hex');
  const settings={host:'127.0.0.1',port:5439,user:'blariyo_local',database:'blariyo_local'};
  const config=JSON.parse(await readFile('.local-data/development/batch-config.json'));
  assert.equal(config.batchRole,'blariyo_batch_local');
  const admin=new pg.Client(settings);await admin.connect();
  let owner,batch,created=false;
  try{
    await admin.query(`CREATE DATABASE ${name}`);created=true;
    const migration=await migrationContext(`postgresql://blariyo_local@127.0.0.1:5439/${name}`);
    try{await migration.get(MigrationsService).migrate();}finally{await migration.close();}
    const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin','java'):'java';
    const child=spawn(java,['-Dloader.main=com.blariyo.collector.ops.MigrationMain','-cp',resolve('apps/collector/build/libs/blariyo-collector-0.1.0.jar'),'org.springframework.boot.loader.launch.PropertiesLauncher'],{stdio:'ignore',env:{...process.env,COLLECTOR_DB_URL:`jdbc:postgresql://127.0.0.1:5439/${name}`,COLLECTOR_DB_USER:'blariyo_local',COLLECTOR_DB_PASSWORD:''}});
    assert.equal(await new Promise((ok,no)=>{child.once('error',no);child.once('exit',ok);}),0);
    owner=new pg.Client({...settings,database:name});await owner.connect();
    for(let i=0;i<2;i++)await grantLocalBatchPrivileges(owner,config.batchRole);
    batch=new pg.Client({...settings,database:name,user:config.batchRole,password:config.batchPassword});await batch.connect();
    assert.equal((await owner.query('SELECT max(version) AS version FROM collector.schema_migration')).rows[0].version,'V015');
    await batch.query('BEGIN');
    const first=(await batch.query("SELECT * FROM collect.reserve_batch_request('local_grant_test',2,10000)")).rows[0];
    assert.equal(first.used,1);assert.equal(Number(first.wait_ms),0);
    const next=(await batch.query("SELECT * FROM collect.reserve_batch_request('local_grant_test',2,10000)")).rows[0];
    assert.equal(next.used,1);assert.ok(Number(next.wait_ms)>0);
    await batch.query('ROLLBACK');
    await batch.query("SELECT collect.defer_batch_request('cooldown_fixture',3600000)");
    await batch.query("SELECT collect.defer_batch_request('cooldown_fixture',1000)");
    const deferred=(await batch.query("SELECT * FROM collect.reserve_batch_request('cooldown_fixture',5000,15000)")).rows[0];
    assert.ok(Number(deferred.wait_ms)>3590000);assert.equal(deferred.used,0);
    await batch.query("SELECT collect.defer_batch_request('cooldown_overflow',9223372036854775807)");
    assert.equal((await owner.query("SELECT next_allowed_at::text AS deadline FROM collect.batch_request_budget WHERE source_key='cooldown_overflow'")).rows[0].deadline,'infinity');

    await assert.rejects(batch.query("UPDATE collect.batch_request_budget SET next_allowed_at=now()"),e=>e.code==='42501');
    for(const code of ['ROBOTS_UNVERIFIED','ROBOTS_DISALLOWED','SOURCE_RATE_LIMITED','SOURCE_HTTP_UNAVAILABLE','SOURCE_DNS_FAILED','SOURCE_ACCESS_BLOCKED'])
      assert.equal((await owner.query('SELECT collect.image_failure_code($1) AS discard',[code])).rows[0].discard,false);
    assert.equal((await owner.query("SELECT collect.image_failure_code('SOURCE_NOT_IMAGE') AS discard")).rows[0].discard,true);

    assert.deepEqual((await batch.query('SELECT * FROM collect.claim_web_requests(1)')).rows,[]);
    await batch.query('SELECT * FROM collect.batch_runtime_projection');
    await batch.query('UPDATE collect.batch_input_receipt SET updated_at=updated_at WHERE false');
    for(const sql of ['UPDATE content.board_post SET title=title WHERE false','UPDATE collect.batch_review SET lock_version=lock_version WHERE false','SELECT * FROM collect.batch_media_correction','DELETE FROM collect.batch_item WHERE false']){
      await assert.rejects(batch.query(sql),e=>e.code==='42501');
    }
  }finally{
    await batch?.end();await owner?.end();
    if(created)await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
});
