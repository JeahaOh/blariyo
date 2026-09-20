#!/usr/bin/env python3
import json,os,socket,stat,subprocess,sys
from pathlib import Path

def run(args):
 r=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
 if r.returncode:raise ValueError('OPERATIONS_COMMAND_FAILED')
 return r.stdout

def save(path,body,mode=0o600):
 data=body.encode()
 if path.exists() or path.is_symlink():
  st=path.lstat()
  if not stat.S_ISREG(st.st_mode) or st.st_uid!=0 or stat.S_IMODE(st.st_mode)!=mode or path.read_bytes()!=data:raise ValueError('OPERATIONS_FILE_CONFLICT')
 else:
  fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
  with os.fdopen(fd,'wb') as f:f.write(data)

def main():
 assert os.geteuid()==0 and socket.gethostname()=='ip-172-26-1-91'
 files=json.load(sys.stdin)
 assert set(files)=={'rsyslog.conf','expire-logs.py','blariyo-logs.service','blariyo-log-retention.service','blariyo-log-retention.timer','rsyslog-apparmor'}
 base=Path('/opt/blariyo/operations');base.mkdir(mode=0o700,exist_ok=True)
 assert base.lstat().st_uid==0 and stat.S_IMODE(base.lstat().st_mode)==0o700 and not base.is_symlink()
 logs=Path('/var/log/blariyo/application');logs.mkdir(parents=True,mode=0o700,exist_ok=True);os.chmod(logs.parent,0o700)
 assert logs.lstat().st_uid==0 and stat.S_IMODE(logs.lstat().st_mode)==0o700 and not logs.is_symlink()
 for name,body in files.items():save(base/name,body)
 ap=Path('/etc/apparmor.d/rsyslog.d');ap.mkdir(exist_ok=True)
 save(ap/'blariyo',files['rsyslog-apparmor'],0o644)
 run(['apparmor_parser','-r','/etc/apparmor.d/usr.sbin.rsyslogd'])
 Path('/run/blariyo-logs').mkdir(mode=0o700,exist_ok=True)
 run(['/usr/sbin/rsyslogd','-N1','-f',str(base/'rsyslog.conf')])
 for name in files:
  if name.endswith(('.service','.timer')):save(Path('/etc/systemd/system')/name,files[name],0o644)
 run(['systemctl','daemon-reload'])
 run(['systemctl','enable','--now','blariyo-logs.service','blariyo-log-retention.timer'])
 run(['systemctl','start','blariyo-log-retention.service'])
 assert run(['systemctl','is-active','blariyo-logs.service']).strip()==b'active'
 assert run(['systemctl','is-active','blariyo-log-retention.timer']).strip()==b'active'
 print('PASS 전용 로그 수신기·기간 삭제 timer active · 다른 서비스 로그 설정 유지')
if __name__=='__main__':
 try:main()
 except Exception as e:print('FAIL '+(str(e) if isinstance(e,ValueError) else 'OPERATIONS_INSTALL_FAILED'));sys.exit(1)
