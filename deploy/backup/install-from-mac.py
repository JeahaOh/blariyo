#!/usr/bin/env python3
"""Installs encrypted backup; keeps the recovery identity on the Mac, never logs it."""
import os,json,subprocess,re,stat
from pathlib import Path
REPO=Path('/Volumes/MicroVault/iCloudDrive/git/private/blariyo')
NODE='/Users/zeaha/.nvm/versions/node/v24.18.0/bin/node'
KEYDIR=Path('/Users/zeaha/task_list/.blariyo-recovery')
os.umask(0o077);KEYDIR.mkdir(mode=0o700,exist_ok=True)
assert not KEYDIR.is_symlink() and stat.S_IMODE(KEYDIR.stat().st_mode)==0o700
key=KEYDIR/'postgres-age-identity.txt'
if not key.exists():
 r=subprocess.run(['python3',str(REPO/'deploy/operations/remote.py'),str(REPO/'deploy/backup/age-keygen-server.py')],capture_output=True,check=True)
 assert b'AGE-SECRET-KEY-1' in r.stdout
 fd=os.open(key,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb') as f:f.write(r.stdout)
assert not key.is_symlink() and stat.S_IMODE(key.stat().st_mode)==0o600
recipient=re.search(r'^# public key: (age1\w+)$',key.read_text(),re.M).group(1)
script="const fs=require('fs');const c=require('/Users/zeaha/task_list/check-blariyo-r2.cjs').parseCredentials(fs.readFileSync(process.env.HOME+'/.config/blariyo/r2-credentials.env','utf8'));process.stdout.write(JSON.stringify({endpoint:c.R2_ENDPOINT,bucket:c.R2_BACKUP_BUCKET,accessKeyId:c.R2_BACKUP_ACCESS_KEY_ID,secretAccessKey:c.R2_BACKUP_SECRET_ACCESS_KEY}));"
r=subprocess.run([NODE,'-e',script],capture_output=True,check=True)
payload={'recipient':recipient,'r2':json.loads(r.stdout),'files':{n:(REPO/'deploy/backup'/n).read_text() for n in ['run-backup.py','r2-transfer.cjs']}}
r=subprocess.run(['python3',str(REPO/'deploy/operations/remote.py'),str(REPO/'deploy/backup/install-server.py')],input=json.dumps(payload).encode(),capture_output=True)
print(r.stdout.decode(),end='');assert r.returncode==0,'BACKUP_INSTALL_FAILED'
print('복구키 보관:',key,'(600, 비밀값 비출력)')
