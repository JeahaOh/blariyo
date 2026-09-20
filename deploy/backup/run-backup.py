#!/usr/bin/env python3
"""Root-only encrypted DB backup. The decryption identity never lives on this server."""
import os,sys,subprocess,json,hashlib,datetime,secrets,fcntl,shutil,re
from pathlib import Path
BASE=Path('/opt/blariyo/backup')
PG='postgres:18@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280'
def main():
 assert os.geteuid()==0
 os.umask(0o077)
 lock=os.open('/run/blariyo-backup.lock',os.O_CREAT|os.O_RDWR,0o600)
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 recipient=(BASE/'recipient.txt').read_text().strip();assert recipient.startswith('age1')
 now=datetime.datetime.now(datetime.timezone.utc);name=now.strftime('%Y%m%dT%H%M%SZ')+'-'+secrets.token_hex(6)
 spool=BASE/'spool'/name;spool.mkdir(mode=0o700,parents=True)
 archive=spool/'archive.age'
 dumpcmd=['docker','run','--rm','--network','blariyo-db_data','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','128m','--pids-limit','32','--log-driver','none','--mount','type=bind,src=/opt/blariyo/postgresql/secrets/backup-password,dst=/run/password,readonly','--entrypoint','sh',PG,'-c','export PGPASSWORD="$(cat /run/password)"; exec pg_dump -h postgresql -U blariyo_backup -d blariyo --format=custom --no-owner --no-acl']
 dump=subprocess.Popen(dumpcmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 age=subprocess.Popen(['age','-r',recipient,'-o',str(archive)],stdin=dump.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 dump.stdout.close();age.communicate(timeout=300);dump.communicate(timeout=30)
 assert dump.returncode==0 and age.returncode==0,'DUMP_ENCRYPT_FAILED'
 manifest={'format':1,'key':'db/daily/'+name+'.dump.age','createdAt':now.isoformat(),'postgresMajor':18,'sha256':hashlib.file_digest(archive.open('rb'),'sha256').hexdigest(),'bytes':archive.stat().st_size,'retentionDays':7}
 (spool/'manifest.json').write_text(json.dumps(manifest)+'\n')
 api=json.loads(subprocess.check_output(['docker','inspect','blariyo-app-api-1']))[0]['Image']
 cmd=['docker','run','--rm','--network','blariyo-app_app','--read-only','--user','0:0','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','192m','--pids-limit','32','--log-driver','none','--mount',f'type=bind,src={BASE}/r2.json,dst=/run/backup/r2.json,readonly','--mount',f'type=bind,src={BASE}/r2-transfer.cjs,dst=/run/backup/transfer.cjs,readonly','--mount',f'type=bind,src={spool},dst=/run/spool,readonly','--entrypoint','node',api,'/run/backup/transfer.cjs']
 r=subprocess.run(cmd,capture_output=True,timeout=600);assert r.returncode==0,'UPLOAD_VERIFY_FAILED'
 # Keep only last verified encrypted local checkpoint; failed encrypted spools survive until success.
 (BASE/'latest.json').write_text(json.dumps(dict(manifest,spool=str(spool)))+'\n')
 for p in (BASE/'spool').iterdir():
  if p!=spool and re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{12}',p.name) and p.is_dir() and not p.is_symlink():shutil.rmtree(p)
 print('PASS 암호화 DB dump·R2 업로드·다운로드 SHA-256 확인·7일 보관',flush=True)
 print('BACKUP_KEY '+manifest['key'],flush=True)
if __name__=='__main__':
 try:main()
 except Exception as e:print('FAIL BACKUP_'+type(e).__name__,file=sys.stderr);sys.exit(1)
