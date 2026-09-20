#!/usr/bin/env python3
import json,os,socket,subprocess,sys,stat,time
from pathlib import Path
BASE=Path('/opt/blariyo/application/release-56351a45eea650c0f02e5043')
GATE=Path('/opt/blariyo/gateway')
def run(a):
 r=subprocess.run(a,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=300)
 if r.returncode:raise ValueError('START_COMMAND_FAILED')
 return r.stdout

def main():
 assert os.geteuid()==0 and socket.gethostname()=='ip-172-26-1-91'
 files=json.load(sys.stdin);assert set(files)=={'app','gateway'}
 assert run(['systemctl','is-active','blariyo-logs']).strip()==b'active'
 count=run(['docker','exec','--user','postgres','blariyo-db-postgresql-1','psql','-X','-qAt','-U','postgres','-d','blariyo','-c',"SELECT count(DISTINCT policy_type) FROM legal.policy_version WHERE status='EFFECTIVE' AND effective_at<=now();"]);assert count.strip()==b'2'
 for key,base in [('app',BASE),('gateway',GATE)]:
  p=base/'production-logging.yaml';b=files[key].encode()
  if p.exists():assert not p.is_symlink() and p.read_bytes()==b
  else:
   fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   with os.fdopen(fd,'wb') as f:f.write(b)
 app=['docker','compose','--env-file',str(BASE/'images.env'),'-f',str(BASE/'compose.yaml'),'-f',str(BASE/'production-logging.yaml')]
 gate=['docker','compose','-f',str(GATE/'compose.yaml'),'-f',str(GATE/'production-logging.yaml')]
 for cmd in [app,gate]:
  cfg=json.loads(run(cmd+['config','--format','json']))
  for svc in cfg['services'].values():
   assert not svc.get('ports') and svc['logging']['driver']=='syslog' and svc['logging']['options']['cache-disabled']=='true'
 print('PASS 유효 정책·기간 로그·비공개 포트 사전 확인',flush=True)
 run(app+['up','-d','--wait','--wait-timeout','180','api','web'])
 print('PASS Core·Web 기동 및 healthy',flush=True)
 run(gate+['up','-d','--wait','--wait-timeout','60'])
 print('PASS Nginx 기동 및 healthy',flush=True)
 for name in ['blariyo-app-api-1','blariyo-app-web-1','blariyo-gateway-nginx-1']:
  i=json.loads(run(['docker','inspect',name]))[0]
  assert not i['HostConfig'].get('PortBindings') and i['State'].get('Health',{}).get('Status')=='healthy' and i['HostConfig']['LogConfig']['Type']=='syslog'
 print('PASS 앱 3개 health·host port 없음·syslog 설정 readback')
if __name__=='__main__':
 try:main()
 except Exception as e:print('FAIL '+(str(e) if isinstance(e,ValueError) else 'APPLICATION_START_FAILED'));sys.exit(1)
