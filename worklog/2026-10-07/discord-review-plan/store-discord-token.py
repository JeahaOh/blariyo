#!/usr/bin/env python3
"""Store a locally entered bot token without echo, arguments, or network calls."""
import getpass
import os
from pathlib import Path
import re
import stat
import sys

DESTINATION = Path.home() / '.config/blariyo/discord/local/discord-token'


def save_token(destination, token):
    if not re.fullmatch(r'[A-Za-z0-9_.-]{40,200}', token):
        raise ValueError('토큰 형식이 아닙니다. URL이나 Bot 접두사 없이 입력하세요.')
    # Refuse unsafe ancestors and overwrite; never follow a secret-file symlink.
    for parent in destination.parents:
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid not in (0, os.getuid()):
            raise ValueError('저장 경로 소유권 또는 유형을 확인하세요.')
    for parent in (destination.parent, destination.parent.parent):
        info = parent.stat()
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError('비공개 폴더 권한은 0700이어야 합니다.')
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write(token + '\n')
        output.flush()
        os.fsync(output.fileno())


def main():
    if not sys.stdin.isatty():
        raise ValueError('직접 연 터미널에서 실행하세요. 파이프 입력은 받지 않습니다.')
    token = getpass.getpass('Discord Bot Token (입력 내용은 표시되지 않음): ')
    save_token(DESTINATION, token)
    print('로컬 토큰 저장 완료 (0600). 토큰 유효성·Discord 연동은 아직 미검증입니다.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, EOFError, KeyboardInterrupt):
        print('저장하지 못했습니다. 경로·권한·입력 형식을 확인하세요. 기존 파일은 덮어쓰지 않습니다.', file=sys.stderr)
        sys.exit(1)
