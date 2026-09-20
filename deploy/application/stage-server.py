#!/usr/bin/env python3
"""Receive a checked release over stdin; install files/images, never start application services."""
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import stat
import subprocess
import sys
import tempfile

FILES = {'api.env', 'web.env', 'compose.yaml', 'bundle.json', 'secrets/app-password', 'secrets/admin-operators.json'}
SECRET_UID = 1000
SECRET_GID = 1000
MARKER = b'blariyo-application-stage-v1\n'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def run(args, data=None):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
    if result.returncode:
        raise ValueError('STAGE_COMMAND_FAILED')
    return result.stdout


def private(path, directory=False, uid=None):
    info = path.lstat()
    wanted = stat.S_ISDIR if directory else stat.S_ISREG
    if not wanted(info.st_mode) or info.st_uid != (os.geteuid() if uid is None else uid) or stat.S_IMODE(info.st_mode) != (0o700 if directory else 0o600):
        raise ValueError('UNSAFE_STAGE_PATH')
    return path


def write(path, data, secret=False):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())
        if secret:
            os.fchown(output.fileno(), SECRET_UID, SECRET_GID)


def validate(payload):
    if set(payload) != {'schemaVersion', 'expectedHostname', 'archiveSha256', 'archiveBytes', 'images', 'files', 'composeSha256'} or payload['schemaVersion'] != 1:
        raise ValueError('INVALID_STAGE_PAYLOAD')
    if not re.fullmatch(r'[a-zA-Z0-9.-]+', payload['expectedHostname']):
        raise ValueError('INVALID_HOSTNAME')
    if not re.fullmatch('[a-f0-9]{64}', payload['archiveSha256']) or not re.fullmatch('[a-f0-9]{64}', payload['composeSha256']):
        raise ValueError('INVALID_CHECKSUM')
    if type(payload['archiveBytes']) is not int or not 0 < payload['archiveBytes'] <= 2 * 1024**3:
        raise ValueError('INVALID_ARCHIVE_SIZE')
    if set(payload['files']) != FILES or set(payload['images']) != {'api', 'web'}:
        raise ValueError('INVALID_STAGE_SCOPE')
    files = {name: base64.b64decode(value, validate=True) for name, value in payload['files'].items()}
    if any(len(value) > 65536 for value in files.values()) or digest(files['compose.yaml']) != payload['composeSha256']:
        raise ValueError('INVALID_STAGE_FILES')
    meta = json.loads(files['bundle.json'])
    if (meta.get('schemaVersion'), meta.get('kind'), meta.get('productionReady'), meta.get('serverSecretUid'), meta.get('serverSecretGid')) != (1, 'runtime-inputs-only', False, 1000, 1000):
        raise ValueError('INVALID_RUNTIME_BUNDLE')
    for role, item in payload['images'].items():
        if set(item) != {'tag', 'fingerprint'} or not re.fullmatch('blariyo-' + role + r':candidate-[a-z0-9_-]+', item['tag']) or not re.fullmatch('[a-f0-9]{64}', item['fingerprint']):
            raise ValueError('INVALID_IMAGE_IDENTITY')
    return files


def receive_archive(source, path, expected_size, expected_hash):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    checksum = hashlib.sha256()
    remaining = expected_size
    with os.fdopen(fd, 'wb') as target:
        while remaining:
            data = source.read(min(1024 * 1024, remaining))
            if not data:
                raise ValueError('ARCHIVE_TRANSFER_TRUNCATED')
            checksum.update(data)
            target.write(data)
            remaining -= len(data)
        target.flush()
        os.fsync(target.fileno())
    if source.read(1) or checksum.hexdigest() != expected_hash:
        raise ValueError('ARCHIVE_TRANSFER_MISMATCH')


