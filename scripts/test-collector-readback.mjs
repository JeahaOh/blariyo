// Disposable DB only. The persistent blariyo_local database is never a test target.
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const name=`blariyo_collector_test_${randomBytes(8).toString('hex')}`;
const admin=new pg.Client({connectionString:'postgresql://blariyo_local@127.0.0.1:5439/postgres'});
let created=false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  created=true;
  const command=resolve(root,'apps/collector',process.platform==='win32'?'gradlew.bat':'gradlew');
  const result=await new Promise((ok,no)=>{
    const child=spawn(command,['-p','apps/collector','test','--rerun-tasks','--no-daemon'],{
      cwd:root,stdio:'inherit',shell:process.platform==='win32',
      env:{...process.env,COLLECTOR_READBACK_DATABASE_URL:`jdbc:postgresql://127.0.0.1:5439/${name}`,
        COLLECTOR_READBACK_DATABASE_USER:'blariyo_local',COLLECTOR_READBACK_DATABASE_PASSWORD:''}
    });
    child.once('error',()=>no(Error('COLLECTOR_TEST_START_FAILED')));
    child.once('exit',code=>ok(code===0?0:1));
  });
  process.exitCode=result;
} catch(error) {
  // Do not echo connection strings or database-driver errors.
  console.error(error?.message==='COLLECTOR_TEST_START_FAILED'?'COLLECTOR_TEST_START_FAILED':'COLLECTOR_TEST_FAILED');
  process.exitCode=1;
} finally {
  if(created) {
    try {await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);}
    catch {console.error(`COLLECTOR_TEST_CLEANUP_REQUIRED ${name}`);process.exitCode=1;}
  }
  await admin.end();
}
