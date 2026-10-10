#!/usr/bin/env python3
"""Production timer entrypoint. One bounded container/source; credentials remain root-only."""
import argparse,fcntl,hashlib,json,os,re,signal,socket,subprocess,sys,time
from uuid import uuid4
from resource_metrics import ResourceSampler
from metrics_archive import archive_pending
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path('/opt/blariyo/collector')
NAME='blariyo-collector-scheduled'
MAX_RUNTIME_SECONDS=7200
SOURCE_TIMEOUT_SECONDS=420
CHECK_SECONDS=30
LOG_RETENTION_DAYS=14

def command(args,timeout=30):
    r=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if r.returncode:raise RuntimeError('COLLECTOR_COMMAND_FAILED')
    return r.stdout.strip()

def active_sources(config):
    # The Java worker applies persisted switches; file-level exclusion would hide re-enabled sources.
    return list(config)

def container_args(manifest,source,max_pages=2,max_items=20):
    return ['docker','create','--name',NAME,'--label','blariyo.owner=scheduled-collection',
      '--platform','linux/amd64','--pull','never','--network','blariyo-db_data','--ip',manifest['dbNetworkIp'],
      '--read-only','--user','10001:10001','--cap-drop','ALL','--security-opt','no-new-privileges:true',
      '--memory','512m','--memory-swap','512m','--cpus','0.5','--pids-limit','128',
      '--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--log-driver','local','--log-opt','max-size=5m','--log-opt','max-file=2',
      '--env-file',str(ROOT/'collector.env'),'--mount',f'type=bind,src={ROOT}/collector.jar,dst=/app/collector.jar,readonly',
      '--mount',f'type=bind,src={ROOT}/sources.json,dst=/app/sources.json,readonly','--entrypoint','java',manifest['image'],
      '-Xms32m','-Xmx256m','-XX:MaxMetaspaceSize=128m','-XX:ActiveProcessorCount=1',
      '-Dloader.main=com.blariyo.collector.ops.BatchMain','-cp','/app/collector.jar',
      'org.springframework.boot.loader.launch.PropertiesLauncher','batch','--source',source,'--write-db',
      '--max-pages',str(max_pages),'--max-items',str(max_items),'--since','24h','--interval-ms','5000']

def preflight():
    if os.geteuid()!=0 or socket.gethostname()!='ip-172-26-1-91':raise RuntimeError('WRONG_ENVIRONMENT')
    manifest=json.loads((ROOT/'manifest.json').read_text());config=json.loads((ROOT/'sources.json').read_text())
    for name,key in [('collector.jar','jarSha256'),('sources.json','sourcesSha256')]:
        if hashlib.file_digest((ROOT/name).open('rb'),'sha256').hexdigest()!=manifest[key]:raise RuntimeError('ARTIFACT_CHANGED')
    secret=ROOT/'collector.env'
    if secret.is_symlink() or secret.stat().st_mode&0o077:raise RuntimeError('SECRET_MODE_INVALID')
    if command(['docker','image','inspect','--format','{{.Architecture}}',manifest['image']])!='amd64':raise RuntimeError('WRONG_IMAGE_ARCHITECTURE')
    for name in ['blariyo-db-postgresql-1','blariyo-app-api-1','blariyo-app-web-1']:
        if command(['docker','inspect','--format','{{.State.Health.Status}}',name])!='healthy':raise RuntimeError('SERVICE_NOT_READY')
    return manifest,config

