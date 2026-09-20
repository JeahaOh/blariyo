#!/usr/bin/env python3
"""Delete only owned, dated Blariyo diagnostic logs. Never audit/DB/host logs."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, re, stat

def expire(directory, today):
    directory=Path(directory)
    info=directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)!=0o700:
        raise ValueError('UNSAFE_LOG_DIRECTORY')
    # Keep today and previous five UTC dates: daily timer gives <7 days even with a short delay.
    cutoff=today-timedelta(days=5)
    count=0
    for path in directory.iterdir():
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}\.log',path.name): continue
        info=path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or info.st_nlink!=1:
            raise ValueError('UNSAFE_LOG_FILE')
        date=datetime.strptime(path.stem,'%Y-%m-%d').date()
        if date<cutoff:
            path.unlink();count+=1
    return count
if __name__=='__main__':
    try:
        count=expire('/var/log/blariyo/application',datetime.now(timezone.utc).date())
        print('DIAGNOSTIC_LOG_RETENTION_OK removed='+str(count))
    except Exception:
        print('DIAGNOSTIC_LOG_RETENTION_FAILED');raise SystemExit(1)