def inspect_images(payload):
    identities = {}
    for role, item in payload['images'].items():
        info = json.loads(run(['docker', 'image', 'inspect', item['tag']]))[0]
        # fingerprint is injected from the existing, regression-tested DB installer helper.
        if info['Os'] != 'linux' or info['Architecture'] != 'amd64' or fingerprint(info) != item['fingerprint']:
            raise ValueError('LOADED_IMAGE_MISMATCH')
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', info['Id']):
            raise ValueError('INVALID_LOADED_IMAGE_ID')
        identities[role] = info['Id']
    return identities


def probe(directory, identities):
    compose = ['docker', 'compose', '--env-file', str(directory / 'images.env'), '-f', str(directory / 'compose.yaml')]
    run(compose + ['config', '--quiet'])
    for role, filename in [('api', 'app-password'), ('web', 'admin-operators.json')]:
        target = '/run/secrets/' + filename
        script = "const fs=require('fs');const p=" + json.dumps(target) + ";const s=fs.statSync(p);if(process.getuid()!==1000||s.uid!==1000||s.gid!==1000||(s.mode&511)!==384)process.exit(2);const v=fs.readFileSync(p,'utf8');"
        script += "if(!/^[a-f0-9]{64}\\n?$/.test(v))process.exit(3);" if role == 'api' else "if(!Array.isArray(JSON.parse(v))||!JSON.parse(v).some(x=>x.active===true))process.exit(3);"
        # The image's normal server command is replaced with this read-only offline probe.
        run(['docker', 'run', '--rm', '--pull', 'never', '--platform', 'linux/amd64', '--network', 'none', '--user', '1000:1000',
             '--memory', '128m', '--memory-swap', '128m', '--pids-limit', '32', '--read-only', '--cap-drop', 'ALL',
             '--security-opt', 'no-new-privileges:true', '--mount', 'type=bind,src=' + str(directory / 'secrets' / filename) + ',dst=' + target + ',readonly',
             '--entrypoint', 'node', identities[role], '-e', script])


