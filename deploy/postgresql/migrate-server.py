#!/usr/bin/env python3
"""Initial schema installation only. Existing databases are never reset or downgraded."""
import hashlib
import fcntl
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import socket
import stat
import subprocess
import sys


def run(args, data=None, code='COMMAND_FAILED', allow_failure=False):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
    if result.returncode and not allow_failure:
        raise ValueError(code)
    return result


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fingerprint(info):
    # Docker image stores differ in whether .Id identifies the index or image config.
    # Inspect also omits legacy default fields (API 1.50+) and empty Config fields
    # (Docker 29+). Normalize only documented empty/default representations;
    # preserve non-default and unknown fields so real differences still fail.
    config = dict(info['Config'])
    defaults = {
        'Hostname': ('',), 'Domainname': ('',), 'Image': ('',), 'MacAddress': ('',),
        'AttachStdin': (False,), 'AttachStdout': (False,), 'AttachStderr': (False,),
        'Tty': (False,), 'OpenStdin': (False,), 'StdinOnce': (False,),
        'NetworkDisabled': (False,), 'StopTimeout': (None, 0),
        'Cmd': (None, []), 'Entrypoint': (None, []), 'Env': (None, []),
        'Labels': (None, {}), 'OnBuild': (None, []), 'Volumes': (None, {}),
        'User': ('',), 'WorkingDir': ('',),
    }
    for key, values in defaults.items():
        if key in config and any(type(config[key]) is type(value) and config[key] == value for value in values):
            del config[key]
    value = {key: info[key] for key in ('Architecture', 'Os', 'RootFS')}
    value['Config'] = config
    return digest(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())


def checked(path, mode):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != mode:
        raise ValueError('FILE_UNSAFE')
    return path.read_bytes()


