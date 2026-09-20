#!/usr/bin/env python3
"""Install an immutable private draft seed and apply it after migrations."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import stat
import subprocess
import sys


def run(argv, data=None, timeout=90):
    result = subprocess.run(argv, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        raise ValueError('POLICY_SEED_COMMAND_FAILED')
    return result.stdout


def checked(path, mode, directory=False):
    info = path.lstat()
    if info.st_uid != 0 or stat.S_IMODE(info.st_mode) != mode or not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
        raise ValueError('POLICY_SEED_PATH_UNSAFE')
    return None if directory else path.read_bytes()


def save(path, data):
    if path.exists() or path.is_symlink():
        if checked(path, 0o600) != data:
            raise ValueError('POLICY_SEED_SAVED_FILE_CHANGED')
        return
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as output:
        output.write(data); output.flush(); os.fsync(output.fileno())


def sql_input(policies, sql):
    encoded = json.dumps(policies, ensure_ascii=False, separators=(',', ':')).encode().hex()
    return ("SET ROLE blariyo_migrator;\n\\set policy_seed_hex '" + encoded + "'\n" + sql).encode()


def main():
    if os.geteuid() != 0 or sys.platform != 'linux' or socket.gethostname() != 'ip-172-26-1-91':
        raise ValueError('POLICY_SEED_TARGET_MISMATCH')
    raw = sys.stdin.buffer.read(3000001)
    if len(raw) > 3000000:
        raise ValueError('POLICY_SEED_INPUT_TOO_LARGE')
    payload = json.loads(raw)
    sql, policies = payload['sql'], payload['policies']
    if hashlib.sha256(sql.encode()).hexdigest() != payload['sql_sha256']:
        raise ValueError('POLICY_SEED_SQL_CHECKSUM_MISMATCH')
    if not isinstance(policies, list) or len(policies) != 2 or {p['type'] for p in policies} != {'TERMS','PRIVACY'}:
        raise ValueError('POLICY_SEED_INPUT_INVALID')
    for p in policies:
        if p['status'] != 'DRAFT' or p['effectiveAt'] is not None or not re.fullmatch(r'v\d+\.\d+-draft\.\d+', p['version']):
            raise ValueError('POLICY_SEED_DRAFT_ONLY')
        if not isinstance(p['body'], str) or not 0 < len(p['body']) <= 1000000 or '{{' in p['body']:
            raise ValueError('POLICY_SEED_BODY_INVALID')
    base = Path('/opt/blariyo/postgresql')
    checked(base, 0o700, True)
    if checked(base/'.managed', 0o600) != b'blariyo-postgresql-setup-v1\n':
        raise ValueError('POLICY_SEED_UNMANAGED_DATABASE')
    lockfd = os.open(base/'.policy-seed.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lockfd, 'w'):
        fcntl.flock(lockfd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        cid = run(['docker','compose','-p','blariyo-db','-f',str(base/'compose.yaml'),'ps','-q','postgresql']).decode().strip()
        if not re.fullmatch('[a-f0-9]{64}', cid):
            raise ValueError('POLICY_SEED_DATABASE_MISSING')
        db = json.loads(run(['docker','inspect',cid]))[0]
        if db['State'].get('Health',{}).get('Status') != 'healthy' or db['Config']['Labels'].get('com.docker.compose.project') != 'blariyo-db' or db['HostConfig'].get('PortBindings'):
            raise ValueError('POLICY_SEED_DATABASE_BOUNDARY')
        admin = ['docker','exec','-i','--user','postgres',cid,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo']
        if run(admin, b"SELECT ops.is_schema_ready('V005');").strip() != b't':
            raise ValueError('POLICY_SEED_MIGRATION_REQUIRED')
        # Private immutable replay material, never written into the repository.
        data = json.dumps(policies, ensure_ascii=False, separators=(',', ':')).encode()
        identity = hashlib.sha256(sql.encode()+b'\0'+data).hexdigest()
        directory = base/'policy-seeds'
        directory.mkdir(mode=0o700, exist_ok=True); checked(directory,0o700,True)
        destination = directory/identity
        destination.mkdir(mode=0o700, exist_ok=True); checked(destination,0o700,True)
        save(destination/'policies.json',data)
        save(destination/'seed-policy-drafts.sql',sql.encode())
        # Snapshot before the first application of this exact seed; contains private DB data.
        dump = destination/'before-seed.dump'
        if not dump.exists():
            temporary = destination/'before-seed.dump.partial'
            fd = os.open(temporary,os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,0o600)
            with os.fdopen(fd,'wb') as output:
                result = subprocess.run(['docker','exec','--user','postgres',cid,'pg_dump','-U','postgres','-d','blariyo','-Fc'],stdout=output,stderr=subprocess.PIPE,timeout=300)
                output.flush(); os.fsync(output.fileno())
            if result.returncode or temporary.stat().st_size == 0:
                raise ValueError('POLICY_SEED_CHECKPOINT_FAILED')
            with temporary.open('rb') as source:
                result = subprocess.run(['docker','exec','-i','--user','postgres',cid,'pg_restore','--list'],stdin=source,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=60)
            if result.returncode:
                raise ValueError('POLICY_SEED_CHECKPOINT_INVALID')
            temporary.rename(dump)
        else:
            checked(dump,0o600)
        run(admin,sql_input(policies,sql))
        # Independent readback: body hashes and status, never private contact values.
        rows = json.loads(run(admin,b"SELECT coalesce(json_agg(row_to_json(p)), '[]'::json) FROM (SELECT policy_type,version_label,status,effective_at,ended_at,title,encode(sha256(convert_to(body_html,'UTF8')),'hex') AS body_hash FROM legal.policy_version) p;"))
        for p in policies:
            found = [r for r in rows if r['policy_type']==p['type'] and r['version_label']==p['version']]
            if len(found)!=1 or found[0]['status']!='DRAFT' or found[0]['effective_at'] is not None or found[0]['ended_at'] is not None or found[0]['title']!=p['title'] or found[0]['body_hash']!=hashlib.sha256(p['body'].encode()).hexdigest():
                raise ValueError('POLICY_SEED_READBACK_FAILED')
        count = run(admin,b"SELECT count(DISTINCT policy_type) FROM legal.policy_version WHERE status='EFFECTIVE' AND effective_at<=now();").decode().strip()
        print('PASS 운영 DB — TERMS·PRIVACY DRAFT 각 1개 · 본문 SHA-256 일치 · 시행일 없음')
        print('현재 유효 정책 종류 수: '+count+' (이번 작업은 발행하지 않음)')
        print('보관: '+str(destination)+' — root 700/600 · 변경 전 DB 사본 포함')


if __name__=='__main__':
    try: main()
    except Exception as error:
        code = str(error) if isinstance(error,ValueError) and re.fullmatch('[A-Z_]+',str(error)) else 'POLICY_SEED_FAILED'
        print('FAIL '+code+' — 본문·연락처·오류 원문 비출력',file=sys.stderr); sys.exit(1)
