#!/usr/bin/env python3
"""Validate local setup; --install-db explicitly transfers DB files over an existing trusted SSH connection."""
import argparse
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import shlex
import stat
import subprocess
import sys


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.dont_write_bytecode = True
    spec.loader.exec_module(module)
    return module


def payload_from(directory, secret_directory, expected_hostname):
    server = load_module('blariyo_server_setup', directory / 'install-server.py')
    reader = load_module('blariyo_role_setup', directory / 'create-roles.py')
    info = secret_directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError('SECRET_DIRECTORY_PERMISSIONS')
    payload = {
        'files': {name: (directory / name).read_text() for name in server.FILES},
        'passwords': {role: reader.read_password(secret_directory / (role + '-password')) for role in server.ROLES},
        'expected_hostname': expected_hostname,
    }
    server.validate(payload)
    return payload


def find_key(explicit=None):
    candidates = [Path(explicit).expanduser()] if explicit else [
        Path.home() / 'task_list/LightsailDefaultKey-ap-northeast-2.pem',
        Path.home() / 'Library/Mobile Documents/com~apple~CloudDocs/blariyo/LightsailDefaultKey-ap-northeast-2.pem',
    ]
    for key in candidates:
        if key.is_file():
            info = key.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
                raise ValueError('SSH_KEY_PERMISSIONS')
            return key.resolve()
    raise ValueError('SSH_KEY_NOT_FOUND')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install-db', action='store_true')
    parser.add_argument('--host', required=True, help='current Lightsail public IP')
    parser.add_argument('--expected-hostname', default='ip-172-26-1-91')
    parser.add_argument('--key', help='optional existing SSH key path')
    args = parser.parse_args()
    ipaddress.ip_address(args.host)
    directory = Path(__file__).resolve().parent
    payload = payload_from(directory, Path.home() / '.config/blariyo/db-secrets', args.expected_hostname)
    key = find_key(args.key)
    print('PASS 로컬 DB 파일·키 파일 권한·설치 입력 확인 — 비밀값 비출력', flush=True)
    print('대상: ubuntu@' + args.host + ' / ' + args.expected_hostname + ' /opt/blariyo/postgresql', flush=True)
    if not args.install_db:
        print('검사만 완료했습니다. SSH 전송·서버 설치는 --install-db를 지정할 때 실행됩니다.')
        return
    print('진행 DB 설정·비밀번호 3개를 SSH 표준입력으로 전달합니다. 기존 Tunnel·DNS·방화벽은 변경하지 않습니다.', flush=True)
    remote_command = 'sudo -n python3 -u -c ' + shlex.quote((directory / 'install-server.py').read_text())
    result = subprocess.run([
        'ssh', '-T', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10',
        '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
        '-i', str(key), 'ubuntu@' + args.host, remote_command,
    ], input=json.dumps(payload).encode(), check=False)
    if result.returncode:
        raise ValueError('SSH_OR_SERVER_SETUP_FAILED')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        # Do not show secret-bearing parser/command exception text.
        safe = str(error) if isinstance(error, ValueError) and str(error).replace('_', '').isupper() and str(error).isascii() else 'LOCAL_SETUP_FAILED'
        print('FAIL ' + safe + ' — 비밀값은 출력하지 않았습니다.', file=sys.stderr)
        sys.exit(1)
