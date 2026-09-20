#!/usr/bin/env python3
"""One-off recovery drill. Identity is read from SSH stdin and used only in process memory."""
import os,sys,json,subprocess,hashlib,secrets,time
from pathlib import Path
B=Path('/opt/blariyo/backup');PG='postgres:18@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280'
def run(args,data=None,timeout=180):
 r=subprocess.run(args,input=data,capture_output=True,timeout=timeout)
 assert r.returncode==0,'RESTORE_COMMAND_FAILED'
 return r.stdout
assert os.geteuid()==0 and Path('/etc/hostname').read_text().strip()=='ip-172-26-1-91'
identity=sys.stdin.buffer.read();assert b'AGE-SECRET-KEY-1' in identity
m=json.loads((B/'latest.json').read_text());spool=Path(m['spool']);assert spool.parent==B/'spool'
api=json.loads(run(['docker','inspect','blariyo-app-api-1']))[0]['Image']
script="const fs=require('fs'),{S3Client,GetObjectCommand}=require('@aws-sdk/client-s3');const c=JSON.parse(fs.readFileSync('/run/r2.json'));const s=new S3Client({region:'auto',endpoint:c.endpoint,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey}});s.send(new GetObjectCommand({Bucket:c.bucket,Key:process.argv[1]})).then(async r=>{for await(const b of r.Body){if(!process.stdout.write(b))await new Promise(v=>process.stdout.once('drain',v));}}).catch(()=>process.exitCode=1).finally(()=>s.destroy());"
encrypted=run(['docker','run','--rm','--network','blariyo-app_app','--read-only','--user','0','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','192m','--pids-limit','32','--log-driver','none','--mount',f'type=bind,src={B}/r2.json,dst=/run/r2.json,readonly','--entrypoint','node',api,'-e',script,m['key']])
assert hashlib.sha256(encrypted).hexdigest()==m['sha256'] and len(encrypted)==m['bytes']
readback=spool/'restore-readback.age';readback.write_bytes(encrypted);os.chmod(readback,0o600)
# -i - reads the identity from stdin; plaintext stays in memory and then pg_restore stdin.
print('PASS R2 다운로드 SHA-256',flush=True)
archive=run(['age','--decrypt','-i','-',str(readback)],identity);assert archive.startswith(b'PGDMP')
print('PASS age 복호화',flush=True)
name='blariyo-restore-check-'+secrets.token_hex(6);created=False
try:
 run(['docker','run','-d','--name',name,'--network','none','--memory','256m','--pids-limit','64','--log-driver','none','--tmpfs','/var/lib/postgresql:size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=blariyo_restore',PG,'postgres','-c','shared_buffers=32MB','-c','max_connections=10']);created=True
 for _ in range(60):
  if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres','-d','blariyo_restore'],capture_output=True).returncode==0:break
  time.sleep(.5)
 else:raise RuntimeError('RESTORE_DB_NOT_READY')
 run(['docker','exec','-i',name,'pg_restore','-U','postgres','-d','blariyo_restore','--exit-on-error','--single-transaction','--no-owner','--no-acl'],archive)
 print('PASS 격리 pg_restore 완료',flush=True)
 query="SELECT (SELECT count(*) FROM ops.schema_migration), (SELECT count(*) FROM legal.policy_version WHERE status='EFFECTIVE'), (SELECT count(*) FROM content.board), (SELECT count(*) FROM content.board_post); SELECT policy_type,version_label,encode(sha256(convert_to(body_html,'UTF8')),'hex') FROM legal.policy_version WHERE status='EFFECTIVE' ORDER BY policy_type; SELECT version,encode(checksum_sha256,'hex') FROM ops.schema_migration ORDER BY version;"
 def sql(container,db):return run(['docker','exec','-i','--user','postgres',container,'psql','-XAtq','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],query.encode())
 restored=sql(name,'blariyo_restore');current=sql('blariyo-db-postgresql-1','blariyo');assert restored==current,'RESTORE_READBACK_MISMATCH'
 print('PASS R2 실파일 다운로드·SHA-256·age 복호화·격리 PostgreSQL 18 실제 복원')
 print('PASS migration ledger·정책 본문 해시·게시판/게시글 수 운영 DB 대조')
finally:
 if created:run(['docker','rm','-f',name])
 readback.unlink(missing_ok=True)
print('PASS 복구 시험 container·메모리 임시 DB 정리, 복구키 서버 파일 저장 없음')
