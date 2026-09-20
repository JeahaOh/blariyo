#!/usr/bin/env python3
import subprocess
from pathlib import Path
b=Path('/opt/blariyo/application/release-56351a45eea650c0f02e5043');g=Path('/opt/blariyo/gateway')
for args in [ ['--env-file',str(b/'images.env'),'-f',str(b/'compose.yaml'),'-f',str(b/'production-logging.yaml')], ['-f',str(g/'compose.yaml'),'-f',str(g/'production-logging.yaml')]]:
 r=subprocess.run(['docker','compose']+args+['up','-d','--wait','--wait-timeout','180'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=240)
 if r.returncode:print('APP_START_FAILED');raise SystemExit(1)
print('APP_START_OK')
