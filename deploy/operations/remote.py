import importlib.util,subprocess,sys,shlex
from pathlib import Path
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('h',root/'deploy/postgresql/install-from-mac.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
args=['ssh','-T','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-i',str(h.find_key(None)),'ubuntu@13.124.55.99','sudo -n python3 -u -c '+shlex.quote(Path(sys.argv[1]).read_text())]
r=subprocess.run(args,input=sys.stdin.buffer.read(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=900)
print(r.stdout.decode(),end='')
if r.returncode: print('REMOTE_FAILED',r.returncode, file=sys.stderr)
sys.exit(r.returncode)