def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--source');parser.add_argument('--max-items',type=int,default=20);parser.add_argument('--max-pages',type=int,default=2)
    args=parser.parse_args()
    if not 1<=args.max_items<=20 or not 1<=args.max_pages<=2:raise RuntimeError('INVALID_LIMITS')
    manifest,config=preflight();sources=active_sources(config)
    if args.source:
        if args.source not in sources:raise RuntimeError('SOURCE_DISABLED_OR_UNKNOWN')
        sources=[args.source]
    if args.check:print(json.dumps({'state':'READY','sources':sources,'sourceConcurrency':1,'maxSeconds':MAX_RUNTIME_SECONDS}));return 0
    with (ROOT/'run.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:print('COLLECTION_ALREADY_RUNNING');return 0
        logs=ROOT/'logs';logs.mkdir(exist_ok=True,mode=0o700)
        for path in logs.glob('run-*.json'):
            if re.fullmatch(r'run-\d{8}T\d{6}Z\.json',path.name) and time.time()-path.stat().st_mtime>LOG_RETENTION_DAYS*86400:path.unlink()
        result={'startedAt':datetime.now(timezone.utc).isoformat(),'sourceSha':manifest['mainSha'],'sources':[],'state':'RUNNING'}
        result['executionId']=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid4().hex[:8]
        metrics=ResourceSampler(ROOT,result['executionId'])
        deadline=time.monotonic()+MAX_RUNTIME_SECONDS;stopped=False
        def stop(_signum,_frame):
            nonlocal stopped
            stopped=True
        signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
        try:
            for source in sources:
                if stopped or time.monotonic()>=deadline:result['state']='INTERRUPTED';break
                entry={'source':source,'startedAt':datetime.now(timezone.utc).isoformat()};result['sources'].append(entry)
                created=False
                try:
                    command(container_args(manifest,source,args.max_pages,args.max_items));created=True
                    command(['docker','network','connect','blariyo-collector_egress',NAME]);command(['docker','start',NAME])
                    metrics.source=source;metrics.start()
                    end=min(deadline,time.monotonic()+SOURCE_TIMEOUT_SECONDS);next_check=0;bad_http=0
                    while True:
                        state=json.loads(command(['docker','inspect','--format','{{json .State}}',NAME]))
                        if not state['Running']:break
                        if stopped or time.monotonic()>=end:
                            entry['stopReason']='INTERRUPTED' if stopped else 'TIME_LIMIT';command(['docker','stop','--time','20',NAME]);break
                        if time.monotonic()>=next_check:
                            mem={l.split(':')[0]:int(l.split()[1]) for l in Path('/proc/meminfo').read_text().splitlines()}
                            http=subprocess.run(['curl','-sS','--max-time','5','-o','/dev/null','-w','%{http_code}','https://blariyo.com/health/live'],capture_output=True,text=True,timeout=7)
                            bad_http=bad_http+1 if http.returncode or http.stdout!='200' else 0
                            entry['minHostAvailableMiB']=min(entry.get('minHostAvailableMiB',float('inf')),round(mem['MemAvailable']/1024,1))
                            if mem['MemAvailable']<256*1024 or bad_http>=3:
                                entry['stopReason']='RESOURCE_OR_HTTP_LIMIT';stopped=True;command(['docker','stop','--time','20',NAME]);break
                            next_check=time.monotonic()+CHECK_SECONDS
                        time.sleep(2)
                    state=json.loads(command(['docker','inspect','--format','{{json .State}}',NAME]))
                    entry.update(exitCode=state['ExitCode'],oomKilled=state['OOMKilled'],finishedAt=state['FinishedAt'])
                    # Only structured reports, never raw logs/env or source contents.
                    for line in command(['docker','logs','--tail','30',NAME]).splitlines():
                        try:record=json.loads(line)
                        except ValueError:continue
                        if isinstance(record,dict) and 'report' in record:
                            report=record['report'];entry['runId']=record.get('runId');entry['reportState']=report.get('state');entry['errors']=report.get('errors',[]);entry['diagnostics']=report.get('diagnostics',[])[:10];entry['counts']={k:v for k,v in report.items() if isinstance(v,int) and not isinstance(v,bool)}
                    if 'reportState' not in entry:entry['error']='REPORT_MISSING'
                except Exception:
                    entry['error']='SOURCE_EXECUTION_FAILED'
                finally:
                    if created:subprocess.run(['docker','rm','-f',NAME],capture_output=True,timeout=40)
                    metrics.source=None
                    print(json.dumps(entry),flush=True)
            if result['state']=='RUNNING':result['state']='INTERRUPTED' if stopped else ('COMPLETED_WITH_ERRORS' if any(x.get('exitCode')!=0 or x.get('error') or x.get('stopReason') for x in result['sources']) else 'COMPLETED')
        finally:
            result['metrics']=metrics.stop()
            # Only upload closed files; a timeout must never lose the local spool.
            try:result['metrics']['archive']=archive_pending(ROOT)
            except Exception:result['metrics']['archive']={'state':'PENDING','error':'ARCHIVE_FAILED'}
            result['finishedAt']=datetime.now(timezone.utc).isoformat();result['unattemptedSources']=[s for s in sources if s not in [x['source'] for x in result['sources']]]
            text=json.dumps(result,indent=2)+'\n';target=logs/('run-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json');target.write_text(text)
            tmp=ROOT/'status.tmp';tmp.write_text(text);tmp.replace(ROOT/'status.json')
            print(json.dumps({'state':result['state'],'sources':len(result['sources']),'unattempted':len(result['unattemptedSources'])}),flush=True)
        return 0 if result['state']=='COMPLETED' else 1

if __name__=='__main__':
    try:sys.exit(main())
    except Exception:print('SCHEDULED_COLLECTION_FAILED',file=sys.stderr);sys.exit(1)
