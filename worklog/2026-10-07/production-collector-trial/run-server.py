"""Bounded real collection with public HTTP and resource sampling; always reclaim temporary access."""
import subprocess,json,pathlib,os,time,datetime,hashlib
os.umask(0o077)
P=pathlib.Path('/opt/blariyo/operations/collector-trial-20261007')
NAME='blariyo-collector-trial-20261007';NETWORK='blariyo-collector-trial-egress'
HBA=pathlib.Path('/opt/blariyo/postgresql/pg_hba.conf')
PSQL=['docker','exec','-i','--user','postgres','blariyo-db-postgresql-1','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo']
def command(args,data=None,timeout=30,required=True):
 r=subprocess.run(args,input=data,capture_output=True,timeout=timeout)
 if required and r.returncode:
  detail=r.stderr.decode()[:800] if args[:2]==['docker','start'] else ''
  raise RuntimeError('COMMAND_FAILED '+' '.join(args[:2])+' '+detail)
 return r.stdout.decode()
def query(sql):return command(PSQL,sql.encode())
def inspect(name):return json.loads(command(['docker','inspect',name]))[0]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def probe():
 r=subprocess.run(['curl','-L','-sS','--max-time','8','-o','/dev/null','-w','%{http_code} %{time_total}','https://blariyo.com/'],capture_output=True,text=True,timeout=10)
 v=r.stdout.split();return {'code':v[0] if v else '000','seconds':float(v[1]) if len(v)>1 else None,'exit':r.returncode}
