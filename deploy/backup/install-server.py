from pathlib import Path
import json,sys,os,subprocess
assert os.geteuid()==0 and Path('/etc/hostname').read_text().strip()=='ip-172-26-1-91'
p=json.load(sys.stdin);assert set(p)=={'recipient','r2','files'} and set(p['files'])=={'run-backup.py','r2-transfer.cjs'}
assert p['recipient'].startswith('age1') and p['r2']['bucket']=='blariyo-backup'
os.umask(0o077);b=Path('/opt/blariyo/backup');b.mkdir(mode=0o700,exist_ok=True)
def save(path,body,mode=0o600):
 if path.exists():assert not path.is_symlink() and path.read_text()==body,'EXISTING_CONFIG_DIFFERS'
 else:
  fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
  with os.fdopen(fd,'w') as f:f.write(body)
for n,body in p['files'].items():save(b/n,body)
save(b/'recipient.txt',p['recipient']+'\n');save(b/'r2.json',json.dumps(p['r2'])+'\n')
s=Path('/etc/systemd/system')
save(s/'blariyo-backup.service','''[Unit]
Description=Blariyo encrypted PostgreSQL backup to R2
After=blariyo-application.service network-online.target
[Service]
Type=oneshot
UMask=0077
ExecStart=/usr/bin/python3 /opt/blariyo/backup/run-backup.py
TimeoutStartSec=960
''',0o644)
save(s/'blariyo-backup.timer','''[Unit]
Description=Blariyo backup twice daily (03:30 and 15:30 KST)
[Timer]
OnCalendar=*-*-* 06,18:30:00 UTC
Persistent=true
RandomizedDelaySec=60
[Install]
WantedBy=timers.target
''',0o644)
subprocess.run(['systemctl','daemon-reload'],check=True,capture_output=True)
subprocess.run(['systemctl','enable','--now','blariyo-backup.timer'],check=True,capture_output=True)
print('PASS backup 전용 DB/R2 권한·공개 암호화 수신키·12시간 timer 설치')
