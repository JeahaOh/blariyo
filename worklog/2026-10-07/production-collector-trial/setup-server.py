"""One-off trial setup. Input with credentials is stdin-only; output is non-secret evidence."""
import subprocess,json,pathlib,hashlib,secrets,os,datetime
os.umask(0o077)
P=pathlib.Path('/opt/blariyo/operations/collector-trial-20261007')
IMAGE='eclipse-temurin@sha256:78498f30dd330b06755c1b134039dcbf8324bedb385136819dd519b842a3816a'
PSQL=['docker','exec','-i','--user','postgres','blariyo-db-postgresql-1','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo']
def command(args,data=None,timeout=120):
 r=subprocess.run(args,input=data,capture_output=True,timeout=timeout)
 if r.returncode:raise RuntimeError('COMMAND_FAILED '+args[0])
 return r.stdout.decode()
def query(sql):return command(PSQL,sql.encode())
payload=json.load(__import__('sys').stdin)
assert not P.exists(),'TRIAL_ALREADY_EXISTS'
assert command(['hostname']).strip()=='ip-172-26-1-91'
jar=pathlib.Path('/home/ubuntu/collector-trial-1c255a9.jar')
assert hashlib.file_digest(jar.open('rb'),'sha256').hexdigest()==payload['jarSha256']
old=dict(line.split('|') for line in query('SELECT version,checksum FROM collector.schema_migration ORDER BY version').splitlines())
assert len(old)==10 and old['V001']=='875f7f62e722cf53d18e398a2abd151442a1b56ecd5a21f956edbcf7565dccbd'
for row in payload['migrations']:
 assert hashlib.sha256(row['sql'].encode()).hexdigest()==row['checksum']
 if row['version'] in old:assert old[row['version']]==row['checksum']
assert query("SELECT count(*) FROM collect.batch_run WHERE state='RUNNING'").strip()=='0'
assert query("SELECT count(*) FROM pg_roles WHERE rolname='blariyo_batch'").strip()=='0'
print('PREFLIGHT_OK schema hashes / no active collector / dedicated role absent',flush=True)
print(command(['python3','/opt/blariyo/backup/run-backup.py'],timeout=700),flush=True)
P.mkdir(mode=0o700)
backup=json.loads(pathlib.Path('/opt/blariyo/backup/latest.json').read_text())
(P/'backup.json').write_text(json.dumps(backup))
# Persist pre-test content digest and counts without storing post text.
snapshot=query("SELECT json_build_object('postCount',count(*),'postDigest',md5(string_agg(row_to_json(p)::text,'' ORDER BY id))) FROM content.board_post p").strip()
(P/'before-content.json').write_text(snapshot)
(P/'before-counts.json').write_text(query("SELECT json_build_object('items',(SELECT count(*) FROM collect.batch_item),'media',(SELECT count(*) FROM collect.batch_media),'runs',(SELECT count(*) FROM collect.batch_run))"))
print('BACKUP_AND_CONTENT_BASELINE_OK',flush=True)
# Match MigrationMain's transaction and advisory lock, preserving schema owner.
sql="BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SET LOCAL ROLE blariyo_migrator; SELECT pg_advisory_xact_lock(72189402);\n"
for row in payload['migrations']:
 if row['version'] not in old:
  sql+=row['sql']+f"\nINSERT INTO collector.schema_migration(version,checksum) VALUES('{row['version']}','{row['checksum']}');\n"
sql+='GRANT SELECT ON collect.batch_image_retry,collect.batch_image_cleanup,collect.batch_manual_deletion,collect.batch_manual_cleanup TO blariyo_backup; COMMIT;'
query(sql)
print('COLLECTOR_V015_APPLIED',flush=True)
command(['docker','pull',IMAGE],timeout=180)
jar.rename(P/'collector.jar');(P/'collector.jar').chmod(0o644)
(P/'sources.json').write_text(json.dumps(payload['sources']));(P/'sources.json').chmod(0o644)
password=secrets.token_hex(32)
# Short-lived collector account has no content or legal schema access.
query(f"CREATE ROLE blariyo_batch LOGIN PASSWORD '{password}' VALID UNTIL '"+(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=1)).isoformat()+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; GRANT CONNECT ON DATABASE blariyo TO blariyo_batch;")
query('''BEGIN; SET LOCAL ROLE blariyo_migrator;
GRANT USAGE ON SCHEMA collect TO blariyo_batch;
GRANT SELECT,INSERT,UPDATE ON collect.batch_source,collect.batch_run,collect.batch_item,collect.batch_media,collect.batch_failure,collect.batch_report,collect.batch_checkpoint,collect.batch_queue,collect.batch_confirmation,collect.batch_input_receipt,collect.batch_source_runtime TO blariyo_batch;
GRANT SELECT ON collect.batch_confirmation_receipt,collect.batch_runtime_projection TO blariyo_batch;
GRANT DELETE ON collect.batch_media,collect.batch_source_runtime TO blariyo_batch;
GRANT EXECUTE ON FUNCTION collect.assert_source_owner(text),collect.assert_run_owner(uuid),collect.assert_item_live(uuid),collect.lookup_dedup(text,text,text),collect.purge_authorized(text,uuid),collect.retention_backlog(),collect.assert_run_payload_live(uuid),collect.complete_confirmation(uuid,text,text,text,uuid),collect.cancel_confirmation(uuid,text,text,text),collect.lock_collection_writer(),collect.unlock_collection_writer(),collect.claim_web_requests(integer),collect.ack_web_request(uuid,uuid),collect.cleanup_input_receipts(),collect.web_retry_accessible(uuid),collect.reserve_batch_request(text,integer,bigint),collect.defer_batch_request(text,bigint),collect.retry_image(uuid,text),collect.prepare_image_retry(text,text),collect.discard_image_failure(uuid) TO blariyo_batch;
COMMIT;''')
assert query("SELECT has_schema_privilege('blariyo_batch','content','USAGE') OR has_schema_privilege('blariyo_batch','legal','USAGE')").strip()=='f'
env={**payload['objectEnv'],'COLLECTOR_DB_URL':'jdbc:postgresql://postgresql:5432/blariyo','COLLECTOR_DB_USER':'blariyo_batch','COLLECTOR_DB_PASSWORD':password,'COLLECTOR_SOURCE_CONFIG':'/app/sources.json'}
assert all('\n' not in v for v in env.values())
(P/'collector.env').write_text(''.join(k+'='+v+'\n' for k,v in env.items()))
(P/'manifest.json').write_text(json.dumps({'sourceSha':payload['sha'],'jarSha256':payload['jarSha256'],'image':IMAGE,'schema':'V015','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2))
print('TRIAL_SETUP_OK '+json.dumps({'schema':'V015','jarSha256':payload['jarSha256'],'image':IMAGE}),flush=True)
