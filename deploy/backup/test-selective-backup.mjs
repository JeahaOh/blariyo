// D03-T5/D01-T7: real pg_dump -> age -> independent decrypt/pg_restore, disposable resources only.
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { migrationContext } from '../../apps/api/dist/commands/migrate.js';
import { MigrationsService } from '../../apps/api/dist/commands/migrations.service.js';
import { createDataSource, DatabaseContext, TypeOrmUnitOfWork } from '../../apps/api/dist/persistence/database.js';
import { TypeOrmMigrationsRepository } from '../../apps/api/dist/persistence/migrations.repository.js';
import { DirectRequestService } from '../../apps/api/dist/features/collection/direct-request.service.js';
import { TypeOrmDirectRequestRepository } from '../../apps/api/dist/persistence/direct-request.repository.js';
import { encryptedSnapshot, fileDigest, snapshotMetadata } from './backup-dump.mjs';
import { restoreSnapshot } from './restore-snapshot.mjs';
import { replaceLegacySnapshot } from './legacy-replacement.mjs';

const execute = promisify(execFile);
const base = new URL(process.env.TEST_DATABASE_ADMIN_URL ?? '');
assert.equal(base.hostname, '127.0.0.1'); assert.equal(base.port, '55449'); assert.equal(base.pathname, '/postgres');
const container = process.env.TEST_BACKUP_POSTGRES_CONTAINER;
assert.equal(container, 'blariyo-m0-implementation-pg-20260927');
const inspection = await execute('docker', ['inspect', '--format', '{{index .Config.Labels "blariyo.task"}}', container]);
assert.equal(inspection.stdout.trim(), 'm0-implementation-20260927');
const age = process.env.TEST_AGE_BIN, keygen = process.env.TEST_AGE_KEYGEN_BIN, java = process.env.JAVA_HOME;
assert.ok(age && keygen && java, 'explicit age, age-keygen and Java25 binaries required');
const admin = new pg.Client({ connectionString: base.href }); await admin.connect();
const prefix = 'backup_' + randomBytes(6).toString('hex'), names = [prefix + '_source', prefix + '_restore', prefix + '_replacement', prefix + '_verification', prefix + '_legacy'];
const root = await mkdtemp('/private/tmp/blariyo-selective-backup-'), created = [];
let source, restored; const replacementClients = [];
function childFinished(child) { child.stderr.resume(); return new Promise((yes, no) => {
  child.once('error', no); child.once('close', status => status === 0 ? yes() : no(Error('FIXTURE_CHILD_FAILED')));
}); }
try {
  for (const name of names) { await admin.query('CREATE DATABASE ' + name); created.push(name); }
  const sourceUrl = new URL(base); sourceUrl.pathname = '/' + names[0];
  const restoreUrl = new URL(base); restoreUrl.pathname = '/' + names[1];
  const migration = await migrationContext(sourceUrl.href);
  try { await migration.get(MigrationsService).migrate(); } finally { await migration.close(); }
  const cp = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
  await execute(resolve(java, 'bin/java'), ['-cp', cp, 'com.blariyo.collector.ops.MigrationMain'], {
    env: { ...process.env, COLLECTOR_DB_URL: `jdbc:postgresql://127.0.0.1:55449/${names[0]}`, COLLECTOR_DB_USER: 'postgres', COLLECTOR_DB_PASSWORD: '' },
  });
  source = new pg.Client({ connectionString: sourceUrl.href }); await source.connect();
  const item = randomUUID(), run = randomUUID();
  await source.query("SELECT pg_advisory_lock(hashtextextended('collector-source:backup-fixture',0))");
  await source.query("INSERT INTO collect.batch_source(source_key,host,policy_version,enabled) VALUES('backup-fixture','arca.live','fixture',true)");
  await source.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'backup-fixture','manual','WRITE_DB','RUNNING',1,1,10000)", [run]);
  await source.query("INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state) VALUES($1,$2,'backup-fixture','999002233','https://arca.live/b/live/999002233',sha256('fixture'::bytea),'FETCHING')", [item, run]);
  await source.query("UPDATE collect.batch_item SET state='FETCHED',title='CANARY_RAW_MUST_NOT_RESTORE',body_blocks='[{\"type\":\"TEXT\",\"text\":\"CANARY_RAW_MUST_NOT_RESTORE\"}]',raw_object_key=$2,fetched_at=clock_timestamp(),version=version+1 WHERE id=$1", [item, `collect/raw/${run}/${item}.html`]);
  const post = (await source.query("INSERT INTO content.board_post(board_id,title,status,created_by,updated_by,created_at,updated_at) SELECT id,'CANARY_CONTENT_MUST_RESTORE','DRAFT','system:migration','system:migration',clock_timestamp(),clock_timestamp() FROM content.board WHERE slug='meme' RETURNING id")).rows[0].id;
  await source.query('INSERT INTO content.post_collection_origin(post_id,dedup_id) SELECT $1,dedup_id FROM collect.batch_retention WHERE item_id=$2', [post, item]);
  // D02 transient data must also disappear in an independent restore, not just empty tables.
  const request=randomUUID(),actor='admin:v1:'+Buffer.alloc(32,29).toString('base64url');
  await source.query(`INSERT INTO collect.web_collection_request(id,actor,idempotency_key,request_hash,source_key,canonical_url,
    canonical_hash,post_key_hash,normalization_version,requested_at,accept_before)
    SELECT $1::uuid,$2,'CANARY_MAILBOX',sha256('CANARY_MAILBOX'::bytea),'backup-fixture','https://example.invalid/CANARY_MAILBOX',
     sha256('CANARY_MAILBOX'::bytea),sha256('CANARY_MAILBOX_POST'::bytea),1,at,at+interval '24 hours'
    FROM (SELECT clock_timestamp()::timestamptz(3) at) time`,[request,actor]);
  await source.query("INSERT INTO collect.web_collection_request_key(actor,idempotency_key,request_hash,request_id) VALUES($1,'CANARY_ALIAS',sha256('CANARY_ALIAS'::bytea),$2)",[actor,request]);
  await source.query('BEGIN');
  try {
    const lease=(await source.query('SELECT * FROM collect.claim_web_requests(20)')).rows[0];
    await source.query("INSERT INTO collect.batch_input_receipt(request_id,state,error_code) VALUES($1,'BLOCKED','CANARY_RECEIPT')",[request]);
    await source.query('SELECT collect.ack_web_request($1,$2)',[request,lease.lease_token]);await source.query('COMMIT');
  } catch(error) {await source.query('ROLLBACK');throw error;}
  await source.query(`INSERT INTO collect.batch_source_runtime(instance_id,source_key,config_version,normalization_version,effective_policy)
    VALUES($1,'backup-fixture',$2,1,$3)`,[randomUUID(),'a'.repeat(64),{enabled:false,blockedReason:'CANARY_RUNTIME',
      collectionPolicy:'DETAIL_ONLY',allowedHosts:['example.invalid'],requestIntervalMs:10000,dailyRequestLimit:100,
      maxPages:1,maxItems:1,mediaLimits:{maxImages:200,maxFileBytes:31457280,maxTotalBytes:157286400}}]);
  const identity = resolve(root, 'identity.txt');
  await execute(keygen, ['-o', identity]);
  const recipient = (await execute(keygen, ['-y', identity])).stdout.trim();
  const spoolRoot = resolve(root, 'spool'); await mkdir(spoolRoot, { mode: 0o700 });
  const dump = args => spawn('docker', ['exec', '--user', 'postgres', container, 'pg_dump', '-U', 'postgres', '-d', names[0], ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  const options = { db: source, dump, ageExecutable: age, recipient, spoolRoot };
  await source.query('CREATE TABLE collect.unclassified_probe(id integer)');
  await assert.rejects(encryptedSnapshot({ ...options, dump: () => { throw Error('DUMP_MUST_NOT_START'); } }), /BACKUP_UNCLASSIFIED_COLLECT_TABLE/);
  assert.deepEqual(await readdir(spoolRoot), []);
  await source.query('DROP TABLE collect.unclassified_probe');
  await source.query("SELECT * FROM collect.reserve_batch_request('backup-budget',100,10000)");
  const backup = await encryptedSnapshot(options);
  assert.equal(backup.manifest.dumpProfileVersion, 'm0-direct-excluded-v1');
  assert.equal(Date.parse(backup.manifest.expiresAt) - Date.parse(backup.manifest.snapshotAt), 7 * 86400000);
  assert.deepEqual(await fileDigest(backup.archivePath), { sha256: backup.manifest.sha256, bytes: backup.manifest.bytes });
  assert.equal((await readFile(backup.archivePath)).includes(Buffer.from('CANARY_RAW_MUST_NOT_RESTORE')), false);
  restored = new pg.Client({ connectionString: restoreUrl.href }); await restored.connect();
  const restoreOptions = { db: restored, restore: args => spawn('docker', ['exec', '-i', '--user', 'postgres', container, 'pg_restore', '-U', 'postgres', '-d', names[1], ...args], { stdio: ['pipe', 'ignore', 'pipe'] }),
    archivePath: backup.archivePath, manifest: backup.manifest, ageExecutable: age, identityPath: identity, isolated: true };
  await assert.rejects(restoreSnapshot({ ...restoreOptions, isolated: false }), /BACKUP_ISOLATED_RESTORE_REQUIRED/);
  const receipt = await restoreSnapshot(restoreOptions);
  assert.equal(receipt.collectionResumeAllowed, false); assert.equal(receipt.retentionGate, 'CLOSED');
  assert.equal((await restored.query('SELECT reconcile_required FROM collector.restore_gate')).rows[0].reconcile_required,true);
  await assert.rejects(restored.query("SELECT * FROM collect.reserve_batch_request('restore-fixture',100,10000)"),/SOURCE_RESTORE_RECONCILE_REQUIRED/);
  await assert.rejects(restoreSnapshot(restoreOptions), /BACKUP_RESTORE_TARGET_REJECTED/);
  const metadata = await snapshotMetadata(restored);
  const expectedMetadata = structuredClone(backup.metadata);
  // Exactly the authorized post-restore gate row changes; every other table still matches.
  expectedMetadata.fingerprints['collector.restore_gate'] = (await restored.query(`
    SELECT count(*)::text AS count,encode(sha256(convert_to(to_jsonb(expected)::text,'UTF8')),'hex') AS sha256
    FROM (SELECT true AS singleton,true AS reconcile_required,
      ((clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date+1)::timestamp AT TIME ZONE 'Asia/Seoul' AS direct_resume_not_before) expected
    GROUP BY to_jsonb(expected)::text`)).rows[0];
  assert.deepEqual(metadata, expectedMetadata);
  assert.equal((await restored.query("SELECT request_count FROM collect.batch_request_budget WHERE source_key='backup-budget'")).rows[0].request_count,1);
  for (const table of backup.manifest.excludedTables) assert.equal((await restored.query('SELECT count(*) n FROM ' + table)).rows[0].n, '0', table);
  assert.equal((await restored.query('SELECT title FROM content.board_post WHERE id=$1', [post])).rows[0].title, 'CANARY_CONTENT_MUST_RESTORE');
  assert.equal((await restored.query("SELECT collect.lookup_dedup('backup-fixture','999002233','https://arca.live/b/live/999002233') id")).rows[0].id,
    (await restored.query('SELECT dedup_id FROM content.post_collection_origin WHERE post_id=$1', [post])).rows[0].dedup_id);
  // Exercise the real API use case after restoration: the same original creates no work.
  const duplicateDb=await createDataSource(restoreUrl.href).initialize();
  try {
    const context=new DatabaseContext(duplicateDb);
    const direct=new DirectRequestService(new TypeOrmDirectRequestRepository(context),new TypeOrmUnitOfWork(context));
    const duplicate=await direct.create('https://arca.live/b/live/999002233',actor,randomUUID());
    assert.equal(duplicate.state,'DUPLICATE');
    assert.equal((await duplicateDb.query('SELECT canonical_url FROM collect.web_collection_request WHERE id=$1',[duplicate.requestId]))[0].canonical_url,null);
    for(const table of ['batch_queue','batch_item','batch_input_receipt'])
      assert.equal((await duplicateDb.query('SELECT count(*) n FROM collect.'+table))[0].n,'0');
  } finally {await duplicateDb.destroy();}
  const before = await readdir(spoolRoot);
  await assert.rejects(encryptedSnapshot({ ...options, dump: () => spawn(process.execPath, ['-e', 'process.exit(2)'], { stdio: ['ignore', 'pipe', 'pipe'] }) }));
  assert.deepEqual(await readdir(spoolRoot), before);
  // A historical full snapshot must be independently restored, filtered, re-encrypted and restored again
  // before its original archive can be removed. Its initial snapshot/expiry never move forward.
  const legacyUrl = new URL(base); legacyUrl.pathname = '/' + names[4];
  const legacyDb = await createDataSource(legacyUrl.href).initialize();
  let legacyItem, legacyPost, oldApiLedger, oldCollectorLedger;
  try {
    const migrations = new TypeOrmMigrationsRepository(new DatabaseContext(legacyDb));
    await migrations.ensureLedger();
    for (const script of (await migrations.scripts()).filter(script => script.version <= 'V008')) {
      await migrations.apply(script.filename); await migrations.record(script, 0);
    }
    await execute(resolve(java, 'bin/java'), ['-cp', cp, 'com.blariyo.collector.ops.LegacySchemaFixtureMain', `jdbc:postgresql://127.0.0.1:55449/${names[4]}`]);
    oldApiLedger = await legacyDb.query('SELECT * FROM ops.schema_migration ORDER BY version');
    oldCollectorLedger = await legacyDb.query('SELECT * FROM collector.schema_migration ORDER BY version');
    assert.equal(oldApiLedger.length, 8); assert.equal(oldCollectorLedger.length, 6);
    assert.equal((await legacyDb.query("SELECT to_regclass('collect.batch_retention') AS table"))[0].table, null);
    const c = legacyDb.createQueryRunner(); await c.connect();
    try {
      legacyItem = randomUUID(); const legacyRun = randomUUID();
      await c.query("SELECT pg_advisory_lock(hashtextextended('collector-source:legacy-backup',0))");
      await c.query("INSERT INTO collect.batch_source(source_key,host,policy_version) VALUES('legacy-backup','example.invalid','legacy')");
      await c.query("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES($1,'legacy-backup','manual','WRITE_DB','RUNNING',1,1,10000)", [legacyRun]);
      await c.query("INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state) VALUES($1,$2,'legacy-backup','legacy','https://example.invalid/LEGACY_RAW_CANARY',sha256('legacy'::bytea),'FETCHING')", [legacyItem, legacyRun]);
      await c.query(`UPDATE collect.batch_item SET state='FETCHED',title='LEGACY_RAW_CANARY',body_blocks='[{"type":"TEXT","text":"LEGACY_RAW_CANARY"}]',raw_object_key=$2,fetched_at=clock_timestamp(),version=version+1 WHERE id=$1`, [legacyItem, `collect/raw/${legacyRun}/${legacyItem}.html`]);
      legacyPost = (await c.query("INSERT INTO content.board_post(board_id,title,status,created_by,updated_by,created_at,updated_at) SELECT id,'LEGACY_CONTENT_CANARY','DRAFT','system:migration','system:migration',clock_timestamp(),clock_timestamp() FROM content.board WHERE slug='meme' RETURNING id"))[0].id;
      await c.query(`INSERT INTO collect.batch_review(item_id,item_version,content_digest,source_key,source_post_key,canonical_url_hash,status,updated_by)
        SELECT id,version,sha256('legacy'::bytea),source_key,source_post_key,canonical_url_hash,'REVIEWING',$2 FROM collect.batch_item WHERE id=$1`, [legacyItem, actor]);
      await c.query("UPDATE collect.batch_review SET status='APPROVED',post_id=$2,lock_version=lock_version+1 WHERE item_id=$1", [legacyItem, legacyPost]);
      await c.query(`UPDATE collect.batch_run SET state='FAILED',checkpoint='{"reason":"BATCH_OWNER_LOST"}',finished_at=clock_timestamp(),version=version+1 WHERE id=$1`, [legacyRun]);
    } finally { await c.query('SELECT pg_advisory_unlock_all()'); await c.release(); }
  } finally { await legacyDb.destroy(); }
  const fullPath = resolve(root, 'historical-full.age'), fullDump = spawn('docker', ['exec', '--user', 'postgres', container, 'pg_dump', '-U', 'postgres', '-d', names[4], '--format=custom', '--no-owner', '--no-acl'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const fullAge = spawn(age, ['--encrypt', '--recipient', recipient], { stdio: ['pipe', 'pipe', 'pipe'] });
  await Promise.all([childFinished(fullDump), childFinished(fullAge), pipeline(fullDump.stdout, fullAge.stdin),
    pipeline(fullAge.stdout, createWriteStream(fullPath, { flags: 'wx', mode: 0o600 }))]);
  const originalAt = new Date(Date.now() - 2 * 86400000).toISOString();
  const original = { format: 1, createdAt: originalAt, postgresMajor: 18, retentionDays: 7, ...await fileDigest(fullPath),
    key: 'db/daily/' + originalAt.replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z') + '-abcdef123456.dump.age' };
  for (const name of names.slice(2, 4)) { const url = new URL(base); url.pathname = '/' + name;
    const client = new pg.Client({ connectionString: url.href }); await client.connect(); replacementClients.push(client); }
  const restoreIn = name => args => spawn('docker', ['exec', '-i', '--user', 'postgres', container, 'pg_restore', '-U', 'postgres', '-d', name, ...args], { stdio: ['pipe', 'ignore', 'pipe'] });
  const independent = resolve(root, 'independent'); await mkdir(independent);
  const remote = resolve(root, 'synthetic-r2'); await mkdir(remote); let removed = false, uploadedManifest;
  const provider = {
    async upload(input) { uploadedManifest = structuredClone(input.manifest); await copyFile(input.archivePath, resolve(remote, 'archive.age'));
      await writeFile(resolve(remote, 'manifest.json'), JSON.stringify(input.manifest)); },
    async retrieve({ directory }) { const manifest = JSON.parse(await readFile(resolve(remote, 'manifest.json')));
      const archivePath = resolve(directory, 'restore.age'); await copyFile(resolve(remote, 'archive.age'), archivePath);
      assert.deepEqual(await fileDigest(archivePath), { sha256: manifest.sha256, bytes: manifest.bytes }); return { archivePath, manifest }; },
    async removeLegacy(old, receipt) { assert.equal(old.sha256, original.sha256); assert.equal(receipt.rawRestored, 0);
      assert.equal(receipt.fingerprintsMatched, true); assert.equal(receipt.snapshotAt, original.createdAt); removed = true; },
  };
  const replacement = await replaceLegacySnapshot({ original, archivePath: fullPath,
    source: { db: replacementClients[0], restore: restoreIn(names[2]), ageExecutable: age, identityPath: identity, isolated: true },
    verification: { db: replacementClients[1], restore: restoreIn(names[3]), ageExecutable: age, identityPath: identity, isolated: true },
    migrate: async () => {
      const restoredLegacy = replacementClients[0];
      assert.equal((await restoredLegacy.query("SELECT count(*) n FROM collect.batch_item WHERE title='LEGACY_RAW_CANARY'")).rows[0].n, '1');
      assert.deepEqual((await restoredLegacy.query('SELECT * FROM ops.schema_migration ORDER BY version')).rows, oldApiLedger);
      assert.deepEqual((await restoredLegacy.query('SELECT * FROM collector.schema_migration ORDER BY version')).rows, oldCollectorLedger);
      const url = new URL(base); url.pathname = '/' + names[2];
      const context = await migrationContext(url.href);
      try { await context.get(MigrationsService).migrate(); } finally { await context.close(); }
      await execute(resolve(java, 'bin/java'), ['-cp', cp, 'com.blariyo.collector.ops.MigrationMain'], { env: { ...process.env,
        COLLECTOR_DB_URL: `jdbc:postgresql://127.0.0.1:55449/${names[2]}`, COLLECTOR_DB_USER: 'postgres', COLLECTOR_DB_PASSWORD: '' } });
      assert.deepEqual((await restoredLegacy.query("SELECT * FROM ops.schema_migration WHERE version<='V008' ORDER BY version")).rows, oldApiLedger);
      assert.deepEqual((await restoredLegacy.query("SELECT * FROM collector.schema_migration WHERE version<='V006' ORDER BY version")).rows, oldCollectorLedger);
      const retained = (await restoredLegacy.query('SELECT * FROM collect.batch_retention WHERE item_id=$1', [legacyItem])).rows[0];
      assert.equal(retained.legacy_review_finalized, true); assert.equal(retained.review_finalized_at, null);
      assert.equal((await restoredLegacy.query('SELECT dedup_id FROM content.post_collection_origin WHERE post_id=$1', [legacyPost])).rows[0].dedup_id, retained.dedup_id);
      assert.equal((await restoredLegacy.query('SELECT count(*) n FROM ops.schema_migration')).rows[0].n, '10');
      assert.equal((await restoredLegacy.query('SELECT count(*) n FROM collector.schema_migration')).rows[0].n, '10');
    },
    snapshot: { dump: args => spawn('docker', ['exec', '--user', 'postgres', container, 'pg_dump', '-U', 'postgres', '-d', names[2], ...args], { stdio: ['ignore', 'pipe', 'pipe'] }),
      ageExecutable: age, recipient, spoolRoot }, provider, downloadDirectory: independent });
  assert.equal(removed, true); assert.equal(replacement.expiresAt, new Date(Date.parse(originalAt) + 7 * 86400000).toISOString());
  assert.equal(uploadedManifest.replacesLegacySha256, original.sha256);
  assert.equal((await replacementClients[1].query('SELECT count(*) n FROM collect.batch_item')).rows[0].n, '0');
  assert.equal((await replacementClients[1].query('SELECT count(*) n FROM content.post_collection_origin')).rows[0].n, '1');
  assert.equal((await replacementClients[1].query('SELECT title FROM content.board_post WHERE id=$1', [legacyPost])).rows[0].title, 'LEGACY_CONTENT_CANARY');
  assert.equal((await replacementClients[1].query("SELECT collect.lookup_dedup('legacy-backup','legacy','https://example.invalid/LEGACY_RAW_CANARY') id")).rows[0].id,
    (await replacementClients[1].query('SELECT dedup_id FROM content.post_collection_origin WHERE post_id=$1', [legacyPost])).rows[0].dedup_id);
  console.log(JSON.stringify({ state: 'PASSED', postgresMajor: 18, encryption: 'age', preservedTables: Object.keys(metadata.fingerprints).length,
    excludedTables: backup.manifest.excludedTables.length, rawRestored: 0, contentAndDedupPreserved: true, unknownTableRejected: true, failedSpoolRemoved: true,
    historicalFullReplacement: true, legacySchemaUpgraded: 'API008/Collector006->010/010', oldLedgersUnchanged: true, originalExpiryPreserved: true }));
} finally {
  await source?.end(); await restored?.end();
  for (const client of replacementClients) await client.end();
  for (const name of created.reverse()) await admin.query('DROP DATABASE ' + name + ' WITH (FORCE)');
  await admin.end(); await rm(root, { recursive: true, force: true });
}
