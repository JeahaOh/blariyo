#!/usr/bin/env python3
"""Build a local reviewable bundle. The server installer separately requires --activate."""
import argparse,json,sys
from pathlib import Path
def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--restore-receipt',required=True)
 parser.add_argument('--expected-hashes',required=True,help='Observed existing destination SHA-256 or null for each new file')
 parser.add_argument('--output',required=True,help='Reviewable local JSON bundle; contains no credentials')
 args=parser.parse_args()
 base=Path(__file__).resolve().parent
 names=['run-backup.py']+[f'blariyo-backup{s}.{k}' for s in ('','-expiry','-alerts') for k in ('service','timer')]
 payload={'files':{name:(base/name).read_text() for name in names},'expectedHashes':json.loads(Path(args.expected_hashes).read_text()),
          'selectiveRestoreReceipt':json.loads(Path(args.restore_receipt).read_text())}
 if set(payload['expectedHashes'])!=set(names):raise ValueError('BACKUP_BASELINE_KEYS_INVALID')
 with open(args.output,'x') as output:json.dump(payload,output,indent=2);output.write('\n')
 print('BACKUP_INSTALL_BUNDLE_WRITTEN_NO_REMOTE_ACTION')
if __name__=='__main__':
 try:main()
 except Exception:print('BACKUP_BUNDLE_FAILED',file=sys.stderr);sys.exit(1)
