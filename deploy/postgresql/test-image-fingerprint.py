#!/usr/bin/env python3
"""Regression: Docker inspect defaults must not hide actual image differences."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('migration', Path(__file__).with_name('migrate-server.py'))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class FingerprintTests(unittest.TestCase):
    def setUp(self):
        self.current = {'Architecture': 'amd64', 'Os': 'linux',
                        'Config': {'User': 'node', 'WorkingDir': '/app', 'Env': ['NODE_ENV=production'],
                                   'Cmd': ['node', 'apps/api/dist/main.js'], 'Entrypoint': ['docker-entrypoint.sh'], 'ArgsEscaped': True},
                        'RootFS': {'Type': 'layers', 'Layers': ['sha256:' + 'a' * 64, 'sha256:' + 'b' * 64]}}

    def test_old_api_defaults_match_new_api_omissions(self):
        old = copy.deepcopy(self.current)
        old['Config'].update(Hostname='', Domainname='', Image='', MacAddress='', AttachStdin=False,
                             AttachStdout=False, AttachStderr=False, Tty=False, OpenStdin=False, StdinOnce=False,
                             NetworkDisabled=False, StopTimeout=0, Labels=None, OnBuild=None, Volumes=None)
        self.assertEqual(server.fingerprint(old), server.fingerprint(self.current))
        old['Config'].update(Labels={}, OnBuild=[], Volumes={})
        self.assertEqual(server.fingerprint(old), server.fingerprint(self.current))

    def test_empty_runtime_fields_match_omissions(self):
        for key, empty in [('Cmd', []), ('Entrypoint', []), ('Env', []), ('User', ''), ('WorkingDir', '')]:
            old = copy.deepcopy(self.current)
            new = copy.deepcopy(self.current)
            old['Config'][key] = empty
            del new['Config'][key]
            self.assertEqual(server.fingerprint(old), server.fingerprint(new))

    def test_actual_configuration_changes_remain_different(self):
        for key, value in [('User', 'root'), ('WorkingDir', '/tmp'), ('Env', ['NODE_ENV=test']),
                           ('Cmd', ['sh']), ('Entrypoint', ['sh']), ('Labels', {'changed': 'yes'}),
                           ('OnBuild', ['RUN true']), ('Volumes', {'/data': {}}), ('Hostname', 'changed'),
                           ('Tty', True), ('UnknownFutureField', False)]:
            with self.subTest(key=key):
                changed = copy.deepcopy(self.current)
                changed['Config'][key] = value
                self.assertNotEqual(server.fingerprint(changed), server.fingerprint(self.current))

    def test_platform_layer_content_and_order_remain_different(self):
        for key, value in [('Architecture', 'arm64'), ('Os', 'windows'),
                           ('RootFS', {'Type': 'layers', 'Layers': list(reversed(self.current['RootFS']['Layers']))}),
                           ('RootFS', {'Type': 'layers', 'Layers': ['sha256:' + 'c' * 64]})]:
            changed = copy.deepcopy(self.current)
            changed[key] = value
            self.assertNotEqual(server.fingerprint(changed), server.fingerprint(self.current))


if __name__ == '__main__':
    unittest.main()
