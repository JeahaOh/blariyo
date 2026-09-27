"""Explicit server-only installer. Existing private config/recipient/credentials remain inputs."""
from pathlib import Path
import datetime,fcntl,hashlib,json,os,pwd,subprocess,sys

UNITS={f'blariyo-backup{suffix}.{kind}' for suffix in ('','-expiry','-alerts') for kind in ('service','timer')}
def validate(payload, now):
 if set(payload)!={'files','expectedHashes','selectiveRestoreReceipt'} or set(payload['files'])!=UNITS|{'run-backup.py'}:raise ValueError('BACKUP_INSTALL_BUNDLE_INVALID')
 receipt=payload['selectiveRestoreReceipt']
 at=datetime.datetime.fromisoformat(receipt['restoredAt'].replace('Z','+00:00'))
 if receipt.get('kind')!='OPS03_SELECTIVE_RESTORE' or receipt.get('provider')!='r2' or receipt.get('rawRestored')!=0 or receipt.get('fingerprintsMatched') is not True or receipt.get('collectionResumeAllowed') is not False or receipt.get('dumpProfileVersion')!='m0-direct-excluded-v1' or not 0<=(now-at).total_seconds()<18*3600:raise ValueError('BACKUP_SELECTIVE_RESTORE_REQUIRED')
 return receipt
def replace(path,body,expected,mode):
 if path.is_symlink():raise ValueError('BACKUP_INSTALL_SYMLINK')
 existing=hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
 if existing!=expected:raise ValueError('BACKUP_INSTALL_BASELINE_CHANGED')
 temp=path.with_name(path.name+'.selective-new')
 fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
 with os.fdopen(fd,'w') as output:output.write(body)
 os.replace(temp,path)
def main():
 if os.geteuid()!=0 or sys.argv[1:]!=['--activate']:raise PermissionError('BACKUP_INSTALL_EXPLICIT_ACTIVATION_REQUIRED')
 os.umask(0o077);payload=json.load(sys.stdin);validate(payload,datetime.datetime.now(datetime.timezone.utc))
 base=Path('/opt/blariyo/backup');runtime=json.loads((base/'runtime.json').read_text())
 account=pwd.getpwuid(runtime['uid'])
 if account.pw_gid!=runtime['gid'] or not account.pw_shell.endswith(('nologin','false')):raise ValueError('BACKUP_DEDICATED_ACCOUNT_REQUIRED')
 with open('/run/blariyo-backup.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  namespace={'__name__':'backup_install_check'};exec(compile(payload['files']['run-backup.py'],'run-backup.py','exec'),namespace)
  namespace['command'](base,'backup',runtime)
  # Digest runtime check precedes every write. No network or server credential is needed for this check.
  subprocess.run(['docker','run','--rm','--network','none','--read-only','--cap-drop','ALL',runtime['image'],'check'],check=True,timeout=60)
  destinations={name:(base/name if name=='run-backup.py' else Path('/etc/systemd/system')/name) for name in payload['files']}
  for name,path in destinations.items():
   current=hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
   if path.is_symlink() or current!=payload['expectedHashes'].get(name):raise ValueError('BACKUP_INSTALL_BASELINE_CHANGED')
  # Validate all file permissions and mounts before changing the installed runner.
  for name,path in destinations.items():replace(path,payload['files'][name],payload['expectedHashes'].get(name),0o600 if name=='run-backup.py' else 0o644)
  subprocess.run(['systemctl','daemon-reload'],check=True)
  subprocess.run(['systemctl','enable','--now',*[n for n in sorted(UNITS) if n.endswith('.timer')]],check=True)
 print('BACKUP_SELECTIVE_RUNNER_INSTALLED')
if __name__=='__main__':
 try:main()
 except Exception:print('BACKUP_INSTALL_FAILED',file=sys.stderr);sys.exit(1)
