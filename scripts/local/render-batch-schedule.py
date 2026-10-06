#!/usr/bin/env python3
"""Render a local-only macOS LaunchAgent; installation is a separate explicit step."""
import argparse
from pathlib import Path
import plistlib

LABEL = 'com.blariyo.local-collection'
SCHEDULE = [{'Hour': 4, 'Minute': 30}, {'Hour': 16, 'Minute': 30}]


def render(root, node, java_home):
    root, node, java_home = (Path(p).resolve() for p in (root, node, java_home))
    for path in (node, java_home / 'bin/java', root / 'scripts/local/scheduled-batch.mjs',
                 root / 'apps/collector/build/libs/blariyo-collector-0.1.0.jar',
                 root / '.local-data/development/batch-config.json'):
        if not path.is_file():
            raise ValueError('LOCAL_BATCH_PREREQUISITE_MISSING')
    output = root / '.local-data/batch-schedule'
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    data = {
        'Label': LABEL,
        'ProgramArguments': [str(node), str(root / 'scripts/local/scheduled-batch.mjs')],
        'WorkingDirectory': str(root),
        'EnvironmentVariables': {'JAVA_HOME': str(java_home),
                                 'PATH': f'{node.parent}:{java_home}/bin:/usr/bin:/bin:/usr/sbin:/sbin'},
        'StartCalendarInterval': SCHEDULE,
        'RunAtLoad': False,
        'KeepAlive': False,
        'ProcessType': 'Background',
        'ExitTimeOut': 45,
        'AbandonProcessGroup': False,
        'Umask': 0o077,
        'StandardOutPath': str(output / 'launcher.log'),
        'StandardErrorPath': str(output / 'launcher.log'),
    }
    target = output / f'{LABEL}.plist'
    target.write_bytes(plistlib.dumps(data, sort_keys=False))
    target.chmod(0o600)
    # Separate, reviewable opt-in: prevent AC system sleep while reservations are enabled.
    # It does not keep the display on and does not prevent sleep on battery power.
    awake = {
        'Label': LABEL + '.awake',
        'ProgramArguments': ['/usr/bin/caffeinate', '-s'],
        'RunAtLoad': True,
        'KeepAlive': True,
        'StandardOutPath': '/dev/null',
        'StandardErrorPath': '/dev/null',
    }
    awake_target = output / f'{LABEL}.awake.plist'
    awake_target.write_bytes(plistlib.dumps(awake, sort_keys=False))
    awake_target.chmod(0o600)
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', required=True)
    parser.add_argument('--java-home', required=True)
    args = parser.parse_args()
    print(render(Path(__file__).resolve().parents[2], args.node, args.java_home))
