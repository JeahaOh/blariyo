#!/usr/bin/env python3
"""Exercise the exact initial-migration image archive on an isolated amd64 database."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
BUNDLE = Path(sys.argv[1])


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def rejected(action, expected):
    try:
        action()
    except ValueError as error:
        assert str(error) == expected
        return
    raise AssertionError('EXPECTED_REJECTION')


setup = module('install-server')
server = module('migrate-server')
client = module('migrate-from-mac')
manifest = json.loads((BUNDLE / 'manifest.json').read_text())
payload = manifest['payload']
project = 'blariyo-dbtest-' + secrets.token_hex(6)
temporary = Path(tempfile.mkdtemp(prefix='blariyo-initial-', dir='/private/tmp'))
base = temporary / 'postgresql'
compose = ['docker', 'compose', '-p', project, '-f', str(base / 'compose.yaml')]
passwords = {role: secrets.token_hex(32) for role in setup.ROLES}
stage = 'archive checksum/load'
exit_code = 0
try:
    assert client.archive_hash(BUNDLE / 'api.tar') == manifest['archive_sha256']
    setup.run(['docker', 'image', 'load', '-i', str(BUNDLE / 'api.tar')])
    image_info = json.loads(setup.run(['docker', 'image', 'inspect', payload['image']]).stdout)[0]
    assert server.fingerprint(image_info) == payload['fingerprint']
    print('PASS archive SHA-256 · image load 후 runtime config/layer fingerprint 일치', flush=True)
    stage = 'fresh database'
    setup.install(base, project, {'files': {name: (HERE / name).read_text() for name in setup.FILES}, 'passwords': passwords, 'expected_hostname': 'fixture'})
    stage = 'reject changed image/grants'
    rejected(lambda: server.migrate(base, project, dict(payload, fingerprint='0' * 64)), 'IMAGE_FINGERPRINT_MISMATCH')
    rejected(lambda: server.migrate(base, project, dict(payload, grants_sha256='0' * 64)), 'GRANTS_CHECKSUM_MISMATCH')
    assert not (base / '.initial-migration.json').exists()
    stage = 'initial migration and grants'
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        server.migrate(base, project, payload)
    assert all(value not in output.getvalue() for value in passwords.values())
    print(output.getvalue(), end='', flush=True)
    stage = 'repeat without recreating tables'
    cid = setup.run(compose + ['ps', '-q', 'postgresql']).stdout.decode().strip()
    admin = ['docker', 'exec', '-i', '--user', 'postgres', cid, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'blariyo']
    ledger_sql = b"SELECT version,encode(checksum_sha256,'hex'),applied_at,duration_ms FROM ops.schema_migration ORDER BY version"
    before = setup.run(admin, ledger_sql).stdout
    with contextlib.redirect_stdout(output):
        server.migrate(base, project, payload)
    assert before == setup.run(admin, ledger_sql).stdout
    assert all(value not in output.getvalue() for value in passwords.values())
    for role, value in passwords.items():
        assert (base / 'secrets' / (role + '-password')).read_text() == value
    for snapshot in base.glob('before-initial-migration-*.dump'):
        assert snapshot.stat().st_mode & 0o777 == 0o600
    stage = 'ledger corruption rejection'
    setup.run(admin, b"UPDATE ops.schema_migration SET checksum_sha256=decode(repeat('00',32),'hex') WHERE version='V001'")
    rejected(lambda: server.migrate(base, project, payload), 'APP_MIGRATION_FAILED')
    print('PASS 동일 묶음 재실행 — ledger timestamp·비밀번호 유지 · 변조 ledger migration 거부 · 비밀값 미출력', flush=True)
except Exception as error:
    code = str(error) if isinstance(error, ValueError) else type(error).__name__
    print('FAIL initial migration verification: ' + stage + ' / ' + code, file=sys.stderr)
    exit_code = 1
finally:
    if (base / 'compose.yaml').exists():
        result = subprocess.run(compose + ['down', '--volumes', '--timeout', '30'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode:
            print('FAIL fixture cleanup: ' + project, file=sys.stderr)
            exit_code = 1
    shutil.rmtree(temporary)
sys.exit(exit_code)
