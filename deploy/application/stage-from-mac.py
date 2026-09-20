#!/usr/bin/env python3
"""Validate a release locally; --stage installs images/config, without starting the application."""
import argparse
import base64
import importlib.util
import inspect
import json
import ipaddress
import os
from pathlib import Path
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tarfile

HERE = Path(__file__).resolve().parent
DEFAULT_IMAGES = Path.home() / 'task_list/blariyo-app-images-20260920T005324Z-rhn14v8g'
DEFAULT_CONFIG = Path.home() / '.config/blariyo/application-config-W8Wwp5'
sys.dont_write_bytecode = True


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


images = module('blariyo_images', HERE / 'prepare-images.py')
server = module('blariyo_stage', HERE / 'stage-server.py')
migration = module('blariyo_migration', HERE.parent / 'postgresql/migrate-server.py')


def read_private(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 65536:
            raise ValueError('PRIVATE_INPUT_UNSAFE')
        return source.read(65537)


def raw_env(data):
    result = {}
    for line in data.decode().splitlines():
        name, sep, value = line.partition('=')
        if not sep or not re.fullmatch('[A-Z][A-Z0-9_]*', name) or name in result or '\x00' in value:
            raise ValueError('INVALID_RAW_ENV')
        result[name] = value
    return result


def check_config(directory):
    for path in (directory, directory / 'secrets'):
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError('PRIVATE_DIRECTORY_UNSAFE')
    if {p.relative_to(directory).as_posix() for p in directory.rglob('*') if not p.is_dir()} != server.FILES:
        raise ValueError('UNEXPECTED_RUNTIME_FILE')
    files = {name: read_private(directory / name) for name in server.FILES}
    if files['compose.yaml'] != (HERE / 'compose.yaml').read_bytes():
        raise ValueError('COMPOSE_CHANGED_RECREATE_INPUTS')
    api, web = raw_env(files['api.env']), raw_env(files['web.env'])
    if any(re.search(r'BACKUP|MIGRAT|R2_.*TOKEN|PGPASSWORD|DATABASE_URL', name) for name in api):
        raise ValueError('CORE_EXTRA_CREDENTIAL')
    if any(re.search(r'^R2_|^CACHE_|^DB_|^APP_DB_|^SERVICE_TOKEN$', name) for name in web):
        raise ValueError('WEB_EXTRA_CREDENTIAL')
    fixed_api = {'NODE_ENV': 'production', 'DB_HOST': 'postgresql', 'DB_NAME': 'blariyo', 'APP_DB_USER': 'blariyo_app',
                 'APP_DB_PASSWORD_FILE': '/run/secrets/app-password', 'STORAGE_MODE': 'r2', 'PORT': '4000',
                 'SITE_ORIGIN': 'https://blariyo.com', 'IMAGE_ORIGIN': 'https://media.blariyo.com'}
    fixed_web = {'NODE_ENV': 'production', 'NUXT_ADMIN_AUTH_MODE': 'access', 'NUXT_CORE_ORIGIN': 'http://api:4000',
                 'NUXT_ADMIN_OPERATORS_FILE': '/run/secrets/admin-operators.json', 'NUXT_TRUSTED_CLIENT_IP_HEADER': '',
                 'NUXT_LOCAL_ADMIN_TOKEN': '', 'NUXT_PUBLIC_GA4_ENABLED': 'false', 'NUXT_PUBLIC_KAKAO_ENABLED': 'false'}
    if any(api.get(k) != v for k, v in fixed_api.items()) or any(web.get(k) != v for k, v in fixed_web.items()):
        raise ValueError('RUNTIME_BOUNDARY_CHANGED')
    for token in (api.get('SERVICE_TOKEN', ''), web.get('NUXT_ACTOR_SECRET', '')):
        if not re.fullmatch('[a-f0-9]{64}', token):
            raise ValueError('INTERNAL_AUTH_INVALID')
    if api['SERVICE_TOKEN'] != web.get('NUXT_SERVICE_TOKEN') or api['SERVICE_TOKEN'] == web['NUXT_ACTOR_SECRET']:
        raise ValueError('INTERNAL_AUTH_MISMATCH')
    if not re.fullmatch(rb'[a-f0-9]{64}\n?', files['secrets/app-password']):
        raise ValueError('APP_PASSWORD_INVALID')
    operators = json.loads(files['secrets/admin-operators.json'])
    if not isinstance(operators, list) or not any(o.get('active') is True for o in operators):
        raise ValueError('ACTIVE_OPERATOR_REQUIRED')
    return files


def prepare(config, image_directory):
    files = check_config(config)
    meta = images.verify(image_directory)
    archive = image_directory / 'images.tar'
    if meta.get('archiveBytes') != archive.stat().st_size:
        raise ValueError('ARCHIVE_SIZE_MISMATCH')
    references = {}
    with tarfile.open(archive, 'r:') as bundle:
        entries = json.load(bundle.extractfile('manifest.json'))
        for role, item in meta['images'].items():
            entry = next(e for e in entries if item['tag'] in e['RepoTags'])
            if entry['RepoTags'] != [item['tag']]:
                raise ValueError('UNEXPECTED_ARCHIVE_TAG')
            config_image = json.load(bundle.extractfile(entry['Config']))
            info = {'Architecture': config_image['architecture'], 'Os': config_image['os'], 'Config': config_image['config'],
                    'RootFS': {'Type': config_image['rootfs']['type'], 'Layers': config_image['rootfs']['diff_ids']}}
            references[role] = {'tag': item['tag'], 'fingerprint': migration.fingerprint(info)}
    payload = {'schemaVersion': 1, 'expectedHostname': 'ip-172-26-1-91', 'archiveSha256': meta['archiveSha256'],
               'archiveBytes': archive.stat().st_size, 'images': references, 'composeSha256': images.digest(files['compose.yaml']),
               'files': {name: base64.b64encode(data).decode() for name, data in files.items()}}
    server.validate(payload)
    return payload, archive


def remote_code():
    # One authoritative normalization function, already tested against Docker 28/29 stores.
    prefix = 'import hashlib, json\n' + inspect.getsource(migration.digest) + '\n' + inspect.getsource(migration.fingerprint)
    return prefix + '\n' + (HERE / 'stage-server.py').read_text()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--stage', action='store_true')
    parser.add_argument('--key')
    parser.add_argument('--images', type=Path, default=DEFAULT_IMAGES)
    parser.add_argument('--config', type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()
    ipaddress.IPv4Address(args.host)
    payload, archive = prepare(args.config, args.images)
    key = module('blariyo_ssh', HERE.parent / 'postgresql/install-from-mac.py').find_key(args.key)
    print('PASS 로컬 runtime 파일·키 분리·Compose·amd64 archive 검증 — 비밀값 비출력', flush=True)
    print('대상: ubuntu@' + args.host + ' / ip-172-26-1-91 /opt/blariyo/application', flush=True)
    if not args.stage:
        print('로컬 검사 완료. --stage 지정 시 이미지·설정을 서버에 설치합니다. 앱 서비스는 시작하지 않습니다.')
        return
    ssh = ['ssh', '-T', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
           '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-i', str(key), 'ubuntu@' + args.host]
    print('진행 SSH로 설정·이미지 전달 — DB·Tunnel·DNS·방화벽 변경 없음', flush=True)
    # Header carries secrets only on encrypted stdin, never argv/environment or a temporary local file.
    process = subprocess.Popen(ssh + ['sudo -n python3 -u -c ' + shlex.quote(remote_code())], stdin=subprocess.PIPE)
    try:
        process.stdin.write(json.dumps(payload, separators=(',', ':')).encode() + b'\n')
        with archive.open('rb') as source:
            shutil.copyfileobj(source, process.stdin, 1024 * 1024)
        process.stdin.close()
        if process.wait(timeout=1800):
            raise ValueError('SERVER_STAGE_FAILED')
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=20)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[A-Z_]+', str(error)) else 'LOCAL_STAGE_CHECK_FAILED'
        print('FAIL ' + code + ' — 비밀값·오류 원문 비출력', file=sys.stderr)
        sys.exit(1)
