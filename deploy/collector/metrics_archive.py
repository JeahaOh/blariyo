"""Archive closed metrics files to the existing private R2 bucket; never log secrets."""
import base64
import hashlib
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

FILE_PATTERN = r'metrics-(\d{8}T\d{6}Z-[a-f0-9]{8})\.jsonl'
MAX_FILE_BYTES = 1048576
ARCHIVE_BUDGET_SECONDS = 90


def uploaded(path):
    try:
        receipt = json.loads(path.with_suffix('.uploaded.json').read_text())
        return (receipt.get('state') == 'VERIFIED'
                and receipt['localSha256'] == hashlib.sha256(path.read_bytes()).hexdigest())
    except (OSError, ValueError, KeyError):
        return False


def objects_for(path):
    match = re.fullmatch(FILE_PATTERN, path.name)
    if not match or path.is_symlink() or path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError('INVALID_METRICS_FILE')
    data = path.read_bytes()
    days = {}
    for line in data.splitlines(keepends=True):
        row = json.loads(line)
        if row['executionId'] != match[1] or not line.endswith(b'\n'):
            raise ValueError('INCOMPLETE_OR_WRONG_EXECUTION')
        instant = datetime.fromisoformat(row['timestamp'])
        if instant.tzinfo is None:
            raise ValueError('TIMEZONE_REQUIRED')
        day = instant.astimezone(ZoneInfo('Asia/Seoul')).strftime('%Y/%m/%d')
        days.setdefault(day, bytearray()).extend(line)
    if not 1 <= len(days) <= 3:
        raise ValueError('INVALID_METRICS_DAYS')
    return data, [{'key': f'metrics/{day}/production-{match[1]}.jsonl',
                   'sha256': hashlib.sha256(body).hexdigest(),
                   'body': base64.b64encode(body).decode()} for day, body in sorted(days.items())]


def transfer(root, objects, timeout):
    secret = root / 'collector.env'
    if secret.is_symlink() or secret.stat().st_mode & 0o077:
        raise ValueError('SECRET_MODE')
    env = dict(line.split('=', 1) for line in secret.read_text().splitlines() if '=' in line)
    config = {key: env['COLLECTOR_OBJECT_STORE_S3_' + suffix] for key, suffix in
              [('endpoint', 'ENDPOINT'), ('bucket', 'BUCKET'), ('accessKeyId', 'ACCESS_KEY_ID'),
               ('secretAccessKey', 'SECRET_ACCESS_KEY')]}
    config['objects'] = objects
    # Reuse the already installed API image's SDK in an isolated, resource-limited container.
    image = subprocess.run(['docker', 'inspect', '--format', '{{.Image}}', 'blariyo-app-api-1'],
                           text=True, capture_output=True, check=True, timeout=5).stdout.strip()
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise ValueError('IMAGE_ID')
    name = 'blariyo-metrics-upload-' + uuid4().hex[:12]
    args = ['docker', 'run', '--rm', '-i', '--name', name, '--pull', 'never',
            '--network', 'blariyo-collector_egress', '--read-only', '--user', '10001:10001',
            '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
            '--memory', '128m', '--memory-swap', '128m', '--cpus', '0.25', '--pids-limit', '32',
            '--log-driver', 'none', '--mount',
            f'type=bind,src={root}/metrics-transfer.cjs,dst=/metrics-transfer.cjs,readonly',
            '--entrypoint', 'node', image, '/metrics-transfer.cjs']
    try:
        result = subprocess.run(args, input=json.dumps(config), text=True, capture_output=True,
                                timeout=timeout, check=True)
        return json.loads(result.stdout)
    finally:
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=5)


def archive_pending(root):
    result = {'state': 'VERIFIED', 'uploaded': [], 'failed': [], 'pending': 0}
    deadline = time.monotonic() + ARCHIVE_BUDGET_SECONDS
    paths = sorted(p for p in (root / 'metrics').glob('metrics-*.jsonl')
                   if re.fullmatch(FILE_PATTERN, p.name) and not p.is_symlink() and p.is_file())
    for path in paths:
        if uploaded(path):
            continue
        if deadline - time.monotonic() < 10:
            result['pending'] += 1
            continue
        try:
            data, objects = objects_for(path)
            response = transfer(root, objects, min(60, deadline - time.monotonic()))
            expected = [{'key': o['key'], 'bytes': len(base64.b64decode(o['body'])),
                         'sha256': o['sha256']} for o in objects]
            if response.get('state') != 'VERIFIED' or response.get('objects') != expected:
                raise ValueError('UNVERIFIED_UPLOAD')
            receipt = {**response, 'localSha256': hashlib.sha256(data).hexdigest(),
                       'verifiedAt': datetime.now(timezone.utc).isoformat()}
            target = path.with_suffix('.uploaded.json')
            temporary = target.with_suffix('.tmp')
            temporary.write_text(json.dumps(receipt) + '\n')
            temporary.chmod(0o600)
            temporary.replace(target)
            result['uploaded'].extend(expected)
        except Exception:
            # Keep the original file, including files older than local retention.
            result['failed'].append(path.name)
    if result['failed'] or result['pending']:
        result['state'] = 'PENDING'
    return result
