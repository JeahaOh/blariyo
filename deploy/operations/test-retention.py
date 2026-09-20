import importlib.util,tempfile,os
from pathlib import Path
from datetime import date
s=importlib.util.spec_from_file_location('retention',Path(__file__).with_name('expire-logs.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp);os.chmod(p,0o700)
 for name in ['2026-09-13.log','2026-09-14.log','2026-09-15.log','2026-09-20.log','audit.json','unknown.txt']:(p/name).write_text('synthetic')
 assert m.expire(p,date(2026,9,20))==2
 assert {x.name for x in p.iterdir()}=={'2026-09-15.log','2026-09-20.log','audit.json','unknown.txt'}
 (p/'2026-09-01.log').symlink_to(p/'unknown.txt')
 try:m.expire(p,date(2026,9,20));raise AssertionError('symlink accepted')
 except ValueError:pass
 assert (p/'unknown.txt').exists()
print('PASS diagnostic TTL boundary, unrelated file preservation, symlink rejection')
