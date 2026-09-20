import subprocess
r=subprocess.run(['age-keygen'],capture_output=True,check=True)
import sys
sys.stdout.buffer.write(r.stdout)
