#!/usr/bin/env python3
"""Install reviewed collector schedule; secrets arrive on stdin, timer activation is separate."""
import hashlib,ipaddress,json,os,re,secrets,socket,subprocess,sys
from pathlib import Path
os.umask(0o077)
ROOT=Path('/opt/blariyo/collector');JAR=Path('/home/ubuntu/scheduled-collector-b57724d.jar')
PSQL=['docker','exec','-i','--user','postgres','blariyo-db-postgresql-1','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo']
def run(args,data=None,timeout=60):
 r=subprocess.run(args,input=data,text=True,capture_output=True,timeout=timeout)
 if r.returncode:raise RuntimeError('INSTALL_COMMAND_FAILED')
 return r.stdout.strip()
def sql(q):return run(PSQL,q)
assert os.geteuid()==0 and socket.gethostname()=='ip-172-26-1-91'
p=json.load(sys.stdin)
assert not ROOT.exists(),'INSTALLATION_EXISTS'
assert hashlib.file_digest(JAR.open('rb'),'sha256').hexdigest()==p['jarSha256']
assert sql('SELECT max(version) FROM collector.schema_migration')=='V015'
assert sql('SELECT max(version) FROM ops.schema_migration')=='V013'
assert sql("SELECT count(*) FROM pg_roles WHERE rolname='blariyo_batch'")=='0'
assert sql("SELECT count(*) FROM collect.batch_run WHERE state='RUNNING'")=='0'
assert len([v for v in p['sources'].values() if v.get('blockedReason')!='SOURCE_DISABLED'])==15
start=Path('/opt/blariyo/operations/start-application.py').read_text();release=Path('/opt/blariyo/application')/re.search(r'release-[A-Za-z0-9._-]+',start).group()
api_env=dict(l.split('=',1) for l in (release/'api.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
assert api_env['COLLECT_READER_S3_BUCKET']==p['objectEnv']['COLLECTOR_OBJECT_STORE_S3_BUCKET'],'BUCKET_MISMATCH'
assert set(p['objectEnv'])=={'COLLECTOR_OBJECT_STORE_S3_ENDPOINT','COLLECTOR_OBJECT_STORE_S3_BUCKET','COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID','COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY'}
net=json.loads(run(['docker','network','inspect','blariyo-db_data']))[0]
used={v['IPv4Address'].split('/')[0] for v in net['Containers'].values()};subnet=ipaddress.ip_network(net['IPAM']['Config'][0]['Subnet'])
ip=next(str(v) for v in subnet.hosts() if int(v)-int(subnet.network_address)>20 and str(v) not in used)
ROOT.mkdir(mode=0o700)
JAR.rename(ROOT/'collector.jar');(ROOT/'collector.jar').chmod(0o644)
(ROOT/'sources.json').write_text(json.dumps(p['sources'],ensure_ascii=False,indent=2)+'\n');(ROOT/'sources.json').chmod(0o644)
for name in ['run.py','resource_metrics.py','metrics_archive.py','metrics-transfer.cjs','blariyo-collection.service','blariyo-collection.timer']:
 (ROOT/name).write_text(p['files'][name])
 (ROOT/name).chmod(0o644 if name=='metrics-transfer.cjs' else 0o600)
password=secrets.token_hex(32)
sql("CREATE ROLE blariyo_batch LOGIN PASSWORD '"+password+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; GRANT CONNECT ON DATABASE blariyo TO blariyo_batch;")
sql(p['batchGrants'])
assert sql("SELECT has_schema_privilege('blariyo_batch','content','USAGE') OR has_schema_privilege('blariyo_batch','legal','USAGE')")=='f'
env={**p['objectEnv'],'COLLECTOR_DB_URL':'jdbc:postgresql://postgresql:5432/blariyo','COLLECTOR_DB_USER':'blariyo_batch','COLLECTOR_DB_PASSWORD':password,'COLLECTOR_SOURCE_CONFIG':'/app/sources.json'}
assert all('\n' not in v and '\r' not in v for v in env.values())
(ROOT/'collector.env').write_text(''.join(k+'='+v+'\n' for k,v in env.items()))
hba=Path('/opt/blariyo/postgresql/pg_hba.conf');before=hba.read_text();(ROOT/'pg_hba.before').write_text(before)
line=f'host blariyo blariyo_batch {ip}/32 scram-sha-256\n'
assert 'host all all 0.0.0.0/0 reject' in before
hba.write_text(before.replace('host all all 0.0.0.0/0 reject',line+'host all all 0.0.0.0/0 reject'))
sql('SELECT pg_reload_conf()');assert sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL')=='0'
run(['docker','network','create','--label','blariyo.owner=scheduled-collection','blariyo-collector_egress'])
manifest={k:p[k] for k in ['mainSha','ciRun','artifactSha256','jarSha256','image']};manifest['dbNetworkIp']=ip;manifest['sourcesSha256']=hashlib.file_digest((ROOT/'sources.json').open('rb'),'sha256').hexdigest()
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
run(['docker','image','inspect',p['image']])
for name in ['blariyo-collection.service','blariyo-collection.timer']:
 target=Path('/etc/systemd/system')/name;assert not target.exists();target.write_text(p['files'][name]);target.chmod(0o644)
run(['systemd-analyze','verify','/etc/systemd/system/blariyo-collection.service','/etc/systemd/system/blariyo-collection.timer'])
run(['systemctl','daemon-reload'])
print(run(['python3',str(ROOT/'run.py'),'--check']))
print(json.dumps({'state':'INSTALLED_NOT_ENABLED','manifest':manifest,'dbRoleNoContentAccess':True}))
