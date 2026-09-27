import datetime
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

BASE=Path(__file__).resolve().parent
def module(name):
 spec=importlib.util.spec_from_file_location(name,BASE/(name+'.py'));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
runner=module('run-backup');installer=module('install-server')

class BackupRunnerTests(unittest.TestCase):
 def test_scoped_mounts_no_docker_socket_or_recovery_key(self):
  with tempfile.TemporaryDirectory(prefix='blariyo-backup-runner-') as temp:
   root=Path(temp)
   for name in ('config.json','recipient.txt','r2.json','db-password'):
    (root/name).write_text('synthetic');(root/name).chmod(0o600)
   (root/'state').mkdir(mode=0o700)
   runtime={'image':'sha256:'+'a'*64,'uid':65532,'gid':65532,'networks':['task-data','task-outbound']}
   real_stat=Path.stat
   def owned(path,*args,**kwargs):
    value=real_stat(path,*args,**kwargs)
    if path.name=='state':
     from types import SimpleNamespace
     return SimpleNamespace(st_uid=65532,st_mode=value.st_mode)
    return value
   with patch.object(Path,'stat',owned):
    args=runner.command(root,'maintain',runtime)
    self.assertEqual(args[-2:],[runtime['image'],'maintain'])
    self.assertIn('--read-only',args);self.assertIn('ALL',args)
    self.assertNotIn('docker.sock',' '.join(args));self.assertNotIn('identity',' '.join(args))
    for bad in ({'image':'latest'},{'uid':0},{'networks':['--host']}):
     with self.assertRaises(ValueError):runner.command(root,'backup',dict(runtime,**bad))
    (root/'r2.json').chmod(0o644)
    with self.assertRaisesRegex(ValueError,'BACKUP_SECRET_PERMISSIONS'):runner.command(root,'backup',runtime)
 def test_restore_receipt_age_provider_and_no_resume_gate(self):
  now=datetime.datetime(2026,9,27,tzinfo=datetime.timezone.utc)
  receipt={'kind':'OPS03_SELECTIVE_RESTORE','provider':'r2','rawRestored':0,'fingerprintsMatched':True,
   'collectionResumeAllowed':False,'dumpProfileVersion':'m0-direct-excluded-v1','restoredAt':now.isoformat()}
  payload={'files':{n:'synthetic' for n in installer.UNITS|{'run-backup.py'}},'expectedHashes':{},'selectiveRestoreReceipt':receipt}
  self.assertEqual(installer.validate(payload,now),receipt)
  for bad in ({'provider':'drive'},{'rawRestored':1},{'collectionResumeAllowed':True},
              {'restoredAt':(now-datetime.timedelta(hours=18)).isoformat()}):
   with self.assertRaises(ValueError):installer.validate(dict(payload,selectiveRestoreReceipt=dict(receipt,**bad)),now)
 def test_installer_refuses_changed_files(self):
  with tempfile.TemporaryDirectory(prefix='blariyo-backup-install-') as temp:
   target=Path(temp)/'owned';target.write_text('original')
   with self.assertRaisesRegex(ValueError,'BACKUP_INSTALL_BASELINE_CHANGED'):installer.replace(target,'new',None,0o600)
   self.assertEqual(target.read_text(),'original')

if __name__=='__main__':unittest.main()
