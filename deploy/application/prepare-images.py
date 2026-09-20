#!/usr/bin/env python3
"""Build and verify local amd64 images. No SSH, registry push, or production input access."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parents[2]
NODE = Path.home() / '.nvm/versions/node/v24.18.0/bin/node'
INPUTS = ['Dockerfile', '.dockerignore', 'package.json', 'package-lock.json',
          'apps/api', 'apps/web', 'packages', 'scripts',
          'docs/development-specs/m0-core/openapi',
          'docs/development-specs/m0-collection-assist/openapi']
ID = re.compile(r'sha256:[a-f0-9]{64}')
HASH = re.compile(r'[a-f0-9]{64}')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(file):
    result = hashlib.sha256()
    with file.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def run(args, cwd=REPO, env=None, timeout=120, log=None):
    if log:
        with log.open('xb') as output:
            os.chmod(log, 0o600)
            result = subprocess.run(args, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=timeout)
    else:
        result = subprocess.run(args, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        raise ValueError('SUBPROCESS_FAILED')
    return result.stdout if not log else b''


def source_files(repo=REPO):
    # Git enumerates tracked and unignored untracked source, not ignored private/runtime files.
    output = run(['git', 'ls-files', '-c', '-o', '--exclude-standard', '-z', '--', *INPUTS], cwd=repo)
    files = sorted(set(output.decode().rstrip('\0').split('\0')))
    if not files or not all(required in files for required in INPUTS[:4]):
        raise ValueError('BUILD_INPUT_MISSING')
    records = []
    for name in files:
        parts = PurePosixPath(name).parts
        if not parts or '..' in parts or PurePosixPath(name).is_absolute():
            raise ValueError('SOURCE_PATH_INVALID')
        if any(p in {'node_modules', 'dist', 'dist-test', '.nuxt', '.output', '.git'} for p in parts):
            raise ValueError('GENERATED_BUILD_INPUT')
        if any(p == '.env' or p.startswith('.env.') or p.endswith(('.pem', '.key', '.env')) for p in parts):
            raise ValueError('PRIVATE_BUILD_INPUT')
        file = repo / name
        # Reject a symlink at any component, including a source directory.
        if any((repo.joinpath(*parts[:i])).is_symlink() for i in range(1, len(parts) + 1)):
            raise ValueError('SOURCE_SYMLINK_FORBIDDEN')
        info = file.stat()
        if not stat.S_ISREG(info.st_mode):
            raise ValueError('SOURCE_FILE_INVALID')
        records.append({'path': name, 'sha256': file_hash(file), 'executable': bool(info.st_mode & 0o111)})
    return records


def source_digest(records):
    return digest(json.dumps(records, sort_keys=True, separators=(',', ':')).encode())


def snapshot(destination, records, repo=REPO):
    destination.mkdir(mode=0o700)
    for item in records:
        target = destination / item['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        with (repo / item['path']).open('rb') as source, target.open('xb') as output:
            shutil.copyfileobj(source, output)
        target.chmod(0o700 if item['executable'] else 0o600)
        if file_hash(target) != item['sha256']:
            raise ValueError('SOURCE_CHANGED_DURING_COPY')


def json_write(file, value):
    with file.open('x') as output:
        os.chmod(file, 0o600)
        json.dump(value, output, ensure_ascii=False, indent=2)
        output.write('\n')


def archive_images(archive, images):
    """Read Docker save metadata without extracting any archive paths."""
    with tarfile.open(archive, 'r:') as bundle:
        members = bundle.getmembers()
        index = {m.name: m for m in members}
        if len(index) != len(members):
            raise ValueError('ARCHIVE_DUPLICATE_PATH')

        def read_json(name):
            member = index.get(name)
            if not member or not member.isfile() or member.size > 4 * 1024 * 1024:
                raise ValueError('ARCHIVE_METADATA_INVALID')
            data = bundle.extractfile(member).read()
            return data, json.loads(data)

        _, entries = read_json('manifest.json')
        if not isinstance(entries, list) or len(entries) != 2:
            raise ValueError('ARCHIVE_IMAGE_COUNT')
        identities = {}
        for role in ['api', 'web']:
            expected = images[role]
            matching = [e for e in entries if expected['tag'] in (e.get('RepoTags') or [])]
            if len(matching) != 1:
                raise ValueError('ARCHIVE_TAG_MISMATCH')
            raw, config = read_json(matching[0]['Config'])
            config_digest = 'sha256:' + digest(raw)
            if expected.get('configDigest', config_digest) != config_digest:
                raise ValueError('ARCHIVE_CONFIG_DIGEST_MISMATCH')
            # Classic stores report config digest as Id; containerd may report an OCI
            # index/manifest digest. Follow the hashed graph instead of comparing unlike IDs.
            kind = 'image-config'
            if config_digest != expected['id']:
                _, top = read_json('index.json')
                links = [d for d in top.get('manifests', []) if d.get('digest') == expected['id'] and
                         d.get('annotations', {}).get('io.containerd.image.name') in
                         [expected['tag'], 'docker.io/library/' + expected['tag']]]
                if len(links) != 1:
                    raise ValueError('ARCHIVE_IMAGE_ID_MISMATCH')
                descriptor = links[0]
                kind = descriptor.get('mediaType', '')
                for _ in range(4):
                    reference = descriptor.get('digest', '')
                    if not ID.fullmatch(reference):
                        raise ValueError('ARCHIVE_DESCRIPTOR_INVALID')
                    blob, document = read_json('blobs/sha256/' + reference[7:])
                    if digest(blob) != reference[7:] or len(blob) != descriptor.get('size'):
                        raise ValueError('ARCHIVE_DESCRIPTOR_HASH_MISMATCH')
                    if 'config' in document:
                        if document['config'].get('digest') != config_digest or document['config'].get('size') != len(raw):
                            raise ValueError('ARCHIVE_CONFIG_LINK_MISMATCH')
                        break
                    candidates = [d for d in document.get('manifests', []) if
                                  d.get('platform', {}).get('architecture') == 'amd64' and
                                  d.get('platform', {}).get('os') == 'linux']
                    if len(candidates) != 1:
                        raise ValueError('ARCHIVE_PLATFORM_DESCRIPTOR_INVALID')
                    descriptor = candidates[0]
                else:
                    raise ValueError('ARCHIVE_DESCRIPTOR_DEPTH')
            if config.get('architecture') != 'amd64' or config.get('os') != 'linux':
                raise ValueError('ARCHIVE_PLATFORM_MISMATCH')
            if config.get('config', {}).get('User') not in ['node', '1000:1000']:
                raise ValueError('ARCHIVE_IMAGE_USER_INVALID')
            layers = matching[0].get('Layers')
            if not layers or len(layers) != len(config.get('rootfs', {}).get('diff_ids', [])):
                raise ValueError('ARCHIVE_LAYERS_INVALID')
            for layer in layers:
                if layer not in index or not index[layer].isfile() or index[layer].size == 0:
                    raise ValueError('ARCHIVE_LAYER_MISSING')
            identities[role] = {'configDigest': config_digest, 'localIdType': kind}
        return identities


def verify(directory):
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('BUNDLE_DIRECTORY_INVALID')
    manifest_file = directory / 'manifest.json'
    if manifest_file.is_symlink() or not manifest_file.is_file():
        raise ValueError('BUNDLE_INCOMPLETE')
    meta = json.loads(manifest_file.read_text())
    if meta.get('schemaVersion') != 1 or meta.get('kind') != 'blariyo-amd64-images' or meta.get('status') != 'LOCAL_IMAGE_CHECKED':
        raise ValueError('BUNDLE_NOT_CHECKED')
    if set(meta.get('images', {})) != {'api', 'web'}:
        raise ValueError('BUNDLE_IMAGES_INVALID')
    for role, image in meta['images'].items():
        if not ID.fullmatch(image.get('id', '')) or not ID.fullmatch(image.get('configDigest', '')) or not re.fullmatch(r'blariyo-' + role + r':candidate-[a-z0-9_-]+', image.get('tag', '')):
            raise ValueError('BUNDLE_IMAGE_REFERENCE_INVALID')
    archive = directory / 'images.tar'
    if archive.is_symlink() or not archive.is_file() or file_hash(archive) != meta.get('archiveSha256'):
        raise ValueError('IMAGE_ARCHIVE_MISMATCH')
    source = directory / 'source-manifest.json'
    if source.is_symlink() or not source.is_file() or file_hash(source) != meta.get('sourceManifestSha256'):
        raise ValueError('SOURCE_MANIFEST_MISMATCH')
    source_meta = json.loads(source.read_text())
    if source_digest(source_meta['files']) != meta.get('sourceSha256'):
        raise ValueError('SOURCE_DIGEST_MISMATCH')
    archive_images(archive, meta['images'])
    return meta


def build(output_parent):
    if output_parent.is_symlink() or not output_parent.is_dir() or output_parent.stat().st_uid != os.getuid() or output_parent.stat().st_mode & 0o022:
        raise ValueError('OUTPUT_DIRECTORY_INVALID')
    if run([str(NODE), '--version']).strip() != b'v24.18.0':
        raise ValueError('NODE_VERSION_MISMATCH')
    run(['docker', 'version', '--format', '{{.Server.Version}}'])
    records = source_files()
    source_sha = source_digest(records)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    destination = Path(tempfile.mkdtemp(prefix='blariyo-app-images-' + timestamp + '-', dir=output_parent))
    destination.chmod(0o700)
    context = destination / 'source'
    snapshot(context, records)
    json_write(destination / 'source-manifest.json', {'gitHead': run(['git', 'rev-parse', 'HEAD']).decode().strip(),
               'gitDirty': bool(run(['git', 'status', '--porcelain'])), 'files': records, 'sourceSha256': source_sha})
    buildx = Path(tempfile.mkdtemp(prefix='blariyo-app-buildx-'))
    env = {**os.environ, 'BUILDX_CONFIG': str(buildx)}
    suffix = timestamp.lower() + '-' + source_sha[:12] + '-' + destination.name.split('-')[-1]
    images = {}
    print('진행 source snapshot 고정 — 운영 비밀 파일·로컬 build 산출물 제외', flush=True)
    print('준비 폴더: ' + str(destination), flush=True)
    try:
        for role in ['api', 'web']:
            tag = 'blariyo-' + role + ':candidate-' + suffix
            print('진행 linux/amd64 ' + role + ' image build', flush=True)
            run(['docker', 'buildx', 'build', '--platform', 'linux/amd64', '--target', role,
                 '--tag', tag, '--load', '--iidfile', str(destination / (role + '.iid')), str(context)],
                env=env, timeout=1800, log=destination / (role + '-build.log'))
            data = json.loads(run(['docker', 'image', 'inspect', tag]))[0]
            if data['Architecture'] != 'amd64' or data['Os'] != 'linux' or not ID.fullmatch(data['Id']):
                raise ValueError('BUILT_IMAGE_PLATFORM_INVALID')
            if data['Config'].get('User') != 'node' or data['Config'].get('Cmd') != ['node', 'apps/api/dist/main.js' if role == 'api' else 'server/index.mjs']:
                raise ValueError('BUILT_IMAGE_ENTRYPOINT_INVALID')
            images[role] = {'tag': tag, 'id': data['Id'], 'platform': 'linux/amd64'}
            check = "if(process.version!=='v24.18.0'||process.arch!=='x64'||process.getuid()!==1000)process.exit(1);"
            if role == 'api':
                check += "require('sharp')({create:{width:1,height:1,channels:4,background:'#000'}}).png().toBuffer().then(b=>{if(b[0]!==137)process.exit(1)}).catch(()=>process.exit(1));"
            run(['docker', 'run', '--rm', '--platform', 'linux/amd64', '--network', 'none', '--read-only',
                 data['Id'], 'node', '-e', check], timeout=120)
            print('PASS ' + role + ' — amd64·Node 24.18.0·비루트 실행' + ('·Sharp PNG 생성' if role == 'api' else ''), flush=True)
        print('진행 동일 image ID로 격리 Docker 통합 검사 — 합성 DB·정책·Access 사용', flush=True)
        run([str(NODE), 'scripts/test-docker.ts', '--api-image', images['api']['id'], '--web-image', images['web']['id']],
            timeout=900, log=destination / 'docker-smoke.log')
        if source_files() != records:
            raise ValueError('SOURCE_CHANGED_DURING_BUILD')
        print('PASS 격리 앱 검사 — production Web/Core·정책 조회·발행/숨김·운영 명령·dump/restore', flush=True)
        archive = destination / 'images.tar'
        run(['docker', 'image', 'save', '--output', str(archive), images['api']['tag'], images['web']['tag']], timeout=600)
        archive.chmod(0o600)
        identities = archive_images(archive, images)
        for role in images:
            images[role].update(identities[role])
        meta = {'schemaVersion': 1, 'kind': 'blariyo-amd64-images', 'status': 'LOCAL_IMAGE_CHECKED',
                'createdAt': datetime.now(timezone.utc).isoformat(), 'images': images,
                'sourceSha256': source_sha, 'sourceManifestSha256': file_hash(destination / 'source-manifest.json'),
                'archiveSha256': file_hash(archive), 'archiveBytes': archive.stat().st_size,
                'checks': ['platform-node-user', 'sharp-png', 'isolated-docker-production-smoke', 'archive-config-id'],
                'productionDeployed': False, 'productionReady': False,
                'unverified': ['production-compose', 'server-resources', 'real-access-login', 'policy-release', 'gateway-tunnel', 'remote-backup']}
        # The completion marker is written only after build, smoke and archive validation.
        json_write(destination / 'manifest.json', meta)
        verify(destination)
        print('PASS image archive — SHA-256·내부 image ID·source 추적 확인', flush=True)
        print('완료 폴더: ' + str(destination), flush=True)
        return destination
    finally:
        shutil.rmtree(buildx)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument('--build', action='store_true')
    actions.add_argument('--verify', type=Path)
    parser.add_argument('--output-parent', type=Path, default=Path.home() / 'task_list')
    args = parser.parse_args()
    if args.build:
        build(args.output_parent)
    else:
        meta = verify(args.verify)
        print('PASS Web·Core amd64 image 묶음 — archive SHA-256·image ID·source manifest')
        print('archive 크기: ' + str(meta['archiveBytes']) + ' bytes')
    print('검증 범위: 로컬 image 및 격리 검사. 서버 배포·실제 정책 발행·로그인·부하·원격 백업은 미검증입니다.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch('[A-Z_]+', str(error)) else 'IMAGE_PREPARATION_FAILED'
        print('FAIL ' + code + ' — 서버 변경 없음. 완료 manifest가 없는 폴더는 배포에 사용하지 마세요.', file=sys.stderr)
        sys.exit(1)
