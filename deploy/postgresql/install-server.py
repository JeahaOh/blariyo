#!/usr/bin/env python3
"""Receive a reviewed setup payload over SSH stdin; install only PostgreSQL and roles."""
import json
import os
from pathlib import Path
import re
import secrets
import socket
import stat
import subprocess
import sys

FILES = ('compose.yaml', 'pg_hba.conf', 'create-roles.py', 'create-roles.sql', 'apply-privileges.sql')
ROLES = ('app', 'migrator', 'backup')
MARKER = b'blariyo-postgresql-setup-v1\n'


def run(args, data=None, allow_failure=False):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
    if result.returncode and not allow_failure:
        raise ValueError('COMMAND_FAILED')
    return result


def validate(payload):
    if not isinstance(payload, dict) or set(payload) != {'files', 'passwords', 'expected_hostname'}:
        raise ValueError('PAYLOAD_INVALID')
    if not isinstance(payload['expected_hostname'], str) or not re.fullmatch(r'[a-zA-Z0-9.-]+', payload['expected_hostname']):
        raise ValueError('HOSTNAME_INVALID')
    if not isinstance(payload['files'], dict) or set(payload['files']) != set(FILES):
        raise ValueError('FILES_INVALID')
    if any(not isinstance(value, str) or len(value) > 100000 for value in payload['files'].values()):
        raise ValueError('FILE_CONTENT_INVALID')
    passwords = payload['passwords']
    if not isinstance(passwords, dict) or set(passwords) != set(ROLES):
        raise ValueError('PASSWORDS_INVALID')
    if any(not isinstance(value, str) or not re.fullmatch('[a-f0-9]{64}', value) for value in passwords.values()):
        raise ValueError('PASSWORD_FORMAT_INVALID')
    if len(set(passwords.values())) != 3:
        raise ValueError('PASSWORDS_MUST_DIFFER')


def checked_file(path, mode):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != mode:
        raise ValueError('EXISTING_FILE_UNSAFE')
    return path.read_bytes()


def write_new(path, content, mode):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(path, mode)


def prepare_files(base, payload):
    # Exclusive creation and marker permit retries without replacing files or passwords.
    if not base.exists():
        base.mkdir(mode=0o700)
        write_new(base / '.managed', MARKER, 0o600)
    info = base.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError('EXISTING_DIRECTORY_UNSAFE')
    if checked_file(base / '.managed', 0o600) != MARKER:
        raise ValueError('UNMANAGED_DIRECTORY')
    wanted = {name: (payload['files'][name].encode(), 0o644) for name in FILES}
    secret_dir = base / 'secrets'
    if not secret_dir.exists():
        secret_dir.mkdir(mode=0o700)
    info = secret_dir.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError('SECRET_DIRECTORY_UNSAFE')
    for role in ROLES:
        wanted[f'secrets/{role}-password'] = (payload['passwords'][role].encode(), 0o600)
    # Check all existing inputs before filling any missing files.
    for name, (content, mode) in wanted.items():
        path = base / name
        if path.exists() or path.is_symlink():
            if checked_file(path, mode) != content:
                raise ValueError('EXISTING_INPUT_DIFFERS')
    bootstrap = secret_dir / 'bootstrap-password'
    if bootstrap.exists() or bootstrap.is_symlink():
        value = checked_file(bootstrap, 0o600).decode('ascii')
        if not re.fullmatch('[a-f0-9]{64}', value) or value in payload['passwords'].values():
            raise ValueError('BOOTSTRAP_SECRET_INVALID')
    else:
        write_new(bootstrap, secrets.token_hex(32).encode(), 0o600)
    for name, (content, mode) in wanted.items():
        if not (base / name).exists():
            write_new(base / name, content, mode)


