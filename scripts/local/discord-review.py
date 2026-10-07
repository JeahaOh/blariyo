#!/usr/bin/env python3
"""Local review worker; reads credentials from a private absolute file only."""
import fcntl
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('maintain', 'scan', 'check'):
        raise RuntimeError('LOCAL_REVIEW_MODE_INVALID')
    directory = ROOT / '.local-data/discord-review'
    directory.mkdir(mode=0o700, exist_ok=True)
    config = Path.home() / '.config/blariyo/discord/local/worker.json'
    java = Path(os.environ['JAVA_HOME']) / 'bin/java'
    with (directory / 'run.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        env = {**os.environ, 'DISCORD_REVIEW_WORKER_CONFIG_FILE': str(config)}
        result = subprocess.run([str(java), '-Xms24m', '-Xmx128m',
            '-Dloader.main=com.blariyo.collector.discordreview.DiscordReviewMain', '-cp',
            str(ROOT / 'apps/collector/build/libs/blariyo-collector-0.1.0.jar'),
            'org.springframework.boot.loader.launch.PropertiesLauncher', sys.argv[1]], env=env, timeout=900, check=False)
        if result.returncode:
            raise RuntimeError('LOCAL_REVIEW_DEFERRED')


if __name__ == '__main__':
    os.umask(0o077)
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else 'LOCAL_REVIEW_FAILED', file=sys.stderr)
        sys.exit(1)
