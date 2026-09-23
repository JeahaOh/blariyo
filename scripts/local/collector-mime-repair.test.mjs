// Isolated PostgreSQL database only; never reset the persistent development database.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

test('V006 owner maintenance preserves finished snapshots and runtime boundaries', async t=>{
  const database='blariyo_mime_test_'+randomUUID().replaceAll('-','');
  const config={host:'127.0.0.1',port:5439,user:'blariyo_local',database:'blariyo_local'};
  const admin=new pg.Client(config);await admin.connect();
  const role='mime_runtime_'+randomUUID().replaceAll('-','');
  let db,other;
  const item=randomUUID(),media=randomUUID(),run=randomUUID(),operation=randomUUID(),hash=Buffer.alloc(32,7);
  const signature='collect.correct_batch_media_mime(uuid,uuid,text,text,bytea,bigint,bigint,bigint,text)';
  const invoke='SELECT collect.correct_batch_media_mime($1,$2,$3,$4,$5,$6,$7,$8,$9) AS revision';
  const args=[operation,media,'image/png','image/jpeg',hash,512,2,0,'IMAGE_BYTES_VERIFIED'];
  try{
    await admin.query(`CREATE DATABASE ${database}`);
    db=new pg.Client({...config,database});other=new pg.Client({...config,database});await db.connect();await other.connect();
    await db.query('CREATE SCHEMA collect');
    await db.query(await readFile('apps/collector/src/main/resources/db/collector-v002.sql','utf8'));
    await db.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('fixture','fixture.invalid','test')");
    await db.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms,finished_at) VALUES($1,'fixture','test','WRITE_DB','COMPLETED',1,1,10000,now())",[run]);
    await db.query("INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,raw_object_key,fetched_at,version) VALUES($1,$2,'fixture','1','https://fixture.invalid/1',$3,'FETCHED','fixture','[{\"type\":\"IMAGE\",\"imagePosition\":1}]','collect/raw/test.html',now(),2)",[item,run,hash]);
    await db.query("INSERT INTO collect.batch_media(id,item_id,position,kind,sha256,mime_type,byte_size,object_key) VALUES($1,$2,1,'IMAGE',$3,'image/png',512,$4)",[media,item,hash,`collect/media/${item}/1`]);
    for(const version of ['003','004','005','006']){await db.query('BEGIN');await db.query(await readFile(`apps/collector/src/main/resources/db/collector-v${version}.sql`,'utf8'));await db.query('COMMIT');}
    const original=(await db.query('SELECT to_jsonb(i) AS row FROM collect.batch_item i WHERE id=$1',[item])).rows[0].row;
    const mediaBefore=(await db.query('SELECT to_jsonb(m) AS row FROM collect.batch_media m WHERE id=$1',[media])).rows[0].row;
    await t.test('migration does not silently repair existing metadata',async()=>{
      assert.equal((await db.query('SELECT mime_type FROM collect.batch_media WHERE id=$1',[media])).rows[0].mime_type,'image/png');
      assert.equal((await db.query('SELECT count(*)::int n FROM collect.batch_media_correction')).rows[0].n,0);
    });
    await t.test('wrong hash, size, item version, revision and no-op fail without audit writes',async()=>{
      for(const [index,value] of [[4,Buffer.alloc(32,8)],[5,513],[6,3],[7,1]]){
        const bad=[...args];bad[index]=value;await assert.rejects(db.query(invoke,bad),{code:'40001'});
      }
      const bad=[...args];bad[3]='image/png';await assert.rejects(db.query(invoke,bad),{code:'22023'});
      assert.equal((await db.query('SELECT count(*)::int n FROM collect.batch_media_correction')).rows[0].n,0);
    });
    await t.test('correction waits for the same review lock used by the API',async()=>{
      await other.query('SELECT pg_advisory_lock(hashtextextended($1,0))',['batch-review:'+item]);
      try{await db.query("SET lock_timeout='150ms'");await assert.rejects(db.query(invoke,args),{code:'55P03'});}
      finally{await db.query("SET lock_timeout='0'");await other.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['batch-review:'+item]);}
    });
    await t.test('active source execution blocks maintenance even when the owner holds the lock',async()=>{
      await db.query('BEGIN');
      try{
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended('collector-source:fixture',0))");
        await db.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'fixture','test','WRITE_DB','RUNNING',1,1,10000)",[randomUUID()]);
        await assert.rejects(db.query(invoke,args),{code:'40001'});
      }finally{await db.query('ROLLBACK');}
    });
    await t.test('correction rolls back atomically with its ledger',async()=>{
      await db.query('BEGIN');await db.query(invoke,args);await db.query('ROLLBACK');
      assert.equal((await db.query('SELECT mime_type FROM collect.batch_media WHERE id=$1',[media])).rows[0].mime_type,'image/png');
      assert.equal((await db.query('SELECT count(*)::int n FROM collect.batch_media_correction')).rows[0].n,0);
    });
    await t.test('concurrent same-key requests apply once and preserve all other fields',async()=>{
      const results=await Promise.all([db.query(invoke,args),other.query(invoke,args)]);
      assert.deepEqual(results.map(r=>Number(r.rows[0].revision)),[1,1]);
      assert.equal((await db.query('SELECT count(*)::int n FROM collect.batch_media_correction')).rows[0].n,1);
      const after=(await db.query('SELECT to_jsonb(m) AS row FROM collect.batch_media m WHERE id=$1',[media])).rows[0].row;
      assert.deepEqual(after,{...mediaBefore,mime_type:'image/jpeg'});
      assert.deepEqual((await db.query('SELECT to_jsonb(i) AS row FROM collect.batch_item i WHERE id=$1',[item])).rows[0].row,original);
    });
    await t.test('same operation with changed payload and stale fresh operations fail',async()=>{
      const bad=[...args];bad[3]='image/webp';await assert.rejects(db.query(invoke,bad),{code:'23505'});
      const stale=[...args];stale[0]=randomUUID();await assert.rejects(db.query(invoke,stale),{code:'40001'});
    });
    await t.test('direct MIME edits and ledger update/delete remain forbidden',async()=>{
      await assert.rejects(db.query("UPDATE collect.batch_media SET mime_type='image/png' WHERE id=$1",[media]),{code:'55000'});
      await assert.rejects(db.query('UPDATE collect.batch_media_correction SET revision=9'),{code:'55000'});
      await assert.rejects(db.query('DELETE FROM collect.batch_media_correction'),{code:'55000'});
      await assert.rejects(db.query('TRUNCATE collect.batch_media_correction'),{code:'55000'});
    });
    await t.test('runtime cannot read/write the audit or execute correction, even if mistakenly granted execute',async()=>{
      await admin.query(`CREATE ROLE ${role} NOLOGIN`);
      await db.query(`GRANT USAGE ON SCHEMA collect TO ${role}; GRANT SELECT,UPDATE ON collect.batch_media TO ${role}`);
      await db.query(`SET ROLE ${role}`);
      try{
        assert.equal((await db.query('SELECT has_function_privilege(current_user,$1,\'EXECUTE\') ok',[signature])).rows[0].ok,false);
        await assert.rejects(db.query(invoke,args),{code:'42501'});
        await assert.rejects(db.query('SELECT * FROM collect.batch_media_correction'),{code:'42501'});
        await assert.rejects(db.query("UPDATE collect.batch_media SET mime_type='image/png' WHERE id=$1",[media]),{code:'55000'});
      }finally{await db.query('RESET ROLE');}
      await db.query(`GRANT EXECUTE ON FUNCTION ${signature} TO ${role}`);await db.query(`SET ROLE ${role}`);
      try{await assert.rejects(db.query(invoke,args),{code:'42501'});}finally{await db.query('RESET ROLE');}
    });
    await t.test('explicit reverse correction adds history and prevents the ABA stale revision',async()=>{
      const undo=[randomUUID(),media,'image/jpeg','image/png',hash,512,2,1,'ROLLBACK_VERIFIED_MIME'];
      assert.equal(Number((await db.query(invoke,undo)).rows[0].revision),2);
      const stale=[...args];stale[0]=randomUUID();await assert.rejects(db.query(invoke,stale),{code:'40001'});
      assert.equal((await db.query('SELECT count(*)::int n FROM collect.batch_media_correction')).rows[0].n,2);
    });
  }finally{
    if(db)await db.end();if(other)await other.end();
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.end();
  }
});
