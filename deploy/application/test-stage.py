"""Staging failure/retry checks plus an optional Linux Docker permission probe. Synthetic input only."""
import base64
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('stage_mac', Path(__file__).with_name('stage-from-mac.py'))
mac = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mac)
server = mac.server
server.fingerprint = mac.migration.fingerprint


class StageTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='blariyo-stage-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = b'fixture archive bytes'
        self.files = {'api.env': b'NODE_ENV=production\n', 'web.env': b'NODE_ENV=production\n', 'compose.yaml': b'fixture compose',
                      'secrets/app-password': b'a' * 64 + b'\n', 'secrets/admin-operators.json': b'[{"active":true}]',
                      'bundle.json': json.dumps({'schemaVersion': 1, 'kind': 'runtime-inputs-only', 'productionReady': False,
                                               'serverSecretUid': 1000, 'serverSecretGid': 1000}).encode()}
        self.payload = {'schemaVersion': 1, 'expectedHostname': 'fixture-host', 'archiveSha256': server.digest(self.archive),
                        'archiveBytes': len(self.archive), 'composeSha256': server.digest(self.files['compose.yaml']),
                        'images': {role: {'tag': 'blariyo-' + role + ':candidate-test', 'fingerprint': 'c' * 64} for role in ('api', 'web')},
                        'files': {k: base64.b64encode(v).decode() for k, v in self.files.items()}}
        self.ids = {'api': 'sha256:' + 'a' * 64, 'web': 'sha256:' + 'b' * 64}

    def test_payload_scope_rejects_path_traversal_and_extra_secret(self):
        for name in ('../api.env', 'secrets/backup-password'):
            p = copy.deepcopy(self.payload)
            p['files'][name] = base64.b64encode(b'secret').decode()
            with self.assertRaisesRegex(ValueError, 'INVALID_STAGE_SCOPE'):
                server.validate(p)

    def test_archive_truncation_extra_and_hash_mismatch(self):
        for i, data in enumerate((self.archive[:-1], self.archive + b'x', b'x' * len(self.archive))):
            with self.assertRaisesRegex(ValueError, 'ARCHIVE_TRANSFER_'):
                server.receive_archive(io.BytesIO(data), self.root / str(i), len(self.archive), server.digest(self.archive))

    def test_unmanaged_directory_unchanged(self):
        base = self.root / 'application'
        base.mkdir(mode=0o700)
        (base / 'keep').write_bytes(b'unchanged')
        with self.assertRaises(FileNotFoundError):
            server.stage(base, self.payload, io.BytesIO(self.archive))
        self.assertEqual((base / 'keep').read_bytes(), b'unchanged')
        self.assertEqual(sorted(p.name for p in base.iterdir()), ['keep'])

    def test_symlink_rejected(self):
        (self.root / 'link').symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'UNSAFE_STAGE_PATH'):
            server.stage(self.root / 'link', self.payload, io.BytesIO(self.archive))

    def stage_mocks(self):
        from contextlib import ExitStack
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.object(server, 'SECRET_UID', os.getuid()))
        stack.enter_context(patch.object(server, 'SECRET_GID', os.getgid()))
        stack.enter_context(patch.object(server, 'inspect_images', return_value=self.ids))
        probe = stack.enter_context(patch.object(server, 'probe'))
        def command(args, **kwargs):
            return subprocess.CompletedProcess(args, 1 if args[1:3] == ['image', 'inspect'] else 0, b'', b'')
        proc = stack.enter_context(patch.object(server.subprocess, 'run', side_effect=command))
        return probe, proc

    def test_install_retry_and_modified_config_refused(self):
        probe, proc = self.stage_mocks()
        base = self.root / 'application'
        release = server.stage(base, self.payload, io.BytesIO(self.archive))
        self.assertEqual(json.loads((release / 'stage.json').read_bytes())['status'], 'STAGED_NO_SERVICES')
        for name, value in self.files.items():
            self.assertEqual((release / name).read_bytes(), value)
            self.assertEqual((release / name).stat().st_mode & 0o777, 0o600)
        before = (release / 'stage.json').stat().st_mtime_ns
        self.assertEqual(server.stage(base, self.payload, io.BytesIO(self.archive)), release)
        self.assertEqual((release / 'stage.json').stat().st_mtime_ns, before)
        self.assertEqual(probe.call_count, 2)
        # Only image commands, never compose up, policy publication, network connect or docker stop.
        self.assertTrue(all(call.args[0][1] == 'image' for call in proc.call_args_list))
        (release / 'api.env').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'EXISTING_STAGE_CHANGED'):
            server.stage(base, self.payload, io.BytesIO(self.archive))

    def test_probe_failure_never_marks_complete(self):
        probe, _ = self.stage_mocks()
        probe.side_effect = ValueError('FIXTURE_PROBE_FAILED')
        base = self.root / 'application'
        with self.assertRaisesRegex(ValueError, 'FIXTURE_PROBE_FAILED'):
            server.stage(base, self.payload, io.BytesIO(self.archive))
        self.assertFalse(list(base.glob('release-*')))
        self.assertFalse(list(base.rglob('stage.json')))
        self.assertEqual(len(list(base.glob('.incomplete-*'))), 1)

    def test_conflicting_image_tag_does_not_load(self):
        self.stage_mocks()
        info = {'Architecture': 'amd64', 'Os': 'linux', 'RootFS': {'Type': 'layers', 'Layers': []}, 'Config': {'User': 'other'}}
        with patch.object(server.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, json.dumps([info]).encode(), b'')) as proc:
            with self.assertRaisesRegex(ValueError, 'EXISTING_IMAGE_TAG_CONFLICT'):
                server.stage(self.root / 'application', self.payload, io.BytesIO(self.archive))
        self.assertEqual(proc.call_count, 1)

    def test_raw_env_quotes_preserved_duplicates_refused(self):
        self.assertEqual(mac.raw_env(b"VALUE=O'Reilly $literal \\\n"), {'VALUE': "O'Reilly $literal \\"})
        with self.assertRaisesRegex(ValueError, 'INVALID_RAW_ENV'):
            mac.raw_env(b'KEY=a\nKEY=b\n')


