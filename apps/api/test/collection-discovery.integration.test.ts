import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createDataSource } from '../dist/persistence/database.js';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { createNestApplication } from '../dist/bootstrap/application.js';
import { CollectionOperationsService } from '../dist/features/collection/collection-operations.service.js';
import { requiredRow } from '../dist/persistence/rows.js';

const execute = promisify(execFile);
await test('Discovery: migration, shared quota, post-key dedup and Java parser -> Core -> DB readback', async (t) => {
  const database = process.env.TEST_NEST_DATABASE_URL;
  assert.ok(database);
  const migration = await migrationContext(database);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const db = await createDataSource(database).initialize();
  t.after(() => db.destroy());
  const bearer = randomBytes(32).toString('hex');
  const app = await createNestApplication({ databaseUrl: database, localMedia: true,
    serviceToken: randomBytes(32).toString('hex'), collectManualUrlEnabled: true, collectContractMode: 'SPRING_V2',
    collectorKeySecret: randomBytes(32).toString('hex'), collectorTokens: [{ collectorId: 'discovery-fixture',
      tokenSha256: createHash('sha256').update(bearer).digest('hex'), contractVersion: 'SPRING_V2', scopes: ['collector:run','collector:read'] }] });
  t.after(() => app.close());
  await app.get(CollectionOperationsService).applyTransition();
  await app.listen(0,'127.0.0.1');
  const origin = await app.getUrl();
  async function post(path: string, body: unknown, key: string = randomUUID()) {
    const response = await fetch(origin + '/internal/collect' + path, { method:'POST',
      headers:{authorization:'Bearer '+bearer,'content-type':'application/json','idempotency-key':key}, body:JSON.stringify(body) });
    const value: unknown = await response.json();
    assert.ok(typeof value === 'object' && value !== null);
    return { status: response.status, value: Object.fromEntries(Object.entries(value)) };
  }
  function data(response: Awaited<ReturnType<typeof post>>, status: number) {
    assert.equal(response.status,status,JSON.stringify(response.value));
    const value: unknown = response.value.data;
    assert.ok(typeof value==='object' && value!==null);
    return Object.fromEntries(Object.entries(value)) as Record<string, unknown>;
  }
  const root = resolve(import.meta.dirname, '../../..');
  const captures = [
    ['arcalive','arca.live','https://arca.live/b/live/183667641','https://arca.live/b/live'],
    ['bobaedream','www.bobaedream.co.kr','https://www.bobaedream.co.kr/view?code=best&No=1033744','https://www.bobaedream.co.kr/list?code=best'],
    ['dogdrip','www.dogdrip.net','https://www.dogdrip.net/dogdrip/725820115','https://www.dogdrip.net/dogdrip?sort_index=popular'],
    ['inven','www.inven.co.kr','https://www.inven.co.kr/board/webzine/2097/2730613','https://www.inven.co.kr/best/issue'],
  ];
  const live = process.env.COLLECTION_LIVE_CAPTURE_DIR;
  for (const capture of captures) {
    const [site, host, url, list] = capture;
    assert.ok(site && host && url && list);
    await t.test(site + (live ? ': captured public HTML readback' : ': redacted fixture readback'),async () => {
      const source = requiredRow(await db.query(
        `INSERT INTO collect.source(name,base_url,host,is_active,robots_allowed,robots_checked_at,request_interval_ms,daily_fetch_limit,created_by,updated_by)
         VALUES($1,$2,$3,true,true,now(),1000,100,'system:migration','system:migration') RETURNING id`,[site,'https://'+host,host]));
      const reservePath = `/sources/${String(source.id)}/request-reservations`;
      const reservation = {collectorId:'discovery-fixture',jobRequestId:randomUUID(),collectorExecutionId:randomUUID(),requestKey:randomUUID(),requestKind:'LIST',discovery:true};
      assert.equal((await post(reservePath,reservation)).status,403);
      await db.query("INSERT INTO collect.source_discovery_policy VALUES($1,true,$2,now(),'isolated-test-only')",[source.id,list]);
      const key=randomUUID(), permit=data(await post(reservePath,reservation,key),201);
      assert.equal(data(await post(reservePath,reservation,key),201).reservationId,permit.reservationId);
      assert.equal((await post(reservePath,{...reservation,requestKey:randomUUID()})).status,429);
      assert.equal((await post(reservePath,{...reservation,requestKind:'DETAIL'})).status,400);
      const created=data(await post('/candidates',{collectorId:'discovery-fixture',originUrl:url,discoveryMode:'LIST_CRAWL'}),202);
      const execution = randomUUID();
      const claimed=data(await post('/candidates/claim',{collectorId:'discovery-fixture',collectorExecutionId:execution,
        jobRequestId:randomUUID(),mode:'COLLECT',candidateId:created.candidateId,maxItems:1,leaseSeconds:180}),200);
      assert.ok(Array.isArray(claimed.items));
      const item: unknown=claimed.items[0];assert.ok(typeof item==='object' && item!==null);
      const claim=Object.fromEntries(Object.entries(item)) as Record<string, unknown>;
      const javaHome=process.env.JAVA_HOME;assert.ok(javaHome);
      const fixturePath=resolve(live ?? resolve(root,'apps/collector/src/test/resources/sites'),site+'.detail.html');
      const cp=(await readFile(resolve(root,'apps/collector/build/fixture-classpath.txt'),'utf8')).trim();
      const parsed=await execute(resolve(javaHome,'bin/java'),['-cp',cp,'com.blariyo.collector.source.FixtureParserMain',site,fixturePath,url],{maxBuffer:2*1024*1024});
      const result: unknown=JSON.parse(parsed.stdout);assert.ok(typeof result==='object' && result!==null);
      const fields=Object.fromEntries(Object.entries(result));
      // This test bridges direct parser fixtures into the legacy candidate contract.
      // That contract cannot persist attachments: fail instead of silently losing any.
      const { attachmentCandidates, ...legacyFields } = fields;
      assert.deepEqual(attachmentCandidates, [], 'Legacy fixture readback requires no attachments');
      const payload={...legacyFields,collectorId:'discovery-fixture',collectorExecutionId:execution,lockVersion:claim.lockVersion};
      const resultKey=randomUUID();
      data(await post(`/candidates/${String(created.candidateId)}/result`,payload,resultKey),200);
      data(await post(`/candidates/${String(created.candidateId)}/result`,payload,resultKey),200);
      const stored=requiredRow(await db.query('SELECT status,discovery_mode,source_post_key,content_blocks,result_payload_sha256,origin_url FROM collect.candidate WHERE id=$1',[created.candidateId]));
      assert.equal(stored.status,'NEW');assert.equal(stored.discovery_mode,'LIST_CRAWL');
      assert.ok(stored.source_post_key);assert.deepEqual(stored.content_blocks,fields.contentBlocks);
      assert.ok(Buffer.isBuffer(stored.result_payload_sha256));
      assert.equal(stored.origin_url,fields.canonicalUrl);
      const count=requiredRow(await db.query('SELECT count(*) FROM collect.candidate_image WHERE candidate_id=$1',[created.candidateId]));
      assert.ok(Array.isArray(fields.imageCandidates));assert.equal(Number(count.count),fields.imageCandidates.length);
      // Different URL hash, same server-computed post key must still be rejected.
      assert.equal((await post('/candidates',{collectorId:'discovery-fixture',originUrl:url+(url.includes('?')?'&':'?')+'page=2',discoveryMode:'LIST_CRAWL'})).status,409);
      t.diagnostic(JSON.stringify({source:site,capturedPublicHtml:Boolean(live),status:stored.status,bodyReadback:true,imageReferences:fields.imageCandidates.length,
        binaryDownloaded:false,discordGateway:false,batchGateway:false}));
    });
  }
  const rollback = async () => {
    const context = await migrationContext(database);
    try { await context.get(MigrationsService).migrate('down'); }
    finally { await context.close(); }
  };
  const latestVersion = async () => requiredRow(await db.query(
    'SELECT version FROM ops.schema_migration ORDER BY version DESC LIMIT 1'
  )).version;
  // V008 owns the empty batch-review tables and is reversible in this fixture.
  // Only the subsequent V007 rollback must refuse to discard discovery records.
  assert.equal(await latestVersion(), 'V008');
  await rollback();
  assert.equal(await latestVersion(), 'V007');
  const candidatesBefore: unknown = await db.query(
    'SELECT id, discovery_mode, source_post_key, content_blocks FROM collect.candidate ORDER BY id'
  );
  await assert.rejects(rollback, { code: '23514' });
  assert.equal(await latestVersion(), 'V007');
  assert.equal(requiredRow(await db.query("SELECT ops.is_schema_ready('V007') ready")).ready,true);
  assert.deepEqual(await db.query(
    'SELECT id, discovery_mode, source_post_key, content_blocks FROM collect.candidate ORDER BY id'
  ), candidatesBefore);
});
