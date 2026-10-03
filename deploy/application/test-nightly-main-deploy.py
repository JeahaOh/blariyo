#!/usr/bin/env python3
import importlib.util
import json
import os
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('nightly', HERE / 'nightly-main-deploy-server.py')
nightly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nightly)


def test_read_env_and_sha_parse():
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'nightly-main.env'
        path.write_text('# comment\nBLARIYO_MAIN_REPO=https://example.invalid/repo.git\nbad-name=x\nBLARIYO_IMAGE_PREFIX=ghcr.io/x/y\n')
        values = nightly.read_env(path)
        assert values == {
            'BLARIYO_MAIN_REPO': 'https://example.invalid/repo.git',
            'BLARIYO_IMAGE_PREFIX': 'ghcr.io/x/y',
        }
    assert nightly.sha_from_release(Path('/opt/blariyo/application/release-abcdef1-main-nightly-20261003T180000Z')) == 'abcdef1'
    assert nightly.sha_from_release(Path('/opt/blariyo/application/current')) == ''


def test_copy_release_preserves_runtime_and_rewrites_images():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        source = root / 'release-old'
        target = root / 'release-new'
        (source / 'secrets').mkdir(parents=True)
        for name in ['compose.yaml', 'production-logging.yaml', 'api.env', 'web.env', 'images.env', 'secrets/app-password', 'secrets/admin-operators.json']:
            p = source / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(name + '\n')
        (source / 'stage.json').write_text('old')
        nightly.copy_release(source, target, 'api@sha256:1', 'web@sha256:2', 'a' * 40)
        assert (target / 'compose.yaml').read_text() == 'compose.yaml\n'
        assert (target / 'images.env').read_text() == 'BLARIYO_API_IMAGE=api@sha256:1\nBLARIYO_WEB_IMAGE=web@sha256:2\n'
        assert not (target / 'stage.json').exists()
        marker = json.loads((target / 'nightly-main-release.json').read_text())
        assert marker['mainSha'] == 'a' * 40
        assert marker['baseRelease'] == str(source)


if __name__ == '__main__':
    test_read_env_and_sha_parse()
    test_copy_release_preserves_runtime_and_rewrites_images()
    print('PASS nightly main deploy tests')
