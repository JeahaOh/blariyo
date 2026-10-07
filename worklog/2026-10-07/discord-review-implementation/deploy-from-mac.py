"""Deliver reviewed deployment helper to the fixed server, without secret arguments."""
import base64
import json
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
phase, sha, backup = sys.argv[1:]
assert phase in ('stage', 'apply') and re.fullmatch('[a-f0-9]{40}', sha)
assert re.fullmatch('[a-f0-9]{64}', backup)
helper = Path(__file__).with_name('deploy-server.py').read_bytes()
encoded = base64.b64encode(helper).decode()
command = "sudo -n python3 -c 'import base64;exec(compile(base64.b64decode(\"" + encoded + "\"),\"discord-deploy\",\"exec\"))'"
payload = {'phase': phase, 'sha': sha, 'backupSha256': backup,
           'helpers': (root / 'deploy/application/nightly-main-deploy-server.py').read_text(),
           'privileges': (root / 'deploy/postgresql/apply-privileges.sql').read_text()}
key = Path.home() / 'Library/Mobile Documents/com~apple~CloudDocs/blariyo/LightsailDefaultKey-ap-northeast-2.pem'
result = subprocess.run(['ssh', '-T', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
                         '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-i', str(key),
                         'ubuntu@13.124.55.99', command], input=json.dumps(payload), text=True, timeout=1800)
sys.exit(result.returncode)