def new_file(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def validate(payload):
    if set(payload) != {'image', 'fingerprint', 'migrations', 'grants_sha256', 'expected_hostname'}:
        raise ValueError('PAYLOAD_INVALID')
    if not re.fullmatch(r'blariyo-api:db-init-[a-z0-9-]+', payload['image']):
        raise ValueError('IMAGE_NAME_INVALID')
    if not re.fullmatch(r'[a-zA-Z0-9.-]+', payload['expected_hostname']):
        raise ValueError('HOSTNAME_INVALID')
    for value in (payload['fingerprint'], payload['grants_sha256']):
        if not re.fullmatch('[a-f0-9]{64}', value):
            raise ValueError('HASH_INVALID')
    rows = payload['migrations']
    if not isinstance(rows, list) or [row[0] for row in rows] != ['V001', 'V002', 'V003', 'V004', 'V005']:
        raise ValueError('INITIAL_MIGRATIONS_REQUIRED')
    for version, filename, checksum in rows:
        if not re.fullmatch(version + r'__[a-z0-9_]+\.sql', filename) or not re.fullmatch('[a-f0-9]{64}', checksum):
            raise ValueError('MIGRATION_INVALID')


def migrate(base, project, payload):
    validate(payload)
    if not re.fullmatch(r'blariyo-(?:db|dbtest-[a-f0-9]{12})', project):
        raise ValueError('PROJECT_INVALID')
    info = base.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError('DIRECTORY_UNSAFE')
    if checked(base / '.managed', 0o600) != b'blariyo-postgresql-setup-v1\n':
        raise ValueError('UNMANAGED_DATABASE')
    secret_info = (base / 'secrets').lstat()
    if not stat.S_ISDIR(secret_info.st_mode) or secret_info.st_uid != os.geteuid() or stat.S_IMODE(secret_info.st_mode) != 0o700:
        raise ValueError('SECRET_DIRECTORY_UNSAFE')
    grants = checked(base / 'apply-privileges.sql', 0o644)
    if digest(grants) != payload['grants_sha256']:
        raise ValueError('GRANTS_CHECKSUM_MISMATCH')
    passwords = {role: checked(base / 'secrets' / (role + '-password'), 0o600).decode() for role in ('app', 'migrator', 'backup')}
    if any(not re.fullmatch('[a-f0-9]{64}', value) for value in passwords.values()) or len(set(passwords.values())) != 3:
        raise ValueError('PASSWORD_INVALID')
    image_info = json.loads(run(['docker', 'image', 'inspect', payload['image']]).stdout)[0]
    if image_info['Architecture'] != 'amd64' or image_info['Os'] != 'linux' or fingerprint(image_info) != payload['fingerprint']:
        raise ValueError('IMAGE_FINGERPRINT_MISMATCH')
    image = image_info['Id']
    compose = ['docker', 'compose', '-p', project, '-f', str(base / 'compose.yaml')]
    cid = run(compose + ['ps', '-q', 'postgresql']).stdout.decode().strip()
    if not re.fullmatch('[a-f0-9]{64}', cid):
        raise ValueError('DATABASE_CONTAINER_MISSING')
    db = json.loads(run(['docker', 'inspect', cid]).stdout)[0]
    network_name = project + '_data'
    network = json.loads(run(['docker', 'network', 'inspect', network_name]).stdout)[0]
    if db['State'].get('Health', {}).get('Status') != 'healthy' or db['HostConfig'].get('PortBindings') or db['HostConfig'].get('PublishAllPorts'):
        raise ValueError('DATABASE_BOUNDARY_INVALID')
    if not network['Internal'] or set(network.get('Containers', {})) != {cid} or set(db['NetworkSettings']['Networks']) != {network_name}:
        raise ValueError('INITIAL_DB_ONLY_NETWORK_REQUIRED')
    if db['Config']['Labels'].get('com.docker.compose.project') != project:
        raise ValueError('DATABASE_OWNER_MISMATCH')
    admin = ['docker', 'exec', '-i', '--user', 'postgres', cid, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'blariyo']
    def query(sql):
        return run(admin, sql.encode()).stdout.strip()
    if query("SELECT count(*) FROM pg_stat_activity WHERE datname='blariyo' AND usename IN ('blariyo_app','blariyo_migrator','blariyo_backup')") != b'0':
        raise ValueError('DATABASE_CLIENTS_ACTIVE')
    identity = json.dumps(payload, sort_keys=True).encode()
    marker = base / '.initial-migration.json'
    if marker.exists() or marker.is_symlink():
        if checked(marker, 0o600) != identity:
            raise ValueError('INITIAL_MIGRATION_BUNDLE_CHANGED')
    else:
        if query("SELECT count(*) FROM pg_namespace WHERE nspname IN ('content','legal','ops','collect')") != b'0':
            raise ValueError('INITIAL_EMPTY_SCHEMA_REQUIRED')
        new_file(marker, identity)
    print('PASS 대상 DB·내부 network·amd64 image·초기 migration 묶음 확인', flush=True)

    # Initial provisioning checkpoint through the local peer-authenticated administrator.
    # Not the scheduled backup role or encrypted off-server backup implementation.
    checkpoint = base / ('before-initial-migration-' + secrets.token_hex(6) + '.dump')
    fd = os.open(checkpoint, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as output:
        saved = subprocess.run(['docker', 'exec', '--user', 'postgres', cid, 'pg_dump', '-U', 'postgres', '-d', 'blariyo', '-Fc'], stdout=output, stderr=subprocess.PIPE, timeout=600)
        output.flush()
        os.fsync(output.fileno())
    if saved.returncode or checkpoint.stat().st_size == 0:
        raise ValueError('PRE_MIGRATION_DUMP_FAILED')
    with checkpoint.open('rb') as source:
        listing = subprocess.run(['docker', 'exec', '-i', '--user', 'postgres', cid, 'pg_restore', '--list'], stdin=source, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60)
    if listing.returncode:
        raise ValueError('PRE_MIGRATION_DUMP_INVALID')
    print('PASS 변경 전 DB 사본 저장 — ' + str(checkpoint), flush=True)

    volume = 'blariyo-migration-secret-' + secrets.token_hex(6)
    container = 'blariyo-initial-migration-' + secrets.token_hex(6)
    run(['docker', 'volume', 'create', volume])
    try:
        run(['docker', 'run', '--rm', '--platform', 'linux/amd64', '--pull', 'never', '--network', 'none', '--user', '0:0', '-i', '-v', volume + ':/secret', image,
             'sh', '-eu', '-c', 'umask 077; cat > /secret/migrator-password; chown 1000:1000 /secret/migrator-password'], passwords['migrator'].encode())
        run(['docker', 'run', '--rm', '--name', container, '--platform', 'linux/amd64', '--pull', 'never', '--network', network_name,
             '--user', '1000:1000', '--memory', '256m', '--memory-swap', '384m', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
             '-v', volume + ':/run/db-secrets:ro', '-e', 'NODE_ENV=production', '-e', 'DB_HOST=postgresql', '-e', 'DB_NAME=blariyo',
             '-e', 'MIGRATION_DB_USER=blariyo_migrator', '-e', 'MIGRATION_DB_PASSWORD_FILE=/run/db-secrets/migrator-password',
             image, 'node', 'apps/api/dist/commands/migrate.js', 'up'], code='APP_MIGRATION_FAILED')
    finally:
        run(['docker', 'rm', '-f', container], allow_failure=True)
        run(['docker', 'volume', 'rm', volume], code='TEMP_SECRET_CLEANUP_FAILED')
    rows = query("SELECT version || '|' || filename || '|' || encode(checksum_sha256,'hex') FROM ops.schema_migration ORDER BY version").decode().splitlines()
    if rows != ['|'.join(row) for row in payload['migrations']]:
        raise ValueError('MIGRATION_LEDGER_MISMATCH')
    print('PASS 앱 migration V001–V005 · ledger SHA-256 일치', flush=True)

    def role_query(role, sql, allow_failure=False):
        pgpass = f'127.0.0.1:5432:blariyo:blariyo_{role}:{passwords[role]}\n'.encode()
        script = 'umask 077; file=$(mktemp); trap \'rm -f "$file"\' EXIT; cat > "$file"; PGPASSFILE="$file" psql -X -w -qAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -U blariyo_' + role + ' -d blariyo -c ' + shlex.quote(sql)
        return run(['docker', 'exec', '-i', '--user', 'postgres', cid, 'sh', '-eu', '-c', script], pgpass, code='ROLE_SQL_FAILED', allow_failure=allow_failure)
    sql = '\n'.join(line for line in grants.decode().splitlines() if not line.startswith('\\'))
    role_query('migrator', sql)
    if role_query('app', "SELECT ops.is_schema_ready('V005'); SELECT count(*) >= 0 FROM content.board;").stdout.strip() != b't\nt':
        raise ValueError('APP_READINESS_FAILED')
    for sql in ('SELECT * FROM ops.schema_migration LIMIT 0', 'BEGIN; CREATE TABLE content.__access_probe(id int); ROLLBACK;'):
        denied = role_query('app', sql, allow_failure=True)
        if not denied.returncode or b'permission denied' not in denied.stderr:
            raise ValueError('APP_RESTRICTION_FAILED')
    if role_query('backup', 'SELECT count(*) FROM ops.schema_migration').stdout.strip() != b'5':
        raise ValueError('BACKUP_READ_FAILED')
    denied = role_query('backup', 'BEGIN; SET TRANSACTION READ WRITE; DELETE FROM content.board WHERE false; ROLLBACK;', allow_failure=True)
    if not denied.returncode or b'permission denied' not in denied.stderr:
        raise ValueError('BACKUP_WRITE_NOT_DENIED')
    if query("SELECT count(*) FROM pg_namespace WHERE nspname IN ('content','legal','ops','collect') AND nspowner=(SELECT oid FROM pg_roles WHERE rolname='blariyo_migrator')") != b'4':
        raise ValueError('SCHEMA_OWNER_MISMATCH')
    print('PASS app readiness·테이블 조회 · DDL/ledger 접근 차단 · backup 조회/쓰기 차단', flush=True)
    print('완료 범위: 초기 앱 migration·테이블 권한·역할별 SQL 확인. 앱 배포·실제 관리자 로그인·R2 원격 백업은 미검증입니다.', flush=True)


def main():
    if os.geteuid() != 0 or sys.platform != 'linux' or os.uname().machine != 'x86_64':
        raise ValueError('LINUX_X86_64_ROOT_REQUIRED')
    payload = json.loads(sys.stdin.buffer.read(100001))
    validate(payload)
    if socket.gethostname() != payload['expected_hostname']:
        raise ValueError('SERVER_HOSTNAME_MISMATCH')
    base = Path('/opt/blariyo/postgresql')
    fd = os.open(base / '.initial-migration.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w'):
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        migrate(base, 'blariyo-db', payload)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[A-Z_]+', str(error)) else 'INITIAL_MIGRATION_FAILED'
        print('FAIL ' + code + ' — 오류 원문·비밀값 비출력, 자동 DB 삭제·rollback 없음', file=sys.stderr)
        sys.exit(1)
