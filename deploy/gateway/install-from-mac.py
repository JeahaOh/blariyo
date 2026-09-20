#!/usr/bin/env python3
"""Install and start the private Nginx gateway. No Tunnel route or public port changes."""
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
RELEASE = '/opt/blariyo/application/release-56351a45eea650c0f02e5043'
sys.dont_write_bytecode = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    ipaddress.IPv4Address(args.host)
    spec = importlib.util.spec_from_file_location('db_ssh', HERE.parent/'postgresql/install-from-mac.py')
    ssh_helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(ssh_helper)
    files = {name: (HERE/name).read_text() for name in ['nginx.conf','compose.yaml']}
    payload = {'release': RELEASE, 'files': files, 'hashes': {name:hashlib.sha256(data.encode()).hexdigest() for name,data in files.items()}}
    key = ssh_helper.find_key(None)
    print('대상: ubuntu@'+args.host+' / private Nginx gateway', flush=True)
    if not args.install:
        print('로컬 파일·SSH key 확인. --install: Web container 생성(미기동)·Nginx 설치/기동. Tunnel 연결 없음.')
        return
    code = (HERE/'install-server.py').read_text()
    ssh = ['ssh','-T','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10',
           '-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-i',str(key),'ubuntu@'+args.host]
    result = subprocess.run(ssh+['sudo -n python3 -u -c '+shlex.quote(code)],input=json.dumps(payload).encode(),timeout=1200)
    if result.returncode:raise ValueError('GATEWAY_INSTALL_FAILED')


if __name__=='__main__':
    try:main()
    except Exception as error:
        code = str(error) if isinstance(error,ValueError) and re.fullmatch('[A-Z_]+',str(error)) else 'LOCAL_GATEWAY_FAILED'
        print('FAIL '+code+' — 비밀값·오류 원문 비출력',file=sys.stderr);sys.exit(1)
