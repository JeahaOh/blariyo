#!/usr/bin/env python3
"""Run one bounded Discord review worker, separate from the collection lock."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys

ROOT = Path('/opt/blariyo/discord-review')
NAME = 'blariyo-discord-review-worker'


def arguments(root, image, mode):
    return ['docker', 'run', '--rm', '--name', NAME, '--pull', 'never', '--platform', 'linux/amd64',
            '--network', 'blariyo-app_app', '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges:true', '--memory', '256m', '--memory-swap', '256m',
            '--cpus', '0.5', '--pids-limit', '96', '--tmpfs', '/tmp:size=16m,mode=1777,noexec,nosuid',
            '--env', 'DISCORD_REVIEW_WORKER_CONFIG_FILE=/run/secrets/discord-review/worker.json',
            '--mount', f'type=bind,src={root}/secrets,dst=/run/secrets/discord-review,readonly',
            '--mount', f'type=bind,src={root}/collector.jar,dst=/app/collector.jar,readonly',
            '--entrypoint', 'java', image, '-Xms24m', '-Xmx128m', '-XX:ActiveProcessorCount=1',
            '-Dloader.main=com.blariyo.collector.discordreview.DiscordReviewMain', '-cp', '/app/collector.jar',
            'org.springframework.boot.loader.launch.PropertiesLauncher', mode]


def main():
    if os.geteuid() != 0 or socket.gethostname() != 'ip-172-26-1-91':
        raise RuntimeError('DISCORD_WORKER_HOST_INVALID')
    if len(sys.argv) != 2 or sys.argv[1] not in ('check', 'maintain', 'scan'):
        raise RuntimeError('DISCORD_WORKER_MODE_INVALID')
    with (ROOT / 'run.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('DISCORD_WORKER_ALREADY_RUNNING')
            return
        manifest = json.loads((ROOT / 'manifest.json').read_text())
        with (ROOT / 'collector.jar').open('rb') as jar:
            if hashlib.file_digest(jar, 'sha256').hexdigest() != manifest['jarSha256']:
                raise RuntimeError('DISCORD_WORKER_ARTIFACT_CHANGED')
        image = manifest['image']
        if not image.startswith('eclipse-temurin@sha256:') or len(image.split(':')[-1]) != 64:
            raise RuntimeError('DISCORD_WORKER_IMAGE_INVALID')
        # A crashed runner may leave only this dedicated container behind; never touch the collector.
        existing = subprocess.run(['docker', 'inspect', '--format', '{{.State.Running}}', NAME], capture_output=True)
        if existing.returncode == 0:
            if existing.stdout.strip() == b'true':
                raise RuntimeError('DISCORD_WORKER_CONTAINER_BUSY')
            subprocess.run(['docker', 'rm', NAME], check=True, stdout=subprocess.DEVNULL)
        try:
            result = subprocess.run(arguments(ROOT, image, sys.argv[1]), timeout=900, check=False)
            if result.returncode:
                raise RuntimeError('DISCORD_WORKER_DEFERRED')
        except subprocess.TimeoutExpired:
            subprocess.run(['docker', 'stop', '--time', '15', NAME], capture_output=True, timeout=30)
            raise RuntimeError('DISCORD_WORKER_TIMEOUT') from None


if __name__ == '__main__':
    os.umask(0o077)
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, RuntimeError) else 'DISCORD_WORKER_RUN_FAILED'
        print(code, file=sys.stderr)
        sys.exit(1)
