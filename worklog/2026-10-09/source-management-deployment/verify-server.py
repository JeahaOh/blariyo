import json,subprocess
from pathlib import Path
def run(args,data=None):
 r=subprocess.run(args,input=data,capture_output=True,timeout=120)
 assert r.returncode==0,'VERIFICATION_COMMAND_FAILED'
 return r.stdout.decode().strip()
root=Path('/opt/blariyo/source-management-77a425d')
receipt=json.loads((root/'receipt.json').read_text())
assert receipt['status']=='DEPLOYED'
for timer in receipt['timers']:
 assert run(['systemctl','is-active',timer])=='active'
print('PASS previously active application/collection/review timers resumed')
for name in ['blariyo-db-postgresql-1','blariyo-app-api-1','blariyo-app-web-1']:
 assert run(['docker','inspect','--format','{{.State.Health.Status}}',name])=='healthy'
print('PASS PostgreSQL/API/Web healthy')
for name,image in [('blariyo-app-api-1',receipt['apiImage']),('blariyo-app-web-1',receipt['webImage'])]:
 assert run(['docker','inspect','--format','{{.Config.Image}}',name])==image
print('PASS runtime images match CI digest-pinned deployment')
script="""import 'reflect-metadata';
import {resolveDatabaseUrl} from './apps/api/dist/bootstrap/database-config.js';
import {createDataSource,DatabaseContext} from './apps/api/dist/persistence/database.js';
import {TypeOrmSourcePublishPolicyRepository} from './apps/api/dist/persistence/source-publish-policy.repository.js';
const db=createDataSource(resolveDatabaseUrl(process.env,'app'));
try {await db.initialize();const items=await new TypeOrmSourcePublishPolicyRepository(new DatabaseContext(db)).list();console.log(JSON.stringify(items));}
catch {console.error('SOURCE_RUNTIME_READ_FAILED');process.exitCode=1;}
finally {if(db.isInitialized)await db.destroy();}
"""
items=json.loads(run(['docker','exec','blariyo-app-api-1','node','--input-type=module','-e',script]))
assert len(items)==21 and all(x['sourceUrl'] and not x['autoPublishEnabled'] for x in items)
assert sum(x['collectionEnabled'] is True for x in items)==13
assert {x['sourceKey'] for x in items if not x['collectionAvailable']}=={'fmkorea','ppomppu'}
assert {x['sourceKey'] for x in items if x['collectionEnabled'] is False and x['collectionAvailable']}=={'arcalive','bobaedream','dcinside','inven','mlbpark','pgr21'}
assert all(all(__import__('re').fullmatch('[A-Z][A-Z0-9_]{0,79}',c) for c in x['lastFailureCodes']) for x in items)
print('PASS official API repository read as app role: 21 sources/URLs, enabled13/tempOFF6/unavailable2/autoPublishON0')
print(json.dumps({'sources':items},ensure_ascii=False,indent=2))
print(run(['python3','/opt/blariyo/collector/run.py','--check']))
print(run(['python3','/opt/blariyo/discord-review/run.py','check']))
print('PASS Collector and Discord review preflight; no collection/publish/message execution')
