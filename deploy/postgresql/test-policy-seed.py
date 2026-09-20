#!/usr/bin/env python3
"""Exercise real PostgreSQL 18 seed transactions with synthetic contacts only."""
import importlib.util
import hashlib
import json
from pathlib import Path
import secrets
import re
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('seed_server', HERE/'seed-policies-server.py')
server = importlib.util.module_from_spec(spec); spec.loader.exec_module(server)
name = 'blariyo-policy-seed-test-'+secrets.token_hex(5)
image = 'postgres:18@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280'


def run(args, data=None, ok=True):
    result = subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
    if ok and result.returncode:
        # Only this isolated fixture uses synthetic contacts and no production secrets.
        raise RuntimeError('TEST_COMMAND_FAILED: '+result.stderr.decode())
    return result


def main():
    node = str(Path.home()/'.nvm/versions/node/v24.18.0/bin/node')
    config = {k:'테스트 담당자' for k in ('operatorDisplayName','privacyOfficer')}
    config.update({k:'test@example.com' for k in ('contactEmail','rightsEmail','privacyEmail')})
    config['operatorDisplayName'] = "테스트 ' \\ <script>bad()</script>"
    js = "const {build}=require(process.argv[1]); const fs=require('fs'); process.stdout.write(JSON.stringify(build(JSON.parse(fs.readFileSync(0,'utf8')))));"
    policies = json.loads(run([node,'-e',js,str(HERE/'policy-seed-input.cjs')],json.dumps(config).encode()).stdout)
    assert '&lt;script&gt;' in policies[0]['body'] and '<script>' not in policies[0]['body']
    assert all('2026년 9월 20일' in p['body'] and '{{' not in p['body'] for p in policies)
    assert '[출시 차단:' in policies[1]['body']
    run(['docker','run','-d','--name',name,'--pull','never','--network','none','--memory','256m','-e','POSTGRES_HOST_AUTH_METHOD=trust',image])
    try:
        for _ in range(90):
            if run(['docker','exec',name,'pg_isready','-U','postgres'],ok=False).returncode==0: break
            time.sleep(1)
        else: raise RuntimeError('TEST_DB_NOT_READY')
        def sql(data,ok=True):
            return run(['docker','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','blariyo'],data.encode() if isinstance(data,str) else data,ok)
        run(['docker','exec',name,'psql','-U','postgres','-c','CREATE DATABASE blariyo;'])
        sql('CREATE ROLE blariyo_migrator; REVOKE ALL ON DATABASE blariyo FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE blariyo TO blariyo_migrator;')
        repository = (ROOT/'apps/api/src/persistence/migrations.repository.ts').read_text()
        ledger = re.search(r'async ensureLedger\(\).*?query\(`(.*?)`\)',repository,re.S).group(1)
        sql('SET ROLE blariyo_migrator; '+ledger)
        for migration in sorted((ROOT/'apps/api/migrations').glob('V*.sql')):
            if '.down.' not in migration.name:
                sql('SET ROLE blariyo_migrator; BEGIN;\n'+migration.read_text()+
                    "\nINSERT INTO ops.schema_migration VALUES ('"+migration.name.split('__')[0]+"','"+migration.name+"',decode('"+hashlib.sha256(migration.read_bytes()).hexdigest()+"','hex'),now(),0); COMMIT;")
        seed = (HERE/'seed-policy-drafts.sql').read_text()
        def apply(rows,ok=True): return sql(server.sql_input(rows,seed),ok)
        def state(): return sql("SELECT coalesce(json_agg(p ORDER BY id)::text,'[]') FROM legal.policy_version p;").stdout
        # A conflict in the second policy cannot leave the first one newly inserted.
        sql("SET ROLE blariyo_migrator; INSERT INTO legal.policy_version(policy_type,version_label,title,body_html,status,created_by,created_at,updated_by,updated_at) VALUES ('PRIVACY','v0.1-draft.2','충돌','다른 본문','DRAFT','system:policy-publisher',now(),'system:policy-publisher',now());")
        before = state()
        assert apply(policies,False).returncode != 0 and state()==before
        sql('SET ROLE blariyo_migrator; DELETE FROM legal.policy_version;')  # isolated synthetic DB only
        apply(policies)
        first = state(); apply(policies); assert state()==first
        rows = json.loads(first)
        assert len(rows)==2 and all(r['status']=='DRAFT' and r['effective_at'] is None for r in rows)
        assert sql("SELECT count(*) FROM legal.policy_version WHERE status IN ('EFFECTIVE','RETIRED') AND effective_at<=now();").stdout.strip()==b'0'
        changed = json.loads(json.dumps(policies)); changed[1]['body']+='changed'
        assert apply(changed,False).returncode != 0 and state()==first
        changed = json.loads(json.dumps(policies)); changed[0]['status']='EFFECTIVE'
        assert apply(changed,False).returncode != 0 and state()==first
        # Existing published version remains byte-for-byte intact while draft seeding is repeated.
        sql("SET ROLE blariyo_migrator; INSERT INTO legal.policy_version(policy_type,version_label,title,body_html,status,effective_at,created_by,created_at,updated_by,updated_at) VALUES ('TERMS','v0.0','기존','기존 공개 본문','EFFECTIVE',now(),'system:policy-publisher',now(),'system:policy-publisher',now());")
        published = state(); apply(policies); assert state()==published
        print('PASS 실제 PostgreSQL 18 — V001–V005 후 DRAFT 2개 · 연락처 이스케이프 · 반복 무변경')
        print('PASS 동일 버전 충돌 전체 취소 · EFFECTIVE 입력 거부 · 기존 발행본 보존 · 공개 조회 제외')
    finally:
        run(['docker','rm','-f','-v',name])
        print('PASS 격리 검사 container·volume 정리')


if __name__=='__main__': main()
