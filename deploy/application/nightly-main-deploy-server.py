#!/usr/bin/env python3
"""Deploy new GitHub main images at the scheduled server-side window.

This script runs on the production server. It does not merge branches, build
images, run migrations, or edit secrets. It only promotes already-published
GHCR images for the current main SHA after a fresh backup succeeds.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

APP_ROOT = Path('/opt/blariyo/application')
OPS_START = Path('/opt/blariyo/operations/start-application.py')
STATE = APP_ROOT / 'nightly-main-state.json'
LOCK = Path('/run/blariyo-nightly-main-deploy.lock')
DEFAULT_REPO = 'https://github.com/JeahaOh/blariyo.git'
DEFAULT_IMAGE_PREFIX = 'ghcr.io/jeahaoh/blariyo'
SHA_RE = re.compile(r'^[0-9a-f]{40}$')


def run(args, *, timeout=300, input_text=None):
    result = subprocess.run(
        args,
        input=input_text.encode() if input_text is not None else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
        check=False,
    )
    if result.returncode:
        raise RuntimeError('COMMAND_FAILED:' + args[0])
    return result.stdout.decode().strip()


def log(message):
    print(datetime.now(timezone.utc).isoformat(timespec='seconds') + ' ' + message, flush=True)


def read_env(path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        name, sep, value = line.partition('=')
        if sep and re.fullmatch(r'[A-Z][A-Z0-9_]*', name):
            values[name] = value
    return values


def read_current_release():
    if not OPS_START.exists():
        raise RuntimeError('START_HELPER_MISSING')
    text = OPS_START.read_text()
    match = re.search(r"release-[A-Za-z0-9._-]+", text)
    if not match:
        raise RuntimeError('CURRENT_RELEASE_NOT_FOUND')
    path = APP_ROOT / match.group(0)
    if not path.is_dir():
        raise RuntimeError('CURRENT_RELEASE_PATH_MISSING')
    return path


def sha_from_release(path):
    match = re.search(r'release-([0-9a-f]{7,40})', path.name)
    return match.group(1) if match else ''


def remote_main_sha(repo):
    output = run(['git', 'ls-remote', repo, 'refs/heads/main'], timeout=60)
    sha = output.split()[0] if output else ''
    if not SHA_RE.fullmatch(sha):
        raise RuntimeError('REMOTE_MAIN_SHA_INVALID')
    return sha


def image_digest(image):
    run(['docker', 'pull', image], timeout=900)
    inspect = json.loads(run(['docker', 'image', 'inspect', image], timeout=60))[0]
    digests = inspect.get('RepoDigests') or []
    if not digests:
        raise RuntimeError('IMAGE_DIGEST_MISSING')
    return sorted(digests)[0]


def ensure_fresh_backup():
    run(['systemctl', 'start', 'blariyo-backup.service'], timeout=2400)
    state = run(['systemctl', 'show', 'blariyo-backup.service', '-p', 'Result', '-p', 'ExecMainStatus'], timeout=60)
    if 'Result=success' not in state or 'ExecMainStatus=0' not in state:
        raise RuntimeError('BACKUP_FAILED')


def copy_release(source, target, api_ref, web_ref, sha):
    if target.exists():
        raise RuntimeError('TARGET_RELEASE_EXISTS')
    ignored = shutil.ignore_patterns('stage.json', 'gtm-deployment.json', 'public-verification-gtm.json')
    shutil.copytree(source, target, symlinks=False, ignore=ignored)
    images = f'BLARIYO_API_IMAGE={api_ref}\nBLARIYO_WEB_IMAGE={web_ref}\n'
    (target / 'images.env').write_text(images)
    os.chmod(target / 'images.env', 0o600)
    marker = {
        'schemaVersion': 1,
        'source': 'nightly-main-deploy',
        'mainSha': sha,
        'createdAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'baseRelease': str(source),
        'apiImage': api_ref,
        'webImage': web_ref,
    }
    (target / 'nightly-main-release.json').write_text(json.dumps(marker, indent=2, sort_keys=True) + '\n')
    os.chmod(target / 'nightly-main-release.json', 0o600)


def compose(release):
    return [
        'docker',
        'compose',
        '--env-file',
        str(release / 'images.env'),
        '-f',
        str(release / 'compose.yaml'),
        '-f',
        str(release / 'production-logging.yaml'),
    ]


def start_release(release):
    run(compose(release) + ['config', '--quiet'], timeout=60)
    for service in ('api', 'web'):
        run(compose(release) + ['up', '-d', '--no-deps', '--wait', '--wait-timeout', '180', service], timeout=300)


def update_start_helper(release):
    text = OPS_START.read_text()
    next_text = re.sub(r"release-[A-Za-z0-9._-]+", release.name, text, count=1)
    if text == next_text:
        raise RuntimeError('START_HELPER_UNCHANGED')
    backup = OPS_START.with_name(OPS_START.name + '.' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    OPS_START.replace(backup)
    OPS_START.write_text(next_text)
    os.chmod(OPS_START, 0o755)
    return backup


def smoke():
    run(['docker', 'inspect', 'blariyo-app-api-1', 'blariyo-app-web-1'], timeout=60)
    run(['curl', '-fsS', 'http://127.0.0.1:3000/health/live'], timeout=30)
    run(['curl', '-fsS', 'http://127.0.0.1:3000/meme'], timeout=30)


def write_state(data):
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + '\n')
    os.chmod(tmp, 0o600)
    tmp.replace(STATE)


def main():
    if os.geteuid() != 0:
        raise RuntimeError('ROOT_REQUIRED')
    if socket.gethostname() != 'ip-172-26-1-91':
        raise RuntimeError('UNEXPECTED_HOST')
    fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.write(fd, str(os.getpid()).encode())
        env = read_env(APP_ROOT / 'nightly-main.env')
        repo = env.get('BLARIYO_MAIN_REPO', DEFAULT_REPO)
        image_prefix = env.get('BLARIYO_IMAGE_PREFIX', DEFAULT_IMAGE_PREFIX)
        current = read_current_release()
        current_sha = sha_from_release(current)
        target_sha = remote_main_sha(repo)
        if current_sha and target_sha.startswith(current_sha):
            log('NOOP current release already matches main ' + target_sha)
            return
        target = APP_ROOT / ('release-' + target_sha[:7] + '-main-nightly-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
        api_ref = image_digest(f'{image_prefix}-api:{target_sha}')
        web_ref = image_digest(f'{image_prefix}-web:{target_sha}')
        ensure_fresh_backup()
        copy_release(current, target, api_ref, web_ref, target_sha)
        start_release(target)
        helper_backup = update_start_helper(target)
        run(['systemctl', 'restart', 'blariyo-publish.timer', 'blariyo-outbox.timer', 'blariyo-cleanup.timer'], timeout=60)
        smoke()
        write_state({
            'deployedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'mainSha': target_sha,
            'releasePath': str(target),
            'previousReleasePath': str(current),
            'startHelperBackup': str(helper_backup),
            'apiImage': api_ref,
            'webImage': web_ref,
        })
        log('DEPLOYED main ' + target_sha + ' to ' + str(target))
    finally:
        os.close(fd)
        try:
            LOCK.unlink()
        except FileNotFoundError:
            pass


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error)
        if not re.fullmatch(r'[A-Z_]+(?::[A-Za-z0-9_.:/-]+)?', code):
            code = 'NIGHTLY_MAIN_DEPLOY_FAILED'
        print('FAIL ' + code, file=sys.stderr)
        sys.exit(1)
