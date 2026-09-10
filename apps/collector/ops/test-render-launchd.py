import importlib.util
import json
import os
from pathlib import Path
import plistlib
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('renderer',Path(__file__).with_name('render-launchd.py'))
renderer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
class LaunchdTests(unittest.TestCase):
    def test_private_paths_service_and_daily_backup(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary).resolve()
            java=root/'java';java.write_text('#!/bin/sh\nexit 0\n');java.chmod(0o700)
            jar=root/'collector.jar';jar.write_bytes(b'fixture')
            properties=root/'collector.properties';properties.write_text('collector.processing-enabled=false\n');properties.chmod(0o600)
            config={'java':str(java),'jar':str(jar),'workingDirectory':str(root),'properties':str(properties),'logDirectory':str(root),'backupDirectory':str(root)}
            result=renderer.render(config,root/'generated')
            data=plistlib.loads(result.read_bytes())
            self.assertEqual(data['Umask'],0o077)
            self.assertEqual(data['ExitTimeOut'],90)
            self.assertNotIn('EnvironmentVariables',data)
            self.assertEqual(plistlib.loads(result.with_name('com.blariyo.collector.backup.plist').read_bytes())['StartCalendarInterval'],{'Hour':3,'Minute':15})
            properties.write_text('spring.datasource.password: fixture-secret\n')
            with self.assertRaises(ValueError):renderer.render(config,root/'rejected')
            properties.write_text('collector.processing-enabled=false\n');properties.chmod(0o644)
            with self.assertRaises(ValueError):renderer.render(config,root/'rejected')
            properties.chmod(0o600);link=root/'link.properties';link.symlink_to(properties);config['properties']=str(link)
            with self.assertRaises(ValueError):renderer.render(config,root/'rejected')
if __name__=='__main__':unittest.main()
