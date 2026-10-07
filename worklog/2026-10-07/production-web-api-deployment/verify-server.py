"""Read-only deployed runtime, schema, settings, and internal admin read verification."""
import subprocess,json,sys,hashlib
from pathlib import Path
p=Path('/opt/blariyo/application/promotion-b57724d.json');out=json.loads(p.read_text());assert out['phase']=='DEPLOYED'
def run(a,text=None):
 r=subprocess.run(a,input=text,text=True,capture_output=True,timeout=60);assert r.returncode==0,'VERIFY_COMMAND_FAILED';return r.stdout
containers=json.loads(run(['docker','inspect','blariyo-app-api-1','blariyo-app-web-1','blariyo-db-postgresql-1','blariyo-gateway-nginx-1']))
out['runtime']=[{'name':c['Name'],'image':c['Config']['Image'],'imageId':c['Image'],'running':c['State']['Running'],'health':c['State']['Health']['Status'],'oom':c['State']['OOMKilled'],'hostPorts':c['HostConfig']['PortBindings']} for c in containers]
assert all(c['running'] and c['health']=='healthy' and not c['oom'] and not c['hostPorts'] for c in out['runtime'])
assert out['runtime'][0]['image']==out['apiImage'] and out['runtime'][1]['image']==out['webImage']
readiness=run(['docker','exec','blariyo-app-api-1','node','-e',"fetch('http://127.0.0.1:4000/internal/health/ready').then(async r=>{if(!r.ok)process.exitCode=1;console.log(await r.text())})"])
out['readiness']=json.loads(readiness);assert out['readiness']['status']=='READY'
out['adminRead']=json.loads(run(['docker','exec','-i','blariyo-app-api-1','node','--input-type=module'],sys.stdin.read()))
q="SELECT json_build_object('api',(SELECT max(version) FROM ops.schema_migration),'collector',(SELECT max(version) FROM collector.schema_migration),'posts',(SELECT count(*) FROM content.board_post),'items',(SELECT count(*) FROM collect.batch_item),'commonCodes',(SELECT count(*) FROM content.common_code WHERE group_key='source'),'deletePermission',has_function_privilege('blariyo_app','collect.delete_failed_item(uuid,bigint,bigint,text)','EXECUTE'),'backupCodes',has_table_privilege('blariyo_backup','content.common_code','SELECT'))"
out['database']=json.loads(run(['docker','exec','--user','postgres','blariyo-db-postgresql-1','psql','-XqAt','-U','postgres','-d','blariyo','-c',q]))
old=Path(out['previousReleasePath']);new=Path(out['releasePath'])
names=['api.env','web.env','compose.yaml','production-logging.yaml','secrets/app-password','secrets/admin-operators.json']
out['settingsPreserved']={n:hashlib.sha256((old/n).read_bytes()).digest()==hashlib.sha256((new/n).read_bytes()).digest() for n in names};assert all(out['settingsPreserved'].values())
out['bootHelperCurrent']=new.name in Path('/opt/blariyo/operations/start-application.py').read_text();assert out['bootHelperCurrent']
out['timers']=run(['systemctl','show','blariyo-publish.timer','blariyo-outbox.timer','blariyo-cleanup.timer','blariyo-backup.timer','blariyo-nightly-main-deploy.timer','-p','Id','-p','ActiveState','-p','UnitFileState'])
out['memory']=run(['free','-m'])
print(json.dumps(out))
