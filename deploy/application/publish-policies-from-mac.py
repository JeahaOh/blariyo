#!/usr/bin/env python3
"""Publish confirmed v0.1 via SSH; never print policy contacts or secrets."""
import subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NODE='/Users/zeaha/.nvm/versions/node/v24.18.0/bin/node'
if '--apply' not in sys.argv:raise SystemExit('Use --apply to publish the approved policies to the staged production release.')
r=subprocess.run([NODE,str(ROOT/'deploy/application/publish-policies-input.cjs'),'--pipe'],capture_output=True)
if r.returncode:raise SystemExit('POLICY_INPUT_FAILED')
p=subprocess.run([sys.executable,str(ROOT/'deploy/operations/remote.py'),str(ROOT/'deploy/application/publish-policies-server.py')],input=r.stdout,capture_output=True)
print(p.stdout.decode(),end='');raise SystemExit(p.returncode)
