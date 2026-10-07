import importlib.util,unittest,json,tempfile
from unittest.mock import patch
from pathlib import Path
s=importlib.util.spec_from_file_location('collector_run',Path(__file__).with_name('run.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class DeploymentContract(unittest.TestCase):
 def test_source_disable_and_resource_boundary(self):
  sources=json.loads(Path('apps/collector/ops/reference-sites.sources.example.json').read_text())
  active=m.active_sources(sources)
  self.assertEqual(len(active),15)
  self.assertFalse(set(active)&{'dcinside','arcalive','bobaedream','inven','mlbpark','pgr21'})
  args=m.container_args({'dbNetworkIp':'172.18.0.21','image':'jre@sha256:fixed'},'goodgag')
  for option,value in [('--memory','512m'),('--memory-swap','512m'),('--cpus','0.5'),('--max-pages','2'),('--max-items','20'),('--since','24h'),('--interval-ms','5000')]:self.assertEqual(args[args.index(option)+1],value)
  self.assertNotIn('--privileged',args);self.assertNotIn('-p',args);self.assertIn('--write-db',args)
 def test_calendar_never_replays_missed_runs(self):
  timer=Path('deploy/collector/blariyo-collection.timer').read_text()
  self.assertIn('04:30:00 Asia/Seoul',timer);self.assertIn('15:30:00 Asia/Seoul',timer)
  self.assertNotIn('16:30',timer);self.assertIn('Persistent=false',timer)
  service=Path('deploy/collector/blariyo-collection.service').read_text();self.assertIn('TimeoutStartSec=2h',service)
 def test_failed_start_preserves_existing_container_and_continues_other_sources(self):
  with tempfile.TemporaryDirectory() as folder:
   calls=[]
   def fake(args,timeout=30):
    calls.append(args)
    if args[:2]==['docker','create'] and args[args.index('--source')+1]=='first':raise RuntimeError('start failed')
    if args[:2]==['docker','inspect']:return json.dumps({'Running':False,'ExitCode':0,'OOMKilled':False,'FinishedAt':'now'})
    if args[:2]==['docker','logs']:return json.dumps({'runId':'fixture','report':{'state':'COMPLETED','errors':[],'fetched':1}})
    return ''
   config={'first':{},'second':{}}
   manifest={'mainSha':'fixture','dbNetworkIp':'172.18.0.21','image':'jre@sha256:fixed'}
   with patch.object(m,'ROOT',Path(folder)),patch.object(m,'preflight',return_value=(manifest,config)),patch.object(m,'command',side_effect=fake),patch.object(m.subprocess,'run') as cleanup,patch.object(m.sys,'argv',['run.py']),patch.object(m.signal,'signal'),patch.object(m,'ResourceSampler') as sampler:
    sampler.return_value.stop.return_value={'state':'RECORDED'}
    self.assertEqual(m.main(),1)
    self.assertEqual(cleanup.call_count,1)
    sampler.return_value.start.assert_called_once()
    sampler.return_value.stop.assert_called_once()
   status=json.loads((Path(folder)/'status.json').read_text())
   self.assertEqual(status['state'],'COMPLETED_WITH_ERRORS')
   self.assertEqual(status['sources'][0]['error'],'SOURCE_EXECUTION_FAILED')
   self.assertEqual(status['sources'][1]['counts']['fetched'],1)
   self.assertEqual(status['unattemptedSources'],[])
 def test_missing_report_is_not_success(self):
  with tempfile.TemporaryDirectory() as folder:
   def fake(args,timeout=30):
    if args[:2]==['docker','inspect']:return json.dumps({'Running':False,'ExitCode':0,'OOMKilled':False,'FinishedAt':'now'})
    return ''
   manifest={'mainSha':'fixture','dbNetworkIp':'172.18.0.21','image':'jre@sha256:fixed'}
   with patch.object(m,'ROOT',Path(folder)),patch.object(m,'preflight',return_value=(manifest,{'source':{}})),patch.object(m,'command',side_effect=fake),patch.object(m.subprocess,'run'),patch.object(m.sys,'argv',['run.py']),patch.object(m.signal,'signal'),patch.object(m,'ResourceSampler') as sampler:
    sampler.return_value.stop.return_value={'state':'ERROR','writeErrors':1}
    self.assertEqual(m.main(),1)
   self.assertEqual(json.loads((Path(folder)/'status.json').read_text())['sources'][0]['error'],'REPORT_MISSING')
if __name__=='__main__':unittest.main()
