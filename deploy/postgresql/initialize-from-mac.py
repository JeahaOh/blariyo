#!/usr/bin/env python3
"""First schema initialization plus policy draft seed. PostgreSQL/roles must already exist."""
import argparse
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--publish-policies', action='store_true', help='Publish approved v0.1 after migration/seed; application images and runtime must already be staged.')
    args = parser.parse_args()
    base = ['--host',args.host]
    # Validate both inputs before any remote mutation.
    for helper in ('migrate-from-mac.py','seed-policies-from-mac.py'):
        subprocess.run([sys.executable,str(HERE/helper)]+base,check=True)
    if args.apply:
        for helper in ('migrate-from-mac.py','seed-policies-from-mac.py'):
            subprocess.run([sys.executable,str(HERE/helper)]+base+['--apply'],check=True)
        print('PASS 초기 schema·권한·정책 DRAFT 등록.')
        if args.publish_policies:
            subprocess.run([sys.executable,str(HERE.parent/'application/publish-policies-from-mac.py'),'--apply'],check=True)
        else:
            print('유효 정책 발행·앱 기동은 별도입니다.')


if __name__=='__main__':
    try: main()
    except Exception:
        print('FAIL 초기 구성 — 앞 단계 성공 여부를 확인하세요. 자동 DB 삭제 없음.',file=sys.stderr)
        sys.exit(1)
