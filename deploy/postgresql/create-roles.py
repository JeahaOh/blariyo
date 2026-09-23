#!/usr/bin/env python3
"""Create initial application roles, or add a separate batch role, in Docker PostgreSQL.

Passwords stay in permission-restricted files and psql stdin. Existing roles are never reset.
"""
import argparse
import os
from pathlib import Path
import re
import stat
import subprocess
import sys


def read_password(file):
    fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 128:
            raise ValueError("PASSWORD_FILE_PERMISSIONS")
        value = os.read(fd, 129).decode("ascii")
        if not re.fullmatch(r"[a-f0-9]{64}\n?", value):
            raise ValueError("PASSWORD_FILE_FORMAT")
        return value.rstrip("\n")
    finally:
        os.close(fd)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True, help="target PostgreSQL container name")
    parser.add_argument("--secrets-dir", required=True, help="absolute directory holding role password files")
    parser.add_argument("--batch-only", action="store_true", help="add only blariyo_batch after initial role setup")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", args.container):
        raise ValueError("CONTAINER_NAME_INVALID")
    directory = Path(args.secrets_dir)
    info = directory.lstat()
    if not directory.is_absolute() or not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o022:
        raise ValueError("SECRET_DIRECTORY_INVALID")
    names = ("batch",) if args.batch_only else ("app", "migrator", "backup")
    passwords = [read_password(directory / f"{name}-password") for name in names]
    if len(set(passwords)) != len(names):
        raise ValueError("PASSWORDS_MUST_DIFFER")
    if args.batch_only:
        for name in ("app", "migrator", "backup"):
            file = directory / f"{name}-password"
            if file.exists() and read_password(file) == passwords[0]:
                raise ValueError("PASSWORDS_MUST_DIFFER")
    variables = "".join(f"\\set {name}_password {value}\n" for name, value in zip(names, passwords))
    sql = variables + Path(__file__).with_name("create-batch-role.sql" if args.batch_only else "create-roles.sql").read_text()
    result = subprocess.run(
        ["docker", "exec", "-i", "--user", "postgres", args.container,
         "psql", "--no-psqlrc", "--no-password", "--quiet", "--username", "postgres", "--dbname", "blariyo"],
        input=sql.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=60,
    )
    if result.returncode:
        # psql errors can quote the statement. Never emit stdout/stderr from this invocation.
        raise ValueError("DB_ROLE_SETUP_FAILED_EXISTING_STATE_OR_CONNECTION")
    print("PASS DB 역할 생성 — " + " · ".join(names) + ", 기존 역할 재설정 없음")
    print("검증 범위: 새 DB 역할·기본 권한 생성. migration·테이블 권한·접속 검사는 별도입니다.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError):
        print("FAIL DB 역할 생성 — 새 DB 상태·Docker 연결·파일 형식·소유자·권한을 확인하세요. 원문·비밀값 비출력.", file=sys.stderr)
        sys.exit(1)
