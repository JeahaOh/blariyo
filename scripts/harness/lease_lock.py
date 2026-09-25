#!/usr/bin/env python3
"""Small local advisory-lock helper; the operating system releases on process exit."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    import fcntl
except ImportError:  # pragma: no cover - used on Windows
    fcntl = None
    import msvcrt


def lock_nonblocking(handle) -> None:
    if fcntl is not None:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return
    handle.seek(0)
    try:
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError as error:
        raise BlockingIOError from error


def unlock(handle) -> None:
    if fcntl is not None:
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        return
    handle.seek(0)
    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)

def record_for(path: Path) -> dict[str, object] | None:
    try:
        data = path.read_text(encoding="utf-8")
        value = json.loads(data)
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError):
        return {"state": "UNKNOWN", "reason": "lease record is unreadable"}
    return value if isinstance(value, dict) else {"state": "UNKNOWN", "reason": "invalid lease record"}


def inspect(path: Path) -> int:
    try:
        handle = path.open("r+b" if fcntl is None else "rb")
    except FileNotFoundError:
        print(json.dumps({"state": "ABSENT"}))
        return 0
    with handle:
        owner = record_for(path)
        if fcntl is None and os.fstat(handle.fileno()).st_size == 0:
            print(json.dumps({"state": "UNKNOWN", "reason": "lease record is empty"}))
            return 0
        try:
            lock_nonblocking(handle)
        except BlockingIOError:
            print(json.dumps({"state": "LOCKED", "owner": owner}))
            return 0
        unlock(handle)
    print(json.dumps({"state": "AVAILABLE", "lastOwner": owner}))
    return 0


def hold(path: Path, metadata: dict[str, object]) -> int:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(descriptor, "r+", encoding="utf-8") as handle:
        if fcntl is None and os.fstat(handle.fileno()).st_size == 0:
            handle.write("\0")
            handle.flush()
        try:
            lock_nonblocking(handle)
        except BlockingIOError:
            print(json.dumps({"state": "LOCKED", "owner": record_for(path)}), flush=True)
            return 3
        handle.seek(0)
        handle.truncate()
        json.dump(metadata, handle, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
        print(json.dumps({"state": "ACQUIRED", "owner": metadata}), flush=True)
        for line in sys.stdin:
            if line.strip() == "release":
                break
        unlock(handle)
    print(json.dumps({"state": "RELEASED", "leaseId": metadata.get("leaseId")}), flush=True)
    return 0


def main() -> int:
    if len(sys.argv) < 3 or sys.argv[1] not in {"inspect", "hold"}:
        print("usage: lease_lock.py <inspect|hold> <lock-file> [metadata-json]", file=sys.stderr)
        return 2
    path = Path(sys.argv[2])
    if sys.argv[1] == "inspect":
        return inspect(path)
    try:
        metadata = json.loads(sys.argv[3])
    except (IndexError, json.JSONDecodeError):
        print("hold requires valid metadata JSON", file=sys.stderr)
        return 2
    if not isinstance(metadata, dict):
        print("metadata must be a JSON object", file=sys.stderr)
        return 2
    return hold(path, metadata)


if __name__ == "__main__":
    raise SystemExit(main())