def install(base, project, payload):
    validate(payload)
    if not re.fullmatch(r'blariyo-(?:db|dbtest-[a-f0-9]{12})', project):
        raise ValueError('PROJECT_INVALID')
    run(['docker', 'compose', 'version'])
    # No taking ownership of a pre-existing untracked volume/network/container.
    for kind, name in [('volume', project + '_pgdata'), ('network', project + '_data')]:
        result = run(['docker', kind, 'inspect', name], allow_failure=True)
        if result.returncode == 0:
            if not base.exists():
                raise ValueError('EXISTING_DOCKER_RESOURCE')
            item = json.loads(result.stdout)[0]
            if item.get('Labels', {}).get('com.docker.compose.project') != project:
                raise ValueError('DOCKER_RESOURCE_OWNER_MISMATCH')
    containers = run(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project]).stdout.split()
    if containers and not base.exists():
        raise ValueError('EXISTING_CONTAINER')
    for container in containers:
        info = json.loads(run(['docker', 'inspect', container.decode()]).stdout)[0]
        if info['Config']['Labels'].get('com.docker.compose.service') != 'postgresql':
            raise ValueError('UNEXPECTED_PROJECT_SERVICE')
    prepare_files(base, payload)
    compose = ['docker', 'compose', '--project-name', project, '--project-directory', str(base), '-f', str(base / 'compose.yaml')]
    run(compose + ['config', '--quiet'])
    print('진행 PostgreSQL image 준비 — 기존 Tunnel 유지', flush=True)
    run(compose + ['pull', 'postgresql'])
    run(compose + ['up', '-d', '--wait', '--wait-timeout', '120', 'postgresql'])
    container = run(compose + ['ps', '-q', 'postgresql']).stdout.decode().strip()
    if not re.fullmatch('[a-f0-9]{64}', container):
        raise ValueError('CONTAINER_ID_INVALID')
    info = json.loads(run(['docker', 'inspect', container]).stdout)[0]
    if info['HostConfig'].get('PortBindings') or info['HostConfig'].get('PublishAllPorts'):
        raise ValueError('UNEXPECTED_PUBLISHED_PORT')
    if info['HostConfig']['Memory'] != 768 * 1024 * 1024:
        raise ValueError('MEMORY_LIMIT_MISMATCH')
    network = json.loads(run(['docker', 'network', 'inspect', project + '_data']).stdout)[0]
    if not network['Internal'] or set(info['NetworkSettings']['Networks']) != {project + '_data'}:
        raise ValueError('NETWORK_BOUNDARY_MISMATCH')
    print('PASS PostgreSQL healthy · host port 없음 · 내부 data network · memory 768MiB', flush=True)
    admin = ['docker', 'exec', '-i', '--user', 'postgres', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'blariyo']
    count = run(admin, b"SELECT count(*) FROM pg_roles WHERE rolname IN ('blariyo_app','blariyo_migrator','blariyo_backup');").stdout.strip()
    if count == b'0':
        run(['python3', str(base / 'create-roles.py'), '--container', container, '--secrets-dir', str(base / 'secrets')])
    elif count != b'3':
        raise ValueError('PARTIAL_ROLE_STATE')
    flags = run(admin, b"SELECT count(*) FROM pg_roles WHERE rolname IN ('blariyo_app','blariyo_migrator','blariyo_backup') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls);").stdout.strip()
    if flags != b'0':
        raise ValueError('ROLE_FLAGS_INVALID')
    for role in ROLES:
        script = 'umask 077; file=$(mktemp); trap \'rm -f "$file"\' EXIT; cat > "$file"; PGPASSFILE="$file" psql -X -w -qAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -U blariyo_' + role + ' -d blariyo -c "SELECT current_user"'
        pgpass = f"127.0.0.1:5432:blariyo:blariyo_{role}:{payload['passwords'][role]}\n"
        result = run(['docker', 'exec', '-i', '--user', 'postgres', container, 'sh', '-eu', '-c', script], pgpass.encode())
        if result.stdout.strip() != ('blariyo_' + role).encode():
            raise ValueError('ROLE_CONNECTION_FAILED')
    print('PASS DB 역할 3개 · 각각의 비밀번호로 TCP 접속 성공 · 기존 비밀번호 유지', flush=True)
    print('완료 범위: PostgreSQL 설치·영속 volume·역할별 접속. 앱 migration·테이블 권한·앱 배포·원격 백업은 다음 단계입니다.', flush=True)


def main():
    if os.geteuid() != 0 or sys.platform != 'linux':
        raise ValueError('LINUX_ROOT_REQUIRED')
    if os.uname().machine != 'x86_64':
        raise ValueError('X86_64_SERVER_REQUIRED')
    payload = json.loads(sys.stdin.buffer.read(600001))
    validate(payload)
    if socket.gethostname() != payload['expected_hostname']:
        raise ValueError('SERVER_HOSTNAME_MISMATCH')
    parent = Path('/opt/blariyo')
    if not parent.exists():
        parent.mkdir(mode=0o700)
    info = parent.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise ValueError('PARENT_DIRECTORY_UNSAFE')
    install(parent / 'postgresql', 'blariyo-db', payload)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[A-Z_]+', str(error)) else 'SETUP_FAILED'
        print('FAIL DB 설치 — ' + code + ' (오류 원문·비밀값 비출력, 자동 삭제·초기화 없음)', file=sys.stderr)
        sys.exit(1)
