from pathlib import Path
import os,sys,json,subprocess
files=json.load(sys.stdin);assert set(files)=={'run-job.py','start-application.py'}
base=Path('/opt/blariyo/operations')
def save(p,b,mode):
 if p.exists():assert not p.is_symlink() and p.read_text()==b
 else:
  fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
  with os.fdopen(fd,'w') as f:f.write(b)
for n,b in files.items():save(base/n,b,0o600)
system=Path('/etc/systemd/system')
save(system/'blariyo-application.service','''[Unit]
Description=Blariyo application boot recovery
Requires=docker.service blariyo-logs.service
After=docker.service blariyo-logs.service network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/python3 /opt/blariyo/operations/start-application.py
TimeoutStartSec=500
[Install]
WantedBy=multi-user.target
''',0o644)
for n,interval in [('publish','*-*-* *:*:00'),('outbox','*-*-* *:*:30'),('cleanup','*-*-* 03:15:00 UTC')]:
 save(system/f'blariyo-{n}.service',f'''[Unit]
Description=Blariyo {n} job
After=blariyo-application.service
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /opt/blariyo/operations/run-job.py {n}
TimeoutStartSec=210
''',0o644)
 save(system/f'blariyo-{n}.timer',f'''[Unit]
Description=Blariyo {n} schedule
[Timer]
OnCalendar={interval}
Persistent=true
AccuracySec=1s
[Install]
WantedBy=timers.target
''',0o644)
subprocess.run(['systemctl','daemon-reload'],check=True,capture_output=True)
subprocess.run(['systemctl','enable','--now','blariyo-application.service','blariyo-publish.timer','blariyo-outbox.timer','blariyo-cleanup.timer'],check=True,capture_output=True)
for n in ['publish','outbox','cleanup']:
 r=subprocess.run(['systemctl','start',f'blariyo-{n}.service'],capture_output=True);assert r.returncode==0,n
print('PASS 재기동 관리·예약 발행·outbox·cleanup timer 설치 및 1회 실행')
