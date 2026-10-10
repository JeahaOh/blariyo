#!/usr/bin/env python3
import sys
import subprocess
import fcntl
import os
import json
import re

ALLOWED = {'publish': 'posts:publish-due', 'outbox': 'outbox:run',
           'cleanup': 'cleanup:run', 'auto-publish': 'collection:auto-publish'}


def run(name):
    if name not in ALLOWED:
        print('JOB_UNKNOWN')
        return 1
    lock = '/run/blariyo-auto-publish.lock' if name == 'auto-publish' else '/run/blariyo-job.lock'
    fd = os.open(lock, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('JOB_SKIPPED_BUSY')
            return 0
        try:
            result = subprocess.run(['docker', 'exec', 'blariyo-app-api-1', 'node',
                                     'apps/api/dist/commands/command.js', ALLOWED[name]],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
        except subprocess.TimeoutExpired:
            print('JOB_TIMEOUT')
            return 1
        if name == 'auto-publish':
            # Emit only counts/reason codes. Never pass arbitrary application logs through to journal.
            for line in result.stdout.decode('utf8', errors='replace').splitlines():
                try:
                    value = json.loads(line)
                except ValueError:
                    continue
                if (isinstance(value, dict) and value.get('event') == 'SOURCE_AUTO_PUBLISH'
                        and isinstance(value.get('counts'), dict)
                        and all(re.fullmatch(r'[A-Z][A-Z0-9_]{0,79}', key)
                                and type(count) is int and 0 <= count <= 40
                                for key, count in value['counts'].items())):
                    print(json.dumps({'event': 'SOURCE_AUTO_PUBLISH', 'counts': value['counts']}))
        print('JOB_' + name.upper().replace('-', '_') + ('_OK' if result.returncode == 0 else '_FAILED'))
        return 0 if result.returncode == 0 else 1
    finally:
        os.close(fd)


if __name__ == '__main__':
    sys.exit(run(sys.argv[1] if len(sys.argv) == 2 else ''))
