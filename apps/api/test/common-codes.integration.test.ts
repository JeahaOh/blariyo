import { TypeOrmHealthRepository } from '../dist/persistence/health.repository.js';
import { TypeOrmMigrationsRepository } from '../dist/persistence/migrations.repository.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createDataSource, DatabaseContext, TypeOrmUnitOfWork } from '../dist/persistence/database.js';
import { contractSuccess } from './contract-response.js';
class BeforeGroupsRepository extends TypeOrmMigrationsRepository {
  override async scripts() { return (await super.scripts()).filter(script => script.version <= 'V012'); }
}
await test('common groups migrate source identities and enforce group boundaries, permissions and concurrency', async t => {
  const databaseUrl=process.env.TEST_NEST_DATABASE_URL; assert.ok(databaseUrl);
  const db=await createDataSource(databaseUrl).initialize(); t.after(()=>db.destroy());
  const context=new DatabaseContext(db);
  await new MigrationsService(new BeforeGroupsRepository(context),new TypeOrmUnitOfWork(context)).migrate();
  const migration=await migrationContext(databaseUrl); t.after(()=>migration.close());
  const migrator=migration.get(MigrationsService);
  const token=randomBytes(32).toString('hex'),actor='admin:v1:'+randomBytes(32).toString('base64url');
  const app=await createNestApplication({databaseUrl,serviceToken:token}); t.after(()=>app.close());
  await app.listen(0,'127.0.0.1'); const origin=await app.getUrl();
  const base='/api/v1/admin/common-code-groups';
  const request=(path='',method='GET',body?:unknown,role='OWNER')=>fetch(origin+base+path,{
    method,headers:{'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':role,'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  await t.test('unmapped legacy sources stop migration without loss; names, versions and audit survive mapping',async()=>{
    assert.equal((await fetch(origin+'/internal/health/ready')).status,503);
    await db.query("UPDATE content.source_code SET display_name='더쿠 수정 보존',lock_version=lock_version+1,updated_by=$1,updated_at=clock_timestamp() WHERE source_key='theqoo'",[actor]);
    await db.query("INSERT INTO content.source_code(source_key,display_name,created_by,updated_by) VALUES('unmapped','별도출처',$1,$1)",[actor]);
    const before:unknown=await db.query('SELECT * FROM content.source_code ORDER BY source_key');
    await assert.rejects(migrator.migrate(),/COMMON_CODES_UNMAPPED_SOURCE_KEY/);
    assert.deepEqual(await db.query('SELECT * FROM content.source_code ORDER BY source_key'),before);
    await db.query("DELETE FROM content.source_code WHERE source_key='unmapped'");
    const original:unknown=await db.query("SELECT display_name,lock_version,created_by,created_at,updated_by,updated_at FROM content.source_code WHERE source_key='theqoo'");
    await migrator.migrate();
    assert.equal((await fetch(origin+'/internal/health/ready')).status,200);
    assert.deepEqual(await db.query("SELECT display_name,lock_version,created_by,created_at,updated_by,updated_at FROM content.common_code WHERE group_key='source' AND code='thqo'"),original);
    await migrator.migrate('down'); // Empty V014 is reversible; V013 still requires a handoff.
    const ledger:unknown=await db.query('SELECT * FROM ops.schema_migration ORDER BY version');
    await assert.rejects(migrator.migrate('down'),/COMMON_CODES_ROLLBACK_REQUIRES_HANDOFF/);
    assert.deepEqual(await db.query('SELECT * FROM ops.schema_migration ORDER BY version'),ledger);
    await migrator.migrate();
  });
  await t.test('readiness requires every group and code privilege',async()=>{
    const health=new TypeOrmHealthRepository(context),repo=new TypeOrmMigrationsRepository(context);
    await context.connection(async runner=>{
      await runner.startTransaction();
      try {
        const role='codes_test_'+randomBytes(6).toString('hex'); await runner.query(`CREATE ROLE ${role} NOLOGIN`); await repo.grantApplication(role);
        for(const table of ['common_code_group','common_code']){
          await runner.query(`SET LOCAL ROLE ${role}`);assert.equal(await health.commonCodesReady(),true);await runner.query('RESET ROLE');
          await runner.query(`REVOKE UPDATE ON content.${table} FROM ${role}`);await runner.query(`SET LOCAL ROLE ${role}`);assert.equal(await health.commonCodesReady(),false);await runner.query('RESET ROLE');
          await runner.query(`GRANT UPDATE ON content.${table} TO ${role}`);
        }
      } finally {await runner.rollbackTransaction();}
    });
  });
  await t.test('source group and exact requested short codes are readable; only OWNER mutates',async()=>{
    assert.equal((await fetch(origin+base)).status,401);
    const groups=(await contractSuccess('listCommonCodeGroups',await request())).data; assert.deepEqual(groups.items.map(g=>g.groupKey),['source']);assert.equal(groups.canManage,true);
    const response=await request('/source/codes');assert.equal(response.headers.get('cache-control'),'private, no-store');
    const list=(await contractSuccess('listCommonCodes',response)).data.items;assert.equal(list.length,21);
    for(const [reference,code] of Object.entries({theqoo:'thqo',ppomppu:'pmpu',yuldo:'yldo',inven:'invn',dogdrip:'dgdp',ruliweb:'rlwb'})) assert.equal(list.find(c=>c.referenceKey===reference)?.code,code);
    assert.ok(list.every(c=>c.groupKey==='source'&&/^[a-z][a-z0-9]{3}$/.test(c.code)));
    assert.equal((await contractSuccess('listCommonCodes',await request('/source/codes','GET',undefined,'EDITOR'))).data.canManage,false);
    for(const [path,method,body] of [
      ['', 'POST',{groupKey:'denied',displayName:'거부'}],['/source','PATCH',{displayName:'수정',lockVersion:1}],
      ['/source/codes','POST',{code:'test',displayName:'거부',referenceKey:'fixture'}],['/source/codes/thqo','PATCH',{displayName:'거부',lockVersion:2}],
    ] as const) assert.equal((await request(path,method,body,'EDITOR')).status,403);
  });
  await t.test('generic groups scope code uniqueness and source mapping remains immutable',async()=>{
    const group=(await contractSuccess('createCommonCodeGroup',await request('','POST',{groupKey:'sample',displayName:'샘플'}),'POST')).data;
    assert.equal(group.lockVersion,1);
    assert.equal((await request('','POST',{groupKey:'sample',displayName:'중복'})).status,409);
    const changed=(await contractSuccess('updateCommonCodeGroup',await request('/sample','PATCH',{displayName:'샘플 그룹',lockVersion:1}),'PATCH')).data;
    assert.equal(changed.lockVersion,2);
    assert.equal((await request('/sample','PATCH',{displayName:'충돌',lockVersion:1})).status,409);
    assert.equal((await request('/missing/codes')).status,404);
    assert.equal((await request('/sample/codes','POST',{code:'thqo',displayName:'다른 그룹',referenceKey:'theqoo'})).status,400);
    assert.equal((await request('/sample/codes','POST',{code:'thqo',displayName:'다른 그룹',referenceKey:null})).status,201);
    const sample=(await contractSuccess('listCommonCodes',await request('/sample/codes'))).data.items;assert.equal(sample.length,1);assert.equal(sample[0]?.displayName,'다른 그룹');
    for(const body of [{code:'long-code',displayName:'이름',referenceKey:'fixture'},{code:'Bad!',displayName:'이름',referenceKey:'fixture'},{code:'test',displayName:'  ',referenceKey:'fixture'},{code:'test',displayName:'이름',referenceKey:null}]) assert.equal((await request('/source/codes','POST',body)).status,400);
    const created=(await contractSuccess('createCommonCode',await request('/source/codes','POST',{code:'test',displayName:'검증 출처',referenceKey:'fixture'}),'POST')).data;
    assert.equal(created.lockVersion,1);assert.equal(created.referenceKey,'fixture');
    assert.equal((await request('/source/codes','POST',{code:'test',displayName:'중복 코드',referenceKey:'fixture-two'})).status,409);
    assert.equal((await request('/source/codes','POST',{code:'tstb',displayName:'중복 연결',referenceKey:'fixture'})).status,409);
    assert.equal((await request('/source/codes/test','PATCH',{displayName:'변경',lockVersion:1,referenceKey:'changed'})).status,400);
    for(const change of ["code='tstb'","reference_key='changed'","group_key='sample',reference_key=NULL"])
      await assert.rejects(db.query(`UPDATE content.common_code SET ${change},lock_version=lock_version+1 WHERE group_key='source' AND code='test'`),{code:'23514'});
    await assert.rejects(db.query("UPDATE content.common_code_group SET group_key='renamed',lock_version=lock_version+1 WHERE group_key='sample'"),{code:'23514'});
    assert.deepEqual(await db.query("SELECT created_by,updated_by FROM content.common_code WHERE group_key='source' AND code='test'"),[{created_by:actor,updated_by:actor}]);
  });
  await t.test('concurrent code edits produce one winner and a stale version conflict',async()=>{
    const responses=await Promise.all(['수정 A','수정 B'].map(displayName=>request('/source/codes/test','PATCH',{displayName,lockVersion:1})));
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const winner=responses.find(r=>r.status===200);assert.ok(winner);
    const saved=(await contractSuccess('updateCommonCode',winner,'PATCH')).data;assert.equal(saved.lockVersion,2);
    const list=(await contractSuccess('listCommonCodes',await request('/source/codes'))).data.items;assert.deepEqual(list.find(c=>c.code==='test'),saved);
    assert.equal((await request('/source/codes/test','PATCH',{displayName:'충돌',lockVersion:1})).status,409);
    assert.equal((await request('/source/codes/none','PATCH',{displayName:'없음',lockVersion:1})).status,404);
  });
  await t.test('maintenance permits reads and rejects both group and code mutations',async()=>{
    const maintenance=await createNestApplication({databaseUrl,serviceToken:token,maintenance:true});
    try {
      await maintenance.listen(0,'127.0.0.1');const url=await maintenance.getUrl();
      const headers={'X-Blariyo-Service-Token':token,'X-Blariyo-Admin-Actor':actor,'X-Blariyo-Admin-Role':'OWNER','Content-Type':'application/json'};
      assert.equal((await fetch(url+base,{headers})).status,200);
      assert.equal((await fetch(url+base,{method:'POST',headers,body:JSON.stringify({groupKey:'blocked',displayName:'유지보수'})})).status,503);
      assert.equal((await fetch(url+base+'/source/codes',{method:'POST',headers,body:JSON.stringify({code:'blck',displayName:'유지보수',referenceKey:'blocked'})})).status,503);
    }finally{await maintenance.close();}
  });
});
