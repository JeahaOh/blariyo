#!/usr/bin/env python3
"""Seed existing policy drafts after schema migrations; no public policy activation."""
import argparse
import hashlib
import importlib.util
import ipaddress
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--node', default=str(Path.home()/'.nvm/versions/node/v24.18.0/bin/node'))
    args = parser.parse_args()
    ipaddress.IPv4Address(args.host)
    spec = importlib.util.spec_from_file_location('db_ssh',HERE/'install-from-mac.py')
    helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
    key = helper.find_key(None)
    generated = subprocess.run([args.node,str(HERE/'policy-seed-input.cjs'),'--pipe'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
    if generated.returncode: raise ValueError('POLICY_SEED_LOCAL_INPUT_FAILED')
    policies = json.loads(generated.stdout)
    sql = (HERE/'seed-policy-drafts.sql').read_text()
    payload = {'policies':policies,'sql':sql,'sql_sha256':hashlib.sha256(sql.encode()).hexdigest()}
    print('PASS 기존 공개 연락처·정책 원문 확인 — 비밀값 비출력 · DRAFT 2개',flush=True)
    if not args.apply:
        print('--apply: SSH로 전달해 migration 이후 DB에 DRAFT 등록. 기존 DB 초기화·정책 발행 없음.')
        return
    ssh = ['ssh','-T','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10',
           '-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-i',str(key),'ubuntu@'+args.host]
    command = 'sudo -n python3 -u -c '+shlex.quote((HERE/'seed-policies-server.py').read_text())
    result = subprocess.run(ssh+[command],input=json.dumps(payload).encode(),timeout=600)
    if result.returncode: raise ValueError('POLICY_SEED_SERVER_FAILED')


if __name__=='__main__':
    try: main()
    except Exception as error:
        code = str(error) if isinstance(error,ValueError) and re.fullmatch('[A-Z_]+',str(error)) else 'POLICY_SEED_LOCAL_FAILED'
        print('FAIL '+code+' — 본문·연락처·오류 원문 비출력',file=sys.stderr); sys.exit(1)