def stage(base, payload, source):
    files = validate(payload)
    if not base.exists():
        base.mkdir(mode=0o700)
        write(base / '.managed', MARKER)
    private(base, True)
    if private(base / '.managed').read_bytes() != MARKER:
        raise ValueError('UNMANAGED_APPLICATION_DIRECTORY')
    lock = os.open(base / '.stage.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock, 'w'):
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # Hash includes actual config bytes. Never replace a previously staged release.
        release = base / ('release-' + digest(json.dumps(payload, sort_keys=True).encode())[:24])
        if release.exists() or release.is_symlink():
            private(release, True)
            private(release / 'secrets', True)
            record = json.loads(private(release / 'stage.json').read_bytes())
            if record.get('status') != 'STAGED_NO_SERVICES':
                raise ValueError('INCOMPLETE_STAGE')
            for name, value in files.items():
                if private(release / name, uid=SECRET_UID if name.startswith('secrets/') else None).read_bytes() != value:
                    raise ValueError('EXISTING_STAGE_CHANGED')
            # Drain and verify incoming archive before reporting a retry as successful.
            with tempfile.TemporaryDirectory(prefix='.receive-', dir=base) as incoming:
                receive_archive(source, Path(incoming) / 'images.tar', payload['archiveBytes'], payload['archiveSha256'])
            identities = inspect_images(payload)
            expected = ''.join('BLARIYO_' + role.upper() + '_IMAGE=' + identities[role] + '\n' for role in ('api', 'web')).encode()
            if private(release / 'images.env').read_bytes() != expected:
                raise ValueError('EXISTING_IMAGE_BINDING_CHANGED')
            probe(release, identities)
            return release
        if shutil.disk_usage(base).free < payload['archiveBytes'] * 4 + 512 * 1024**2:
            raise ValueError('INSUFFICIENT_DISK')
        candidate = Path(tempfile.mkdtemp(prefix='.incomplete-', dir=base))
        (candidate / 'secrets').mkdir(mode=0o700)
        receive_archive(source, candidate / 'images.tar', payload['archiveBytes'], payload['archiveSha256'])
        print('PASS 전송 archive 크기·SHA-256 일치', flush=True)
        # Refuse to overwrite an existing tag with a different image.
        for item in payload['images'].values():
            existing = subprocess.run(['docker', 'image', 'inspect', item['tag']], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            if existing.returncode == 0 and fingerprint(json.loads(existing.stdout)[0]) != item['fingerprint']:
                raise ValueError('EXISTING_IMAGE_TAG_CONFLICT')
        with (candidate / 'images.tar').open('rb') as archive:
            result = subprocess.run(['docker', 'image', 'load', '--quiet'], stdin=archive, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=900)
        if result.returncode:
            raise ValueError('IMAGE_LOAD_FAILED')
        identities = inspect_images(payload)
        for name, value in files.items():
            write(candidate / name, value, name.startswith('secrets/'))
        image_env = ''.join('BLARIYO_' + role.upper() + '_IMAGE=' + identities[role] + '\n' for role in ('api', 'web'))
        write(candidate / 'images.env', image_env.encode())
        probe(candidate, identities)
        record = {'schemaVersion': 1, 'status': 'STAGED_NO_SERVICES', 'archiveSha256': payload['archiveSha256'],
                  'images': identities, 'productionReady': False, 'servicesStarted': False, 'gatewayConnected': False}
        write(candidate / 'stage.json', json.dumps(record, indent=2).encode() + b'\n')
        candidate.rename(release)
        return release


def main():
    if os.geteuid() != 0 or sys.platform != 'linux' or os.uname().machine != 'x86_64':
        raise ValueError('LINUX_AMD64_ROOT_REQUIRED')
    header = sys.stdin.buffer.readline(262145)
    if len(header) > 262144 or not header.endswith(b'\n'):
        raise ValueError('INVALID_TRANSFER_HEADER')
    payload = json.loads(header)
    validate(payload)
    if socket.gethostname() != payload['expectedHostname']:
        raise ValueError('SERVER_HOSTNAME_MISMATCH')
    db = Path('/opt/blariyo/postgresql')
    private(db, True)
    if private(db / '.managed').read_bytes() != b'blariyo-postgresql-setup-v1\n':
        raise ValueError('MANAGED_DATABASE_REQUIRED')
    private(db / '.initial-migration.json')
    private(db / 'secrets', True)
    files = validate(payload)
    if files['secrets/app-password'].strip() != private(db / 'secrets/app-password').read_bytes().strip():
        raise ValueError('EXISTING_DB_PASSWORD_MISMATCH')
    db_ids = run(['docker', 'ps', '-q', '--no-trunc', '--filter', 'label=com.docker.compose.project=blariyo-db',
                  '--filter', 'label=com.docker.compose.service=postgresql']).decode().split()
    if len(db_ids) != 1:
        raise ValueError('DATABASE_CONTAINER_MISSING')
    db_info = json.loads(run(['docker', 'inspect', db_ids[0]]))[0]
    if db_info['State'].get('Health', {}).get('Status') != 'healthy' or db_info['HostConfig'].get('PortBindings'):
        raise ValueError('DATABASE_BOUNDARY_INVALID')
    result = stage(Path('/opt/blariyo/application'), payload, sys.stdin.buffer)
    print('PASS amd64 Web·Core image · Compose 구문 · UID 1000 secret 읽기', flush=True)
    print('설치 폴더: ' + str(result), flush=True)
    print('PASS 서버 보관 완료 — 앱 서비스 기동·정책 발행·Tunnel 연결은 수행하지 않았습니다.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[A-Z_]+', str(error)) else 'APPLICATION_STAGE_FAILED'
        print('FAIL ' + code + ' — 비밀값·오류 원문 비출력. 기존 DB·Tunnel 유지, 자동 rollback 없음.', file=sys.stderr)
        sys.exit(1)
