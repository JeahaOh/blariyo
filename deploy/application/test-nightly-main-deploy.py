#!/usr/bin/env python3
import importlib.util
import json
import os
import stat
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
        assert stat.S_IMODE((target / 'images.env').stat().st_mode) == 0o600
        assert stat.S_IMODE((target / 'api.env').stat().st_mode) == 0o600
        assert stat.S_IMODE((target / 'web.env').stat().st_mode) == 0o600
        assert stat.S_IMODE((target / 'secrets/app-password').stat().st_mode) == 0o600


def test_smoke_uses_public_https_urls(monkeypatch=None):
    calls = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return ''

    original = nightly.run
    nightly.run = fake_run
    try:
        nightly.smoke('https://example.com/')
    finally:
        nightly.run = original
    assert calls[0][:2] == ['docker', 'inspect']
    assert calls[1][-1] == 'https://example.com/health/live'
    assert calls[2][-1] == 'https://example.com/meme'


def test_restart_release_restarts_then_waits():
    calls = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return ''

    original = nightly.run
    nightly.run = fake_run
    try:
        nightly.restart_release(Path('/release-current'))
    finally:
        nightly.run = original
    assert calls[0][-2:] == ['config', '--quiet']
    assert calls[1][-3:] == ['restart', 'api', 'web']
    assert calls[2][-1] == 'api'
    assert calls[3][-1] == 'web'


if __name__ == '__main__':
    test_read_env_and_sha_parse()
    test_copy_release_preserves_runtime_and_rewrites_images()
    test_smoke_uses_public_https_urls()
    test_restart_release_restarts_then_waits()
    print('PASS nightly main deploy tests')
