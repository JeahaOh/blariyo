"""One-off reviewed deployment. Receives verified public build inputs via SSH stdin."""
import base64,hashlib,importlib.util,json,os,re,shutil,socket,subprocess,sys,time
from datetime import datetime,timezone
from pathlib import Path
os.umask(0o077)
assert os.geteuid()==0 and socket.gethostname()=='ip-172-26-1-91'
p=json.load(sys.stdin);sha=p['mainSha'];assert re.fullmatch('[a-f0-9]{40}',sha)
def run(args,data=None,timeout=180):
 r=subprocess.run(args,input=data,capture_output=True,timeout=timeout)
 if r.returncode: raise RuntimeError('COMMAND_FAILED:'+args[0]+':'+str(r.returncode))
 return r.stdout.decode().strip()
def sql(q):return run(['docker','exec','-i','--user','postgres','blariyo-db-postgresql-1','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo'],q.encode())
def now():return datetime.now(timezone.utc).isoformat()
def phase(s):print(s,flush=True)
# Import the reviewed release preparation primitives, without invoking its nightly main.
spec=importlib.util.spec_from_file_location('deploy','/opt/blariyo/application/nightly-main-deploy-server.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
old=d.read_current_release();assert old.name.startswith('release-f8067ab-')
assert sql('SELECT max(version) FROM ops.schema_migration')=='V014'
assert sql('SELECT max(version) FROM collector.schema_migration')=='V015'
for version,filename,h in (x.split('|') for x in sql("SELECT version,filename,encode(checksum_sha256,'hex') FROM ops.schema_migration ORDER BY version").splitlines()):assert p['apiChecksums'][filename]==h
for version,h in (x.split('|') for x in sql('SELECT version,checksum FROM collector.schema_migration WHERE version<>\'V001\' ORDER BY version').splitlines()):assert p['collectorChecksums'][version]==h
assert p['backup']==json.loads(Path('/opt/blariyo/backup/latest.json').read_text()),'BACKUP_CHANGED_RECHECK'
assert (datetime.now(timezone.utc)-datetime.fromisoformat(p['backup']['createdAt'])).total_seconds()<7200
jar=base64.b64decode(p['jar']);assert hashlib.sha256(jar).hexdigest()==p['jarSha256']
root=Path('/opt/blariyo/source-management-'+sha[:7]);assert not root.exists();root.mkdir(mode=0o700)
(root/'collector.jar').write_bytes(jar);(root/'collector.jar').chmod(0o644)
for name,body in p['files'].items():
 assert name in ('run.py','apply-privileges.sql');(root/name).write_text(body)
api=d.image_digest('ghcr.io/jeahaoh/blariyo-api:'+sha);web=d.image_digest('ghcr.io/jeahaoh/blariyo-web:'+sha)
assert api==p['apiImage'] and web==p['webImage'],'CI_IMAGE_DIGEST_MISMATCH'
for ref in (api,web):assert run(['docker','image','inspect','--format','{{.Architecture}}',ref])=='amd64'
release=Path('/opt/blariyo/application')/('release-'+sha[:7]+'-sources-v015-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
d.copy_release(old,release,api,web,sha)
run(d.compose(release)+['config','--quiet'])
phase('STAGED '+str(release))
units=['blariyo-publish','blariyo-outbox','blariyo-cleanup','blariyo-collection','blariyo-discord-review','blariyo-discord-review-scan','blariyo-nightly-main-deploy']
active=[u+'.timer' for u in units if subprocess.run(['systemctl','is-active','--quiet',u+'.timer']).returncode==0]
state={'mainSha':sha,'releasePath':str(release),'previousReleasePath':str(old),'apiImage':api,'webImage':web,'collectorJarSha256':p['jarSha256'],'ciRun':p['ciRun'],'imageCiRun':p['imageCiRun'],'collectorArtifactSha256':p['artifactSha256'],'backup':p['backup'],'timers':active,'stagedAt':now(),'status':'STAGED'}
def receipt(): (root/'receipt.json').write_text(json.dumps(state,indent=2)+'\n')
receipt()
# Stop scheduling, drain service commands, then close HTTP writes by stopping API.
run(['systemctl','stop',*active]);run(['systemctl','stop',*[u+'.service' for u in units]],timeout=240)
assert not run(['docker','ps','--filter','name=blariyo-collector','--format','{{.Names}}'])
assert not run(['docker','ps','--filter','name=blariyo-discord-review','--format','{{.Names}}'])
run(['docker','stop','--time','30','blariyo-app-api-1'])
state.update(stoppedAt=now(),status='WRITERS_STOPPED');receipt();phase('WRITERS_STOPPED')
def signature():return sql("SELECT json_build_object('posts',(SELECT count(*) FROM content.board_post),'items',(SELECT count(*) FROM collect.batch_item),'postsHash',(SELECT encode(sha256(convert_to(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),''),'UTF8')),'hex') FROM content.board_post t),'itemsHash',(SELECT encode(sha256(convert_to(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),''),'UTF8')),'hex') FROM collect.batch_item t));")
state['before']=json.loads(signature());receipt()
common=['docker','run','--rm','--network','blariyo-db_data','--read-only','--user','0','--cap-drop','ALL','--security-opt','no-new-privileges:true','--pids-limit','96','--log-driver','none']
run(common+['--memory','256m','--mount','type=bind,src=/opt/blariyo/postgresql/secrets/migrator-password,dst=/run/migrator-password,readonly','-e','NODE_ENV=production','-e','DB_HOST=postgresql','-e','DB_NAME=blariyo','-e','MIGRATION_DB_USER=blariyo_migrator','-e','MIGRATION_DB_PASSWORD_FILE=/run/migrator-password','--entrypoint','node',api,'apps/api/dist/commands/migrate.js'],timeout=180)
phase('API_V015_COMPLETE');state.update(apiMigratedAt=now(),status='API_MIGRATED');receipt()
# Java migration loads exactly one file credential through its normal Secrets boundary.
secrets=root/'migration-secrets';secrets.mkdir(mode=0o700);shutil.copyfile('/opt/blariyo/postgresql/secrets/migrator-password',secrets/'database-password');(secrets/'database-password').chmod(0o600)
manifest=json.loads(Path('/opt/blariyo/collector/manifest.json').read_text());java=manifest['image']
try:
 run(common+['--memory','384m','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--mount',f'type=bind,src={root}/collector.jar,dst=/app/collector.jar,readonly','--mount',f'type=bind,src={secrets},dst=/run/migration-secrets,readonly','-e','COLLECTOR_DB_URL=jdbc:postgresql://postgresql:5432/blariyo','-e','COLLECTOR_DB_USER=blariyo_migrator','-e','COLLECTOR_SECRETS_DIRECTORY=/run/migration-secrets','--entrypoint','java',java,'-Xms32m','-Xmx192m','-Dloader.main=com.blariyo.collector.ops.MigrationMain','-cp','/app/collector.jar','org.springframework.boot.loader.launch.PropertiesLauncher'],timeout=180)
finally:
 (secrets/'database-password').unlink();secrets.rmdir()
assert sql("SELECT encode(checksum_sha256,'hex') FROM ops.schema_migration WHERE version='V015'")==p['apiChecksums']['V015__source_auto_publish.sql']
assert sql("SELECT checksum FROM collector.schema_migration WHERE version='V016'")==p['collectorChecksums']['V016']
phase('COLLECTOR_V016_COMPLETE')
sql('SET ROLE blariyo_migrator;\n'+p['files']['apply-privileges.sql'])
assert sql("SELECT has_table_privilege('blariyo_app','collect.batch_source_publish_policy','SELECT,INSERT,UPDATE') AND has_table_privilege('blariyo_app','collect.batch_source_collection_setting','SELECT') AND NOT has_table_privilege('blariyo_app','collect.batch_source_collection_setting','UPDATE') AND has_function_privilege('blariyo_app','collect.set_source_collection_setting(text,boolean,integer,text)','EXECUTE') AND NOT has_table_privilege('blariyo_batch','collect.batch_source_publish_policy','SELECT') AND has_function_privilege('blariyo_batch','collect.sync_source_collection_setting(text,text,boolean,boolean,text)','EXECUTE')")=='t'
state.update(collectorMigratedAt=now(),status='DB_MIGRATED');receipt()
# Preserve the old executable and manifest together. Keep source configuration and credentials.
c=Path('/opt/blariyo/collector');back=root/'collector-before';back.mkdir()
for name in ['collector.jar','manifest.json','run.py']:shutil.copy2(c/name,back/name)
shutil.copy2(root/'collector.jar',c/'collector.jar');shutil.copy2(root/'run.py',c/'run.py')
manifest.update(mainSha=sha,ciRun=p['ciRun'],artifactSha256=p['artifactSha256'],jarSha256=p['jarSha256'])
(c/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Sync catalogue only: no source HTTP, object writes, Discord messages or batch runs.
args=['docker','run','--rm','--network','blariyo-db_data','--ip',manifest['dbNetworkIp'],'--read-only','--user','10001:10001','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','256m','--pids-limit','96','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--log-driver','none','--env-file',str(c/'collector.env'),'--mount',f'type=bind,src={c}/collector.jar,dst=/app/collector.jar,readonly','--mount',f'type=bind,src={c}/sources.json,dst=/app/sources.json,readonly','--entrypoint','java',java,'-Xms32m','-Xmx128m','-Dloader.main=com.blariyo.collector.ops.BatchMain','-cp','/app/collector.jar','org.springframework.boot.loader.launch.PropertiesLauncher','sources-sync']
run(args,timeout=180)
state['sourceSettings']=json.loads(sql("SELECT json_build_object('total',count(*),'enabled',count(*) FILTER(WHERE collection_enabled),'unavailable',count(*) FILTER(WHERE NOT collection_available),'urls',count(source_url)) FROM collect.batch_source_collection_setting"))
assert state['sourceSettings']=={'total':21,'enabled':13,'unavailable':2,'urls':21}
assert sql('SELECT count(*) FROM collect.batch_source_publish_policy WHERE auto_publish_enabled')=='0'
assert json.loads(signature())==state['before'],'CONTENT_CHANGED'
phase('SETTINGS_SYNCED')
# Replace API/Web sequentially, point reboot helper only after both are healthy.
d.start_release(release);state.update(appHealthyAt=now(),status='APP_HEALTHY');receipt()
state['startHelperBackup']=str(d.update_start_helper(release));d.smoke('https://blariyo.com')
phase(run(['python3',str(c/'run.py'),'--check']))
run(['systemctl','start',*active]);state.update(resumedAt=now(),status='DEPLOYED');receipt()
state['after']=json.loads(signature());state['dbVersions']={'api':sql('SELECT max(version) FROM ops.schema_migration'),'collector':sql('SELECT max(version) FROM collector.schema_migration')}
state['runtime']=[{'name':n,'image':run(['docker','inspect','--format','{{.Config.Image}}',n]),'health':run(['docker','inspect','--format','{{.State.Health.Status}}',n])} for n in ['blariyo-app-api-1','blariyo-app-web-1']]
receipt();print(json.dumps(state,indent=2),flush=True)