def docker_probe():
    meta = mac.images.verify(mac.DEFAULT_IMAGES)
    volume = 'blariyo-stage-probe-' + secrets.token_hex(6)
    api = meta['images']['api']['id']
    def run(args, data=None):
        result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
        if result.returncode:
            raise ValueError('SYNTHETIC_DOCKER_PROBE_FAILED')
        return result.stdout
    run(['docker', 'volume', 'create', volume])
    try:
        code = "const fs=require('fs');fs.writeFileSync('/probe/app-password','a'.repeat(64)+'\\n',{mode:384});fs.writeFileSync('/probe/admin-operators.json',JSON.stringify([{active:true}]),{mode:384});for(const f of ['app-password','admin-operators.json'])fs.chownSync('/probe/'+f,1000,1000)"
        run(['docker', 'run', '--rm', '--network', 'none', '--user', '0:0', '--mount', 'type=volume,src=' + volume + ',dst=/probe', '--entrypoint', 'node', api, '-e', code])
        with tempfile.TemporaryDirectory(prefix='blariyo-stage-compose-') as temp:
            directory = Path(temp)
            (directory / 'compose.yaml').write_bytes((mac.HERE / 'compose.yaml').read_bytes())
            for role in ('api', 'web'):
                (directory / (role + '.env')).write_text('NODE_ENV=production\n')
            (directory / 'images.env').write_text(''.join('BLARIYO_' + role.upper() + '_IMAGE=' + meta['images'][role]['id'] + '\n' for role in ('api', 'web')))
            def command(args, data=None):
                args = list(args)
                if '--mount' in args:
                    # Use a temporary Linux volume instead of chown on the user's Mac.
                    args[args.index('--mount') + 1] = 'type=volume,src=' + volume + ',dst=/run/secrets,readonly'
                return run(args, data)
            with patch.object(server, 'run', side_effect=command):
                server.probe(directory, {role: meta['images'][role]['id'] for role in ('api', 'web')})
        print('PASS actual amd64 images: Linux UID 1000 reads mode 600 synthetic secrets, network none, read-only root')
    finally:
        run(['docker', 'volume', 'rm', volume])


if __name__ == '__main__':
    if sys.argv[1:] == ['--docker-probe']:
        docker_probe()
    else:
        unittest.main()
