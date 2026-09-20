#!/usr/bin/env python3
"""Publish approved M0 policy templates through the real application command."""
import os,sys,json,subprocess,socket,hashlib,stat,fcntl
from pathlib import Path
from datetime import datetime,timezone
BASE=Path('/opt/blariyo/application/release-56351a45eea650c0f02e5043')
def run(a,data=None):
 r=subprocess.run(a,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=300)
 if r.returncode:raise ValueError('POLICY_COMMAND_FAILED')
 return r.stdout

def write(p,b):
 if p.exists():
  assert not p.is_symlink() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600 and p.read_bytes()==b
 else:
  fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb') as f:f.write(b)

def main():
 assert os.geteuid()==0 and socket.gethostname()=='ip-172-26-1-91'
 policies=json.load(sys.stdin)['policies'];assert len(policies)==2 and {p['type'] for p in policies}=={'terms','privacy'}
 for p in policies:
  assert set(p)=={'type','version','title','body'} and p['version']=='v0.1' and 1<len(p['body'])<1000000 and not any(x in p['body'] for x in ['[출시 차단','[입력 필요','{{'])
 fd=os.open(BASE/'.publish.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 ids=dict(line.split('=',1) for line in (BASE/'images.env').read_text().splitlines() if '=' in line)
 image=ids['BLARIYO_API_IMAGE'];assert image.startswith('sha256:')
 info=json.loads(run(['docker','image','inspect',image]))[0];assert info['Architecture']=='amd64'
 db='blariyo-db-postgresql-1';sql=['docker','exec','-i','--user','postgres',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo']
 assert run(sql,b"SELECT ops.is_schema_ready('V005');").strip()==b't'
 identity=hashlib.sha256(json.dumps(policies,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
 dest=BASE/'policy-releases'/identity;dest.mkdir(mode=0o700,parents=True,exist_ok=True);os.chmod(dest.parent,0o700)
 write(dest/'input.json',json.dumps(policies,ensure_ascii=False).encode())
 dump=dest/'before-publish.dump'
 if not dump.exists():
  write(dump,run(['docker','exec','--user','postgres',db,'pg_dump','-U','postgres','-d','blariyo','-Fc']))
  run(['docker','exec','-i','--user','postgres',db,'pg_restore','--list'],dump.read_bytes())
 print('PASS 발행 전 DB 사본 · 원본 본문 보관',flush=True)
 for p in policies:
  typ=p['type'].upper()
  rows=json.loads(run(sql,("SELECT coalesce(json_agg(t),'[]') FROM (SELECT status,body_html,title FROM legal.policy_version WHERE policy_type='"+typ+"' AND version_label='v0.1') t;").encode()))
  artifactPath=dest/(p['type']+'.json')
  if rows:
   if len(rows)!=1 or rows[0]['status']!='EFFECTIVE' or not artifactPath.exists():raise ValueError('EXISTING_POLICY_CONFLICT')
  else:
   artifact={**p,'effectiveAt':datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')}
   artifact['checksum']=hashlib.sha256(json.dumps(artifact,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
   # A previous unsuccessful attempt may have an expired artifact; preserve it, use a new attempt file.
   if artifactPath.exists():artifactPath.rename(dest/(p['type']+'-previous-'+str(int(datetime.now().timestamp()))+'.json'))
   write(artifactPath,json.dumps(artifact,ensure_ascii=False).encode())
   args=['docker','run','--rm','--pull','never','--network','blariyo-db_data','--user','0:0','--read-only','--cap-drop','ALL','--cap-add','DAC_READ_SEARCH','--security-opt','no-new-privileges:true','--memory','256m','--pids-limit','64','--env-file',str(BASE/'api.env'),'--mount','type=bind,src='+str(BASE/'secrets/app-password')+',dst=/run/secrets/app-password,readonly','--mount','type=bind,src='+str(artifactPath)+',dst=/run/policy.json,readonly','--entrypoint','node',image,'apps/api/dist/commands/command.js','policies:publish','--artifact=/run/policy.json']
   run(args)
  # Validate sanitized body using the same image implementation, then compare independent SQL readback.
  check="const fs=require('fs'),crypto=require('crypto'),sanitize=require('sanitize-html');const a=JSON.parse(fs.readFileSync('/run/policy.json','utf8'));const h=sanitize(a.body,{allowedTags:['h1','h2','h3','h4','p','ul','ol','li','strong','em','a','table','thead','tbody','tr','th','td','br','blockquote'],allowedAttributes:{a:['href','rel']},allowedSchemes:['https','mailto'],allowProtocolRelative:false,transformTags:{a:sanitize.simpleTransform('a',{rel:'noopener noreferrer'})}});process.stdout.write(crypto.createHash('sha256').update(h).digest('hex'));"
  expected=run(['docker','run','--rm','--network','none','--read-only','--cap-drop','ALL','--mount','type=bind,src='+str(artifactPath)+',dst=/run/policy.json,readonly','--user','0','--entrypoint','node',image,'-e',check]).decode().strip()
  actual=run(sql,("SELECT encode(sha256(convert_to(body_html,'UTF8')),'hex') FROM legal.policy_version WHERE policy_type='"+typ+"' AND version_label='v0.1' AND status='EFFECTIVE' AND effective_at<=now();").encode()).decode().strip();assert actual==expected
  print('PASS '+typ+' v0.1 EFFECTIVE · 정제된 본문 SHA-256 readback 일치',flush=True)
 assert run(sql,b"SELECT count(DISTINCT policy_type) FROM legal.policy_version WHERE status='EFFECTIVE' AND effective_at<=now();").strip()==b'2'
 print('PASS 정책 2종 정식 발행 · Core 시작 조건 충족')
if __name__=='__main__':
 try:main()
 except Exception as e:print('FAIL '+(str(e) if isinstance(e,ValueError) else 'POLICY_RELEASE_FAILED')+' · 자동 DB rollback 없음');sys.exit(1)
