#!/usr/bin/env python3
"""Render reviewable LaunchAgents; never install, load, or change the Keychain automatically."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import shlex


def render(config, output):
    allowed = {'java', 'jar', 'workingDirectory', 'properties', 'logDirectory'}
    if not allowed.issubset(config) or set(config) - allowed - {'backupDirectory'}:
        raise ValueError('CONFIG_FIELDS_INVALID')
    paths = {key: Path(value) for key, value in config.items()}
    if any(not path.is_absolute() or not path.exists() or path.is_symlink() for path in paths.values()):
        raise ValueError('ABSOLUTE_EXISTING_PATHS_REQUIRED')
    if not os.access(paths['java'], os.X_OK) or not paths['jar'].is_file() or not paths['properties'].is_file():
        raise ValueError('EXECUTABLE_JAR_PROPERTIES_REQUIRED')
    if paths['properties'].stat().st_mode & 0o077:
        raise ValueError('PRIVATE_PROPERTIES_REQUIRED')
    forbidden = ('token', 'password', 'spool-key', 'request-key', 'backup-key', 'fixture-secrets')
    text = paths['properties'].read_text()
    if any(fragment in text.lower().replace(' ', '') for fragment in forbidden):
        raise ValueError('SECRETS_MUST_BE_IN_KEYCHAIN')
    output = Path(output).resolve()
    output.mkdir(mode=0o700, parents=True, exist_ok=True)
    if output.stat().st_mode & 0o077:
        raise ValueError('PRIVATE_OUTPUT_REQUIRED')
    runner = output / 'run-collector.sh'
    command = [str(paths['java']), '-jar', str(paths['jar']), '--spring.config.additional-location=file:' + str(paths['properties']), '--logging.file.name=' + str(paths['logDirectory'] / 'collector.log')]
    runner.write_text('#!/bin/sh\nset -eu\numask 077\nexec ' + shlex.join(command) + '\n')
    runner.chmod(0o700)
    data = {
        'Label': 'com.blariyo.collector',
        'ProgramArguments': [str(runner)],
        'WorkingDirectory': str(paths['workingDirectory']),
        'RunAtLoad': True,
        'KeepAlive': {'SuccessfulExit': False},
        'ThrottleInterval': 30,
        'ExitTimeOut': 90,
        'Umask': 0o077,
        # Application logback rolls its own output. launchd does not receive raw output.
        'StandardOutPath': '/dev/null',
        'StandardErrorPath': '/dev/null',
    }
    plist = output / 'com.blariyo.collector.plist'
    plist.write_bytes(plistlib.dumps(data, sort_keys=False))
    plist.chmod(0o600)
    if plistlib.loads(plist.read_bytes()) != data:
        raise ValueError('PLIST_VERIFICATION_FAILED')
    if 'backupDirectory' in paths:
        backup_command = [str(paths['java']), '-Dloader.main=com.blariyo.collector.ops.BackupMain', '-cp', str(paths['jar']), 'org.springframework.boot.loader.launch.PropertiesLauncher', 'backup', str(paths['backupDirectory']), str(paths['properties'])]
        backup_data = {**data, 'Label': 'com.blariyo.collector.backup', 'ProgramArguments': backup_command, 'RunAtLoad': False, 'KeepAlive': False, 'StartCalendarInterval': {'Hour': 3, 'Minute': 15}}
        backup_plist = output / 'com.blariyo.collector.backup.plist'
        backup_plist.write_bytes(plistlib.dumps(backup_data, sort_keys=False))
        backup_plist.chmod(0o600)
    return plist

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        render(json.loads(Path(args.config).read_text()), args.output)
        print('COLLECTOR_LAUNCHD_RENDERED')
    except Exception:
        parser.exit(1, 'COLLECTOR_LAUNCHD_RENDER_FAILED\n')
