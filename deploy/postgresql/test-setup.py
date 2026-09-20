#!/usr/bin/env python3
"""Opt-in integration verification; only disposable files, credentials and Compose project."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def rejected(action):
    try:
        action()
    except (OSError, ValueError):
        return
    raise AssertionError('EXPECTED_REJECTION')


server = module('install-server')
client = module('install-from-mac')
project = 'blariyo-dbtest-' + secrets.token_hex(6)
temporary = Path(tempfile.mkdtemp(prefix='blariyo-compose-', dir='/private/tmp'))
base = temporary / 'postgresql'
compose = ['docker', 'compose', '-p', project, '-f', str(base / 'compose.yaml')]
stage = 'local input checks'
exit_code = 0
try:
    inputs = temporary / 'inputs'
    inputs.mkdir(mode=0o700)
    passwords = {role: secrets.token_hex(32) for role in server.ROLES}
    for role, value in passwords.items():
        server.write_new(inputs / (role + '-password'), value.encode(), 0o600)
    payload = client.payload_from(HERE, inputs, 'synthetic-host')
    os.chmod(inputs / 'app-password', 0o644)
    rejected(lambda: client.payload_from(HERE, inputs, 'synthetic-host'))
    os.chmod(inputs / 'app-password', 0o600)
    bad = dict(payload, passwords=dict(passwords, app=passwords['backup']))
    rejected(lambda: server.validate(bad))
    unmanaged = temporary / 'unmanaged'
    unmanaged.mkdir(mode=0o700)
    rejected(lambda: server.prepare_files(unmanaged, payload))
    print('PASS 입력 검증 — 잘못된 파일 권한·중복 비밀번호·기존 비관리 디렉터리 거부', flush=True)

    stage = 'Compose installation'
    # Compose explicitly selects the same amd64 image as the user's x86_64 server.
    server.install(base, project, payload)
    stage = 'image architecture'
    snapshot = {role: (base / 'secrets' / (role + '-password')).read_bytes() for role in server.ROLES}
    cid = server.run(compose + ['ps', '-q', 'postgresql']).stdout.decode().strip()
    # Docker Desktop's image store can inspect the native member of a multi-platform index.
    # Verify the running container, not the default image-store member.
    assert server.run(['docker', 'exec', cid, 'uname', '-m']).stdout.strip() == b'x86_64'
    config = json.loads(server.run(compose + ['config', '--format', 'json']).stdout)
    assert config['services']['postgresql']['platform'] == 'linux/amd64'
    stage = 'PostgreSQL resource settings'
    admin = ['docker', 'exec', '-i', '--user', 'postgres', cid, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'blariyo']
    assert server.run(admin, b"SELECT current_setting('shared_buffers'),current_setting('work_mem'),current_setting('maintenance_work_mem'),current_setting('max_connections');").stdout.strip() == b'192MB|4MB|64MB|30'
    server.run(admin, b'CREATE TABLE public.setup_persistence_probe(id int); INSERT INTO public.setup_persistence_probe VALUES (42);')

    stage = 'repeat and credential mismatch rejection'
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        server.install(base, project, payload)
    for secret in passwords.values():
        assert secret not in output.getvalue()
    bad = dict(payload, passwords=dict(passwords, app=secrets.token_hex(32)))
    rejected(lambda: server.install(base, project, bad))
    assert snapshot == {role: (base / 'secrets' / (role + '-password')).read_bytes() for role in server.ROLES}
    print('PASS 재실행 — 기존 DB·비밀번호 유지, 다른 비밀번호로 덮어쓰기 거부', flush=True)

    stage = 'container recreation and persistence'
    server.run(compose + ['up', '-d', '--force-recreate', '--wait', '--wait-timeout', '120', 'postgresql'])
    new_cid = server.run(compose + ['ps', '-q', 'postgresql']).stdout.decode().strip()
    assert new_cid != cid
    admin[5] = new_cid
    assert server.run(admin, b'SELECT id FROM public.setup_persistence_probe').stdout.strip() == b'42'
    server.install(base, project, payload)
    print('PASS linux/amd64 Compose 실행 · 자원값 · container 재생성 후 데이터·역할 보존', flush=True)
except Exception:
    print('FAIL setup verification: ' + stage + ' (오류 원문·비밀값 비출력)', file=sys.stderr)
    exit_code = 1
finally:
    # This random project belongs exclusively to this test; never used by the installation code.
    if (base / 'compose.yaml').exists():
        result = subprocess.run(compose + ['down', '--volumes', '--timeout', '30'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode:
            print('FAIL fixture cleanup: ' + project, file=sys.stderr)
            exit_code = 1
    shutil.rmtree(temporary)
sys.exit(exit_code)
