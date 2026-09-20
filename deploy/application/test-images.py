"""Offline negative cases for archive identity, scope and source snapshot validation."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('prepare_images', Path(__file__).with_name('prepare-images.py'))
images = importlib.util.module_from_spec(spec)
spec.loader.exec_module(images)


class ImageBundleTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='blariyo-image-test-')
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def bundle(self, architecture='amd64', oci=False, broken_link=False):
        archive = self.root / 'images.tar'
        source = {'files': [{'path': 'Dockerfile', 'sha256': 'a' * 64, 'executable': False}]}
        images.json_write(self.root / 'source-manifest.json', source)
        manifest = {'schemaVersion': 1, 'kind': 'blariyo-amd64-images', 'status': 'LOCAL_IMAGE_CHECKED', 'images': {},
                    'sourceManifestSha256': images.file_hash(self.root / 'source-manifest.json'),
                    'sourceSha256': images.source_digest(source['files'])}
        docker_manifest = []
        oci_index = []
        with tarfile.open(archive, 'w') as bundle:
            added = set()
            def add(name, value):
                if name in added:
                    return
                added.add(name)
                member = tarfile.TarInfo(name)
                member.size = len(value)
                bundle.addfile(member, io.BytesIO(value))
            for role in ['api', 'web']:
                config = json.dumps({'architecture': architecture, 'os': 'linux', 'config': {'User': 'node'},
                                     'rootfs': {'diff_ids': ['sha256:' + 'b' * 64]}}).encode()
                image_id = 'sha256:' + hashlib.sha256(config).hexdigest()
                tag = 'blariyo-' + role + ':candidate-test_123'
                manifest['images'][role] = {'tag': tag, 'id': image_id, 'configDigest': image_id}
                add(role + '/config.json', config)
                add(role + '/layer.tar', b'synthetic archive member')
                docker_manifest.append({'Config': role + '/config.json', 'RepoTags': [tag], 'Layers': [role + '/layer.tar']})
                if oci:
                    blob = json.dumps({'config': {'digest': 'sha256:' + 'f' * 64 if broken_link else image_id, 'size': len(config)}}).encode()
                    reference = 'sha256:' + hashlib.sha256(blob).hexdigest()
                    add('blobs/sha256/' + reference[7:], blob)
                    child = {'digest': reference, 'size': len(blob), 'platform': {'os': 'linux', 'architecture': architecture}}
                    # Different role configs can share IDs, so use a role-specific descriptor field.
                    index_blob = json.dumps({'manifests': [child], 'annotations': {'fixture': role}}).encode()
                    index_id = 'sha256:' + hashlib.sha256(index_blob).hexdigest()
                    add('blobs/sha256/' + index_id[7:], index_blob)
                    # Shared manifest blobs need only one archive entry.
                    manifest['images'][role]['id'] = index_id
                    oci_index.append({'digest': index_id, 'size': len(index_blob), 'mediaType': 'application/vnd.oci.image.index.v1+json',
                                      'annotations': {'io.containerd.image.name': 'docker.io/library/' + tag}})
            add('manifest.json', json.dumps(docker_manifest).encode())
            if oci:
                add('index.json', json.dumps({'manifests': oci_index}).encode())
        manifest['archiveSha256'] = images.file_hash(archive)
        images.json_write(self.root / 'manifest.json', manifest)
        return manifest

    def test_valid_bundle_and_changed_archive(self):
        self.bundle()
        self.assertEqual(images.verify(self.root)['status'], 'LOCAL_IMAGE_CHECKED')
        with (self.root / 'images.tar').open('ab') as output:
            output.write(b'modified')
        with self.assertRaisesRegex(ValueError, 'IMAGE_ARCHIVE_MISMATCH'):
            images.verify(self.root)

    def test_wrong_architecture(self):
        self.bundle('arm64')
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_PLATFORM_MISMATCH'):
            images.verify(self.root)

    def test_containerd_index_to_config(self):
        self.bundle(oci=True)
        images.verify(self.root)

    def test_containerd_wrong_config_link(self):
        self.bundle(oci=True, broken_link=True)
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_CONFIG_LINK_MISMATCH'):
            images.verify(self.root)

    def test_mismatched_image_id(self):
        manifest = self.bundle()
        manifest['images']['api']['id'] = 'sha256:' + 'f' * 64
        (self.root / 'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'ARCHIVE_METADATA_INVALID|ARCHIVE_IMAGE_ID_MISMATCH'):
            images.verify(self.root)

    def test_missing_completion_and_changed_source(self):
        self.bundle()
        manifest_file = self.root / 'manifest.json'
        manifest = manifest_file.read_bytes()
        manifest_file.unlink()
        with self.assertRaisesRegex(ValueError, 'BUNDLE_INCOMPLETE'):
            images.verify(self.root)
        manifest_file.write_bytes(manifest)
        (self.root / 'source-manifest.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'SOURCE_MANIFEST_MISMATCH'):
            images.verify(self.root)

    def test_archive_symlink(self):
        self.bundle()
        (self.root / 'images.tar').rename(self.root / 'original.tar')
        (self.root / 'images.tar').symlink_to(self.root / 'original.tar')
        with self.assertRaisesRegex(ValueError, 'IMAGE_ARCHIVE_MISMATCH'):
            images.verify(self.root)

    def test_snapshot_rejects_symlink_and_private_file(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        for name in images.INPUTS[:4]:
            (self.root / name).write_text('fixture')
        (self.root / 'apps/api').mkdir(parents=True)
        original = images.source_files(self.root)
        snapshot = self.root / 'snapshot'
        images.snapshot(snapshot, original, self.root)
        self.assertEqual((snapshot / 'Dockerfile').read_text(), 'fixture')
        private = self.root / 'apps/api/settings.env'
        private.write_text('not a credential')
        with self.assertRaisesRegex(ValueError, 'PRIVATE_BUILD_INPUT'):
            images.source_files(self.root)
        private.unlink()
        (self.root / 'apps/api/linked.ts').symlink_to(self.root / 'Dockerfile')
        with self.assertRaisesRegex(ValueError, 'SOURCE_SYMLINK_FORBIDDEN'):
            images.source_files(self.root)


if __name__ == '__main__':
    unittest.main()
