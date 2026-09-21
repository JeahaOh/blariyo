#!/usr/bin/env python3
"""Apply the reviewed error-cache fix by graceful reload; preserve the bind-mount inode."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile

BASE = Path('/opt/blariyo/gateway')
CONFIG = BASE / 'nginx.conf'
CONTAINER = 'blariyo-gateway-nginx-1'
OLD = '6ef2abf4eceac3f59ad6f77f5ec438ff766a036ad19f2c3f8e64c1047c9a7b12'
NEW = '9728047ec8f6309794ab0f6fa96dc8c1cbf9f783ea9240dc778ff9b954d64555'


def run(args):
    result = subprocess.run(args, capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError('GATEWAY_COMMAND_FAILED')
    return result.stdout


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_config(data):
    # Atomic rename would leave the existing file bind mount pointing at the old inode.
    fd = os.open(CONFIG, os.O_WRONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'wb') as target:
        target.write(data)
        target.truncate()
        target.flush()
        os.fsync(target.fileno())


def main():
    if os.geteuid() != 0 or socket.gethostname() != 'ip-172-26-1-91':
        raise RuntimeError('SERVER_IDENTITY_MISMATCH')
    info = CONFIG.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o644:
        raise RuntimeError('UNSAFE_CONFIG_FILE')
    if (BASE / '.managed').read_bytes() != b'blariyo-private-gateway-v1\n':
        raise RuntimeError('UNMANAGED_GATEWAY')
    payload = json.loads(sys.stdin.buffer.read(100001))
    replacement = payload['config'].encode()
    rollback = payload.get('rollback', False)
    expected, target_hash = (NEW, OLD) if rollback else (OLD, NEW)
    if payload['expected_sha256'] != expected or digest(replacement) != target_hash:
        raise RuntimeError('UNREVIEWED_CHANGE')
    fd = os.open(BASE / '.install.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        original = CONFIG.read_bytes()
        if digest(original) != expected:
            raise RuntimeError('CONFIG_DRIFT')
        runtime = json.loads(run(['docker', 'inspect', CONTAINER]))[0]
        if runtime['HostConfig'].get('PortBindings') or not runtime['State']['Running']:
            raise RuntimeError('RUNTIME_BOUNDARY_CHANGED')
        if not any(m['Source'] == str(CONFIG) and m['Destination'] == '/etc/nginx/nginx.conf'
                   and not m['RW'] for m in runtime['Mounts']):
            raise RuntimeError('CONFIG_MOUNT_CHANGED')
        with tempfile.NamedTemporaryFile(dir=BASE, prefix='.cache-candidate-', delete=False) as candidate:
            candidate.write(replacement)
            candidate.flush()
            os.fchmod(candidate.fileno(), 0o644)
            candidate_path = Path(candidate.name)
        try:
            run(['docker', 'run', '--rm', '--network', 'none', '--user', '101:101', '--read-only',
                 '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '64m',
                 '--pids-limit', '32', '--tmpfs', '/tmp:size=16m,mode=1777,noexec,nosuid',
                 '--mount', 'type=bind,src=' + str(candidate_path) + ',dst=/etc/nginx/nginx.conf,readonly',
                 '--entrypoint', 'nginx', runtime['Image'], '-t'])
        finally:
            candidate_path.unlink()
        backup = BASE / ('nginx.conf.before-cache-' + expected[:12])
        if backup.exists():
            if backup.is_symlink() or digest(backup.read_bytes()) != expected:
                raise RuntimeError('BACKUP_MISMATCH')
        else:
            fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as target:
                target.write(original)
                target.flush()
                os.fsync(target.fileno())
        try:
            write_config(replacement)
            run(['docker', 'exec', CONTAINER, 'nginx', '-t'])
            run(['docker', 'exec', CONTAINER, 'nginx', '-s', 'reload'])
            assert digest(run(['docker', 'exec', CONTAINER, 'cat', '/etc/nginx/nginx.conf'])) == target_hash
            assert run(['docker', 'exec', CONTAINER, 'wget', '-q', '-O', '-',
                        'http://127.0.0.1:8080/__gateway_health']).strip() == b'UP'
        except Exception:
            write_config(original)
            run(['docker', 'exec', CONTAINER, 'nginx', '-t'])
            run(['docker', 'exec', CONTAINER, 'nginx', '-s', 'reload'])
            raise
        print(json.dumps({'status': 'APPLIED', 'rollback': rollback, 'sha256': target_hash,
                          'reload': 'graceful', 'backup': str(backup), 'public_verification': 'pending'}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('FAIL: cache policy update; inspect config hash and health before retrying', file=sys.stderr)
        sys.exit(1)
