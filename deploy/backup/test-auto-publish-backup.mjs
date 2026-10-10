// Real selective pg_dump/pg_restore in disposable local databases; no production connection.
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { migrationContext } from '../../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../../apps/api/dist/commands/migrations.service.js';
import { classifyCollect } from './selective-profile.mjs';

const base = new URL(process.env.TEST_DATABASE_ADMIN_URL ?? '');
assert.equal(base.hostname,'127.0.0.1');assert.equal(base.port,'5439');assert.equal(base.pathname,'/postgres');
assert.equal(base.username,'blariyo_local');
const container='blariyo-m0-core-local-postgresql-1';
function command(args,input) {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',container,...args],{stdio:['pipe','pipe','pipe']});
    const bytes=[];child.stdout.on('data',b=>bytes.push(b));child.stderr.resume();
    child.once('error',reject);child.once('close',code=>code===0?resolve(Buffer.concat(bytes)):reject(Error('BACKUP_FIXTURE_COMMAND_FAILED')));
    child.stdin.on('error',reject);child.stdin.end(input);
  });
}
const admin=new pg.Client({connectionString:base.href});await admin.connect();
const prefix='auto_backup_'+randomBytes(6).toString('hex'),names=[prefix+'_source',prefix+'_restore'];
const created=[],clients=[];
try {
  for(const name of names){await admin.query('CREATE DATABASE '+name);created.push(name);}
  const connection=name=>{const url=new URL(base);url.pathname='/'+name;return url.href;};
  const migration=await migrationContext(connection(names[0]));
  try {await migration.get(MigrationsService).migrate();}finally {await migration.close();}
  const source=new pg.Client({connectionString:connection(names[0])});await source.connect();clients.push(source);
  await source.query(await readFile('apps/collector/src/main/resources/db/collector-v002.sql','utf8'));
  const lifecycle=await readFile('apps/collector/src/main/resources/db/collector-v004.sql','utf8');
  await source.query(lifecycle.slice(0,lifecycle.indexOf('CREATE OR REPLACE FUNCTION')));
  await source.query(await readFile('apps/collector/src/main/resources/db/collector-v007.sql','utf8'));
  const item=randomUUID(),run=randomUUID();
  await source.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('theqoo','example.invalid','fixture')");
  await source.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'theqoo','hot','WRITE_DB','COMPLETED',1,1,10000)",[run]);
  await source.query(`INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks)
    VALUES($1,$2,'theqoo','fixture','https://example.invalid/fixture',sha256('fixture'::bytea),'FETCHED','RAW_MUST_NOT_RESTORE','[{"type":"TEXT","text":"RAW_MUST_NOT_RESTORE"}]')`,[item,run]);
  await source.query(`INSERT INTO collect.batch_auto_publish_classification(item_id,item_version,policy_version,content_digest,title_key,rule_version,decision,reason)
    VALUES($1,0,1,sha256('digest'::bytea),collect.auto_publish_title_key('검수할 생활 글'),'life-humor-v1','REVIEW','UNCERTAIN_TOPIC')`,[item]);
  await source.query("INSERT INTO collect.auto_publish_keyword_revision(revision,rule_version,keywords,updated_by) SELECT 2,'life-humor-v1-k2',jsonb_set(keywords,'{0,enabled}','false'::jsonb),'fixture:keyword-change' FROM collect.auto_publish_keyword_revision WHERE revision=1");
  await source.query("UPDATE collect.auto_publish_keyword_head SET rule_version='life-humor-v1-k2' WHERE singleton");
  const keywordBefore=(await source.query('SELECT * FROM collect.auto_publish_keyword_revision ORDER BY revision')).rows;
  assert.equal(keywordBefore.length,2);
  const headBefore=(await source.query('SELECT * FROM collect.auto_publish_keyword_head')).rows;
  const before=(await source.query('SELECT * FROM collect.batch_auto_publish_classification')).rows;
  const tables=(await source.query("SELECT schemaname||'.'||tablename AS name FROM pg_tables WHERE schemaname='collect' ORDER BY tablename")).rows.map(r=>r.name);
  const excluded=classifyCollect(tables);assert.ok(!excluded.includes('collect.batch_auto_publish_classification'));
  const dump=await command(['pg_dump','-U','blariyo_local','-d',names[0],'-Fc','--no-owner','--no-acl',...excluded.map(t=>'--exclude-table-data='+t)]);
  await command(['pg_restore','-U','blariyo_local','-d',names[1],'--exit-on-error','--no-owner','--no-acl'],dump);
  const restored=new pg.Client({connectionString:connection(names[1])});await restored.connect();clients.push(restored);
  assert.deepEqual((await restored.query('SELECT * FROM collect.auto_publish_keyword_revision ORDER BY revision')).rows,keywordBefore);
  assert.deepEqual((await restored.query('SELECT * FROM collect.auto_publish_keyword_head')).rows,headBefore);
  assert.deepEqual((await restored.query('SELECT * FROM collect.batch_auto_publish_classification')).rows,before);
  assert.equal((await restored.query('SELECT count(*) FROM collect.batch_item')).rows[0].count,'0');
  assert.equal((await restored.query("SELECT collect.auto_publish_title_key('ＡＢＣ １２３!')=collect.auto_publish_title_key('abc123') AS same")).rows[0].same,true);
  assert.equal((await restored.query("SELECT to_regclass('content.ix_board_post_auto_title') IS NOT NULL AS present")).rows[0].present,true);
  assert.equal((await restored.query("SELECT ops.is_schema_ready('V017') AS ready")).rows[0].ready,true);
  console.log('PASS selective classification metadata/keyword history/current head/function/index/ledger restore; original rows excluded');
} finally {
  for(const client of clients)await client.end();
  for(const name of created.reverse())await admin.query('DROP DATABASE '+name+' WITH (FORCE)');
  await admin.end();
}