def sample(phase):
 mem={line.split(':')[0]:int(line.split()[1]) for line in pathlib.Path('/proc/meminfo').read_text().splitlines()}
 row={'at':now(),'phase':phase,'availableMiB':mem['MemAvailable']/1024,'swapUsedMiB':(mem['SwapTotal']-mem['SwapFree'])/1024,'load':pathlib.Path('/proc/loadavg').read_text().split()[:3],'http':probe()}
 if phase=='running':
  text=command(['docker','stats','--no-stream','--format','{{json .}}',NAME],required=False)
  row['collector']=json.loads(text) if text.strip() else None
 with (P/'metrics.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 return row
hba_before=HBA.read_text();hba_trial=None;container_created=False;network_created=False
result={'startedAt':now(),'state':'STARTING'}
try:
 manifest=json.loads((P/'manifest.json').read_text())
 assert hashlib.file_digest((P/'collector.jar').open('rb'),'sha256').hexdigest()==manifest['jarSha256']
 assert not (P/'result.json').exists(),'TRIAL_ALREADY_RUN'
 result['beforeServices']={n:{'image':inspect(n)['Image'],'startedAt':inspect(n)['State']['StartedAt']} for n in ['blariyo-app-web-1','blariyo-app-api-1','blariyo-db-postgresql-1']}
 for _ in range(5):sample('before');time.sleep(1)
 command(['docker','network','create',NETWORK]);network_created=True
 args=['docker','create','--name',NAME,'--label','blariyo.trial=20261007','--platform','linux/amd64','--pull','never','--network','blariyo-db_data','--read-only','--user','10001:10001','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','512m','--memory-swap','512m','--cpus','0.5','--pids-limit','128','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--log-driver','local','--log-opt','max-size=5m','--log-opt','max-file=2','--env-file',str(P/'collector.env'),'--mount',f'type=bind,src={P}/collector.jar,dst=/app/collector.jar,readonly','--mount',f'type=bind,src={P}/sources.json,dst=/app/sources.json,readonly','--entrypoint','java',manifest['image'],'-Xms32m','-Xmx256m','-XX:MaxMetaspaceSize=128m','-XX:ActiveProcessorCount=1','-Dloader.main=com.blariyo.collector.ops.BatchMain','-cp','/app/collector.jar','org.springframework.boot.loader.launch.PropertiesLauncher','batch','--source',next(iter(json.loads((P/'sources.json').read_text()))),'--write-db','--max-pages','1','--max-items','5','--since','24h','--interval-ms','5000']
 command(args);container_created=True
 command(['docker','network','connect',NETWORK,NAME])
 data=inspect(NAME);ip=data['NetworkSettings']['Networks']['blariyo-db_data']['IPAddress']
 # Docker assigns network addresses on start, reserve a specific DB network address if needed.
 if not ip:
  import ipaddress
  net=json.loads(command(['docker','network','inspect','blariyo-db_data']))[0]
  used={v['IPv4Address'].split('/')[0] for v in net['Containers'].values()}
  subnet=ipaddress.ip_network(net['IPAM']['Config'][0]['Subnet'])
  ip=next(str(x) for x in subnet.hosts() if int(x)-int(subnet.network_address)>20 and str(x) not in used)
  command(['docker','network','disconnect','blariyo-db_data',NAME])
  command(['docker','network','connect','--ip',ip,'blariyo-db_data',NAME])
 hba_trial=hba_before.replace('host all all 0.0.0.0/0 reject',f'host blariyo blariyo_batch {ip}/32 scram-sha-256\nhost all all 0.0.0.0/0 reject')
 assert hba_trial!=hba_before
 (P/'pg_hba.before').write_text(hba_before);HBA.write_text(hba_trial);query('SELECT pg_reload_conf()')
 assert query('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL').strip()=='0'
 result['limits']={'memoryMiB':512,'heapMiB':256,'cpus':0.5,'sourceConcurrency':1,'intervalMs':5000,'maxItems':5}
 result['runStartedAt']=now();(P/'status.json').write_text(json.dumps({'state':'RUNNING','at':now()}))
 command(['docker','start',NAME]);start=time.monotonic();bad=0
 while inspect(NAME)['State']['Running']:
  row=sample('running');bad=bad+1 if row['http']['code']!='200' else 0
  if row['availableMiB']<256 or bad>=3 or time.monotonic()-start>600:
   result['stopReason']='RESOURCE_HTTP_OR_TIME_LIMIT';command(['docker','stop','--time','15',NAME]);break
  time.sleep(3)
 state=inspect(NAME)['State'];result['containerState']={k:state[k] for k in ['Status','ExitCode','OOMKilled','StartedAt','FinishedAt']}
 logs=command(['docker','logs',NAME]);(P/'collector.log').write_text(logs)
 records=[]
 for line in logs.splitlines():
  try:records.append(json.loads(line))
  except ValueError:pass
 result['report']=records[-1] if records else None
 result['state']='FINISHED';result['runFinishedAt']=now()
 for _ in range(5):sample('after');time.sleep(1)
 result['afterContent']=json.loads(query("SELECT json_build_object('postCount',count(*),'postDigest',md5(string_agg(row_to_json(p)::text,'' ORDER BY id))) FROM content.board_post p"))
 result['contentUnchanged']=result['afterContent']==json.loads((P/'before-content.json').read_text())
 result['afterServices']={n:{'image':inspect(n)['Image'],'startedAt':inspect(n)['State']['StartedAt'],'healthy':inspect(n)['State'].get('Health',{}).get('Status')} for n in result['beforeServices']}
except Exception as e:
 result['state']='FAILED';result['failureClass']=type(e).__name__;result['failure']=str(e) if isinstance(e,RuntimeError) else type(e).__name__
finally:
 # Only resources created for this named trial are reclaimed.
 if container_created:command(['docker','rm','-f',NAME],required=False)
 if network_created:command(['docker','network','rm',NETWORK],required=False)
 if hba_trial is not None and HBA.read_text()==hba_trial:
  HBA.write_text(hba_before);query('SELECT pg_reload_conf()')
 if query("SELECT count(*) FROM pg_stat_activity WHERE usename='blariyo_batch'").strip()=='0':
  query('DROP OWNED BY blariyo_batch; DROP ROLE blariyo_batch;')
 (P/'collector.env').unlink(missing_ok=True)
 result['cleanup']={'roleAbsent':query("SELECT count(*) FROM pg_roles WHERE rolname='blariyo_batch'").strip()=='0','hbaRestored':HBA.read_text()==hba_before,'secretRemoved':not (P/'collector.env').exists()}
 result['finishedAt']=now();(P/'result.json').write_text(json.dumps(result,indent=2));(P/'status.json').write_text(json.dumps({'state':result['state'],'at':now()}))
 print(json.dumps(result),flush=True)
