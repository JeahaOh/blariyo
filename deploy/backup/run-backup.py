#!/usr/bin/env python3
"""Common OS lock for selective backups, independent expiry and notification retries.

Install this runner only after OPS-03 selective R2 restore acceptance. No full-dump fallback.
"""
import os,sys,subprocess,json,fcntl,re,uuid
from pathlib import Path
BASE=Path('/opt/blariyo/backup')
def command(base, action, runtime):
 if action not in {'backup','scheduled','maintain','alerts','check'}:raise ValueError('BACKUP_COMMAND_INVALID')
 if not re.fullmatch(r'sha256:[a-f0-9]{64}',runtime['image']):raise ValueError('BACKUP_IMAGE_DIGEST_REQUIRED')
 if any(not isinstance(runtime[k],int) or runtime[k]<1000 for k in ('uid','gid')):raise ValueError('BACKUP_DEDICATED_USER_REQUIRED')
 networks=runtime['networks']
 if not isinstance(networks,list) or not networks or any(not isinstance(n,str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*',n) for n in networks):raise ValueError('BACKUP_NETWORK_INVALID')
 args=['docker','run','--rm','--read-only','--user',f"{runtime['uid']}:{runtime['gid']}",'--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','384m','--pids-limit','64','--log-driver','none','--tmpfs','/tmp:rw,noexec,nosuid,size=16m']
 for network in networks:args+=['--network',network]
 required=['config.json','recipient.txt','r2.json'];optional=['drive.json','discord-webhook','transition.json']
 for name in required+optional:
  path=base/name
  if not path.exists() and name in optional:continue
  if not path.is_file() or path.is_symlink() or path.stat().st_mode&0o077:raise ValueError('BACKUP_SECRET_PERMISSIONS')
  args+=['--mount',f'type=bind,src={path},dst=/run/backup/{name},readonly']
 password=base/'db-password'
 if not password.is_file() or password.is_symlink() or password.stat().st_mode&0o077:raise ValueError('BACKUP_DB_SECRET_PERMISSIONS')
 state=base/'state'
 if not state.is_dir() or state.is_symlink() or state.stat().st_uid!=runtime['uid'] or state.stat().st_mode&0o077:raise ValueError('BACKUP_STATE_PERMISSIONS')
 args+=['--mount',f'type=bind,src={password},dst=/run/backup/db-password,readonly','--mount',f'type=bind,src={state},dst=/state',runtime['image'],action]
 return args
def main():
 if os.geteuid()!=0:raise PermissionError('BACKUP_ROOT_RUNNER_REQUIRED')
 os.umask(0o077)
 descriptor=os.open('/run/blariyo-backup.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
 with os.fdopen(descriptor,'w') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:
   print('BACKUP_ALREADY_RUNNING');return
  path=BASE/'runtime.json'
  if path.is_symlink() or path.stat().st_mode&0o077:raise ValueError('BACKUP_RUNTIME_PERMISSIONS')
  runtime=json.loads(path.read_text())
  args=command(BASE,sys.argv[1] if len(sys.argv)==2 else 'backup',runtime)
  name='blariyo-backup-'+uuid.uuid4().hex
  args[2:2]=['--name',name,'--label','blariyo.job=selective-backup']
  try:
   result=subprocess.run(args,timeout=2100)
   if result.returncode:raise RuntimeError('BACKUP_RUN_FAILED')
  finally:
   inspection=subprocess.run(['docker','inspect','--format','{{index .Config.Labels "blariyo.job"}}',name],capture_output=True)
   if inspection.returncode==0 and inspection.stdout.strip()==b'selective-backup':
    subprocess.run(['docker','rm','-f',name],capture_output=True,check=True)
if __name__=='__main__':
 try:main()
 except Exception as error:
  message=str(error)
  print(message if re.fullmatch(r'BACKUP_[A-Z_]+',message) else 'BACKUP_RUNNER_FAILED',file=sys.stderr);sys.exit(1)
