#!/usr/bin/env python3
"""Check a tested initial-migration bundle; --apply transfers its image and applies schema/grants."""
import argparse
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
import importlib.util

HERE = Path(__file__).resolve().parent


def module(name):
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def archive_hash(path):
    value = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def check_bundle(directory):
    server = module('migrate-server')
    metadata = json.loads((directory / 'manifest.json').read_text())
    server.validate(metadata['payload'])
    archive = directory / 'api.tar'
    if archive.is_symlink() or not archive.is_file() or archive_hash(archive) != metadata['archive_sha256']:
        raise ValueError('IMAGE_ARCHIVE_MISMATCH')
    for name in ('apply-privileges.sql', 'migrate-server.py'):
        if server.digest((HERE / name).read_bytes()) != metadata['files'][name]:
            raise ValueError('TESTED_HELPER_CHANGED')
    if metadata['files']['apply-privileges.sql'] != metadata['payload']['grants_sha256']:
        raise ValueError('GRANTS_MANIFEST_MISMATCH')
    if metadata.get('tested') is not True:
        raise ValueError('BUNDLE_NOT_TESTED')
    return metadata['payload'], archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--key')
    parser.add_argument('--bundle', type=Path, default=Path.home() / 'task_list/blariyo-db-migration-20260920')
    args = parser.parse_args()
    ipaddress.ip_address(args.host)
    payload, archive = check_bundle(args.bundle)
    key = module('install-from-mac').find_key(args.key)
    print('PASS 검증된 amd64 image 묶음·SHA-256·설치 도구·SSH key 권한 확인', flush=True)
    print('대상: ubuntu@' + args.host + ' / ' + payload['expected_hostname'] + ' /opt/blariyo/postgresql', flush=True)
    if not args.apply:
        print('로컬 검사만 완료했습니다. --apply를 지정할 때 image 전송·초기 migration·권한 적용을 실행합니다.')
        return
    ssh = ['ssh', '-T', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
           '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-i', str(key), 'ubuntu@' + args.host]
    # Verify host identity and managed directory before accepting any image bytes.
    preflight = "import os,socket,sys,shutil; from pathlib import Path; " + \
        "p=Path('/opt/blariyo/postgresql/.managed'); " + \
        "ok=(os.geteuid()==0 and socket.gethostname()==" + repr(payload['expected_hostname']) + \
        " and os.uname().machine=='x86_64' and not p.is_symlink() and p.read_bytes()==b'blariyo-postgresql-setup-v1\\n'" + \
        " and shutil.disk_usage('/').free>" + str(archive.stat().st_size * 3 + 512 * 1024 * 1024) + "); " + \
        "sys.exit(1) if not ok else None; os.execvp('docker',['docker','image','load','--quiet'])"
    print('진행 서버 확인 후 API image 전송 — 서버에서 소스 build를 하지 않습니다.', flush=True)
    with archive.open('rb') as source:
        loaded = subprocess.run(ssh + ['sudo -n python3 -c ' + shlex.quote(preflight)], stdin=source, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=1800)
    if loaded.returncode:
        raise ValueError('SERVER_PREFLIGHT_OR_IMAGE_TRANSFER_FAILED')
    print('PASS API image 전송 · 진행 변경 전 DB 사본·초기 migration·권한 검사', flush=True)
    command = 'sudo -n python3 -u -c ' + shlex.quote((HERE / 'migrate-server.py').read_text())
    result = subprocess.run(ssh + [command], input=json.dumps(payload).encode(), check=False)
    if result.returncode:
        raise ValueError('SERVER_INITIAL_MIGRATION_FAILED')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[A-Z_]+', str(error)) else 'LOCAL_MIGRATION_CHECK_FAILED'
        print('FAIL ' + code + ' — 오류 원문·비밀값 비출력', file=sys.stderr)
        sys.exit(1)
