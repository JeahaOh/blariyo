"""Discord review V013->V014 promotion after verified main images. Inputs via stdin."""
import json,sys,os,socket,time,threading,subprocess,hashlib
from pathlib import Path
from datetime import datetime,timezone
payload=json.load(sys.stdin)
assert socket.gethostname()=='ip-172-26-1-91' and os.geteuid()==0
h={'__name__':'deployment_helpers'}
exec(compile(payload['helpers'],'nightly-main-deploy-server.py','exec'),h)
run=h['run']; sqlbase=['docker','exec','-i','--user','postgres','blariyo-db-postgresql-1','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo']
def sql(q):return run(sqlbase,input_text=q,timeout=60)
def now():return datetime.now(timezone.utc).isoformat()
sha=payload['sha'];assert h['SHA_RE'].fullmatch(sha)
evidence=Path('/opt/blariyo/application')/('promotion-'+sha[:7]+'.json')
if payload['phase']=='stage':
 assert h['remote_main_sha'](h['DEFAULT_REPO'])==sha,'MAIN_CHANGED'
 api=h['image_digest'](f'ghcr.io/jeahaoh/blariyo-api:{sha}')
 web=h['image_digest'](f'ghcr.io/jeahaoh/blariyo-web:{sha}')
 current=h['read_current_release']()
 target=current.parent/('release-'+sha[:7]+'-discord-v014-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
 h['copy_release'](current,target,api,web,sha)
 secrets=Path('/opt/blariyo/discord-review/secrets');assert len(list(secrets.iterdir()))==7
 def setenv(file,values):
  lines=file.read_text().splitlines();keys=set(values)
  lines=[line for line in lines if line.split('=',1)[0] not in keys]
  file.write_text('\n'.join(lines+[k+'='+v for k,v in values.items()])+'\n');file.chmod(0o600)
 setenv(target/'api.env',{'DISCORD_REVIEW_ENABLED':'true','DISCORD_REVIEW_CONFIG_FILE':'/run/secrets/discord-review/api.json'})
 setenv(target/'web.env',{'NUXT_DISCORD_REVIEW_ENABLED':'true'})
 compose=(target/'compose.yaml').read_text();assert 'discord-review/secrets' not in compose
 compose=compose.replace('    volumes:\n','    volumes:\n      - type: bind\n        source: /opt/blariyo/discord-review/secrets\n        target: /run/secrets/discord-review\n        read_only: true\n        bind:\n          create_host_path: false\n',1)
 (target/'compose.yaml').write_text(compose)
 run(h['compose'](target)+['config','--quiet'])
 data={'mainSha':sha,'apiImage':api,'webImage':web,'previousReleasePath':str(current),'releasePath':str(target),'stagedAt':now(),'phase':'STAGED'}
 evidence.write_text(json.dumps(data,indent=2));os.chmod(evidence,0o600)
 print(json.dumps(data));sys.exit(0)
assert payload['phase']=='apply'
data=json.loads(evidence.read_text());assert data['mainSha']==sha and data['phase']=='STAGED'
current=Path(data['previousReleasePath']);target=Path(data['releasePath'])
assert h['read_current_release']()==current and h['remote_main_sha'](h['DEFAULT_REPO'])==sha
assert sql('SELECT max(version) FROM ops.schema_migration')=='V013'
assert sql("SELECT count(*) FROM pg_stat_activity WHERE usename='blariyo_batch'")=='0'
assert sql("SELECT count(*) FROM pg_namespace WHERE nspname IN ('content','legal','ops','collect','collector','batch','quartz') AND nspowner<>(SELECT oid FROM pg_roles WHERE rolname='blariyo_migrator')")=='0'
backup=json.loads(Path('/opt/blariyo/backup/latest.json').read_text());assert backup['sha256']==payload['backupSha256']
assert time.time()-datetime.fromisoformat(backup['createdAt']).timestamp()<3600
snapshot="SELECT json_build_object('posts',(SELECT count(*) FROM content.board_post),'postDigest',(SELECT md5(string_agg(row_to_json(p)::text,'' ORDER BY id)) FROM content.board_post p),'items',(SELECT count(*) FROM collect.batch_item),'itemDigest',(SELECT md5(string_agg(row_to_json(i)::text,'' ORDER BY id)) FROM collect.batch_item i),'reviewDigest',(SELECT md5(string_agg(row_to_json(r)::text,'' ORDER BY item_id)) FROM collect.batch_review r));"
lockfd=os.open(h['LOCK'],os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
timers=['blariyo-publish.timer','blariyo-outbox.timer','blariyo-cleanup.timer']
stop=threading.Event();samples=[]
def probe():
 while not stop.is_set():
  start=time.time();r=subprocess.run(['curl','-sS','--max-time','4','-o','/dev/null','-w','%{http_code}','https://blariyo.com/api/v1/boards/meme/posts?deployprobe=20261007'],capture_output=True,text=True)
  samples.append({'at':datetime.fromtimestamp(start,timezone.utc).isoformat(),'code':r.stdout.strip(),'exit':r.returncode,'ms':round((time.time()-start)*1000)})
  stop.wait(1)
thread=threading.Thread(target=probe,daemon=True);thread.start()
try:
 run(['systemctl','stop',*timers]);data['timersStoppedAt']=now()
 for service in ['blariyo-publish.service','blariyo-outbox.service','blariyo-cleanup.service']:
  for _ in range(60):
   state=run(['systemctl','show',service,'-p','ActiveState','--value'])
   if state in ('inactive','failed'):break
   time.sleep(1)
  else:raise RuntimeError('WORKER_DRAIN_TIMEOUT')
 run(h['compose'](current)+['stop','web','api']);data['appsStoppedAt']=now()
 data['before']=json.loads(sql(snapshot))
 args=['docker','run','--rm','--name','blariyo-api-migration-20261007','--network','blariyo-db_data','--read-only','--user','0:0','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','256m','--pids-limit','64','--log-driver','none','--mount','type=bind,src=/opt/blariyo/postgresql/secrets/migrator-password,dst=/run/secrets/migrator-password,readonly']
 for env in ['NODE_ENV=production','DB_HOST=postgresql','DB_NAME=blariyo','MIGRATION_DB_USER=blariyo_migrator','MIGRATION_DB_PASSWORD_FILE=/run/secrets/migrator-password','DB_APP_ROLE=blariyo_app']:
  args+=['-e',env]
 run(args+[data['apiImage'],'node','apps/api/dist/commands/migrate.js'],timeout=180)
 sql('SET ROLE blariyo_migrator;\n'+payload['privileges'])
 assert sql('SELECT max(version) FROM ops.schema_migration')=='V014'
 data['after']=json.loads(sql(snapshot));assert data['before']==data['after'],'CONTENT_CHANGED'
 assert sql("SELECT count(*) FROM content.common_code WHERE group_key='source'")=='21'
 assert sql("SELECT has_function_privilege('blariyo_app','collect.delete_failed_item(uuid,bigint,bigint,text)','EXECUTE')")=='t'
 assert sql("SELECT has_table_privilege('blariyo_app','collect.discord_review_delivery','SELECT,INSERT,UPDATE') AND NOT has_table_privilege('blariyo_batch','collect.discord_review_delivery','UPDATE')")=='t'
 data['migrationFinishedAt']=now();data['phase']='MIGRATED'
 evidence.write_text(json.dumps(data,indent=2))
 h['start_release'](target);data['appsHealthyAt']=now()
 h['smoke']('https://blariyo.com')
 data['startHelperBackup']=str(h['update_start_helper'](target))
 run(['systemctl','start',*timers]);data['timersResumedAt']=now()
 h['write_state']({**data,'deployedAt':now(),'source':'manual-main-schema-promotion'})
 reviewroot=Path('/opt/blariyo/discord-review')
 manifest=json.loads((reviewroot/'manifest.json').read_text());manifest.update(sourceSha=sha,state='ENABLED')
 (reviewroot/'manifest.json').write_text(json.dumps(manifest,indent=2))
 run(['python3','-B',str(reviewroot/'run.py'),'check'],timeout=60)
 import shutil
 for name in ['blariyo-discord-review','blariyo-discord-review-scan']:
  for suffix in ['service','timer']:
   destination=Path('/etc/systemd/system')/(name+'.'+suffix)
   assert not destination.exists(),'REVIEW_UNIT_ALREADY_EXISTS'
   shutil.copyfile(reviewroot/destination.name,destination);destination.chmod(0o644)
 run(['systemctl','daemon-reload'])
 run(['systemd-analyze','verify','/etc/systemd/system/blariyo-discord-review.service','/etc/systemd/system/blariyo-discord-review-scan.service'])
 run(['systemctl','enable','--now','blariyo-discord-review.timer','blariyo-discord-review-scan.timer'])
 data['reviewEnabledAt']=now()
 data['phase']='DEPLOYED';data['backup']=backup
 print(json.dumps(data))
except Exception as e:
 data['phase']='FAILED';data['failure']=str(e) if str(e).replace('_','').isalnum() else 'DEPLOYMENT_COMMAND_FAILED'
 # The migration transaction is atomic; only V013 can restart the prior application.
 if sql('SELECT max(version) FROM ops.schema_migration')=='V013':
  h['start_release'](current);run(['systemctl','start',*timers]);data['oldV013Restored']=True
 raise
finally:
 stop.set();thread.join(timeout=6);data['publicSamples']=samples
 evidence.write_text(json.dumps(data,indent=2));os.close(lockfd);h['LOCK'].unlink()
