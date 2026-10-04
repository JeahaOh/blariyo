import copy
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

import validation as ci

REPO = 'owner/repo'
BASE, HEAD, MERGE, TREE, SYNTHETIC = (c * 40 for c in 'abcde')
CURRENT = {'sha': MERGE, 'tree': TREE, 'parents': [BASE, HEAD]}
PR = {'number': 15, 'merged_at': '2026-10-04T00:00:00Z', 'merge_commit_sha': MERGE,
      'base': {'ref': 'main', 'sha': BASE, 'repo': {'full_name': REPO}},
      'head': {'ref': 'release', 'sha': HEAD, 'repo': {'full_name': REPO}}}
RUN = {'id': 123, 'run_attempt': 2, 'workflow_id': 456, 'path': ci.WORKFLOW,
       'event': 'pull_request', 'status': 'completed', 'conclusion': 'success',
       'head_sha': HEAD, 'head_repository': {'full_name': REPO}}
NEEDS = {name: {'result': 'success'} for name in ci.JOBS}
ENV = {'GITHUB_REPOSITORY': REPO, 'GITHUB_RUN_ID': '123', 'GITHUB_RUN_ATTEMPT': '2', 'GITHUB_SHA': SYNTHETIC}
RECEIPT = ci.make_receipt({'pull_request': PR}, {**CURRENT, 'sha': SYNTHETIC}, ENV, NEEDS)
JOBS = [{'name': n, 'status': 'completed', 'conclusion': 'success'} for n in (*ci.JOBS, 'verify')]


class FakeGitHub:
    def __init__(self):
        self.pr = copy.deepcopy(PR)
        self.run = copy.deepcopy(RUN)
        self.receipt = copy.deepcopy(RECEIPT)
        self.jobs = copy.deepcopy(JOBS)
        self.artifacts = [{'id': 789, 'name': 'ci-verification-123-2', 'expired': False, 'size_in_bytes': 600}]

    def get(self, path):
        assert path == '/actions/workflows/ci.yml', path
        return {'id': 456}

    def pages(self, path, key=None):
        if path == f'/commits/{MERGE}/pulls':
            return [self.pr]
        if path == '/actions/workflows/ci.yml/runs?event=pull_request&status=success&head_sha=' + HEAD:
            return [self.run]
        if path == '/actions/runs/123/artifacts':
            return self.artifacts
        if path == '/actions/runs/123/attempts/2/jobs':
            return self.jobs
        raise AssertionError(path)

    def artifact(self, artifact):
        return self.receipt


def main_plan(api, current=CURRENT):
    return ci.plan('push', 'refs/heads/main', {}, current, REPO, api)


class ValidationTests(unittest.TestCase):
    def test_identical_verified_merge_reuses_pr(self):
        result = main_plan(FakeGitHub())
        self.assertFalse(result['full'])
        self.assertEqual(result['reused_run'], '123')

    def test_hotfix_is_supported(self):
        api = FakeGitHub()
        api.pr['head']['ref'] = 'hotfix-search'
        self.assertFalse(main_plan(api)['full'])

    def test_different_content_or_parent_requires_full(self):
        for field, value in [('tree', 'f' * 40), ('parents', ['f' * 40, HEAD]), ('parents', [BASE])]:
            with self.subTest(field=field, value=value):
                self.assertTrue(main_plan(FakeGitHub(), {**CURRENT, field: value})['full'])

    def test_only_merged_same_repository_release_or_hotfix_pr_is_eligible(self):
        mutations = [lambda p: p.update(merged_at=None),
                     lambda p: p.update(merge_commit_sha=BASE),
                     lambda p: p['head'].update(ref='feature/other'),
                     lambda p: p['head'].update(sha=BASE),
                     lambda p: p['head']['repo'].update(full_name='fork/repo'),
                     lambda p: p['base'].update(ref='release'),
                     lambda p: p['base']['repo'].update(full_name='other/repo')]
        for mutate in mutations:
            api = FakeGitHub()
            mutate(api.pr)
            self.assertTrue(main_plan(api)['full'])

    def test_wrong_workflow_head_attempt_or_partial_receipt_never_reuses(self):
        for field, value in [('workflow_id', 0), ('path', 'other.yml'), ('head_sha', BASE),
                             ('event', 'push'), ('status', 'in_progress'), ('conclusion', 'failure')]:
            api = FakeGitHub()
            api.run[field] = value
            self.assertTrue(main_plan(api)['full'], field)
        for field, value in [('schema', 2), ('scope', 'docs'), ('repository', 'fork/repo'),
                             ('workflow', 'other.yml'), ('run_id', 0), ('attempt', 1), ('pr', 9),
                             ('head', BASE), ('base', HEAD), ('parents', [HEAD, BASE]), ('tree', HEAD),
                             ('sha', ''), ('results', {})]:
            api = FakeGitHub()
            api.receipt[field] = value
            self.assertTrue(main_plan(api)['full'], field)

    def test_failed_skipped_missing_or_duplicate_job_requires_full(self):
        for name in (*ci.JOBS, 'verify'):
            for status in ('failure', 'skipped', 'cancelled', None):
                api = FakeGitHub()
                next(j for j in api.jobs if j['name'] == name)['conclusion'] = status
                self.assertTrue(main_plan(api)['full'], (name, status))
            api = FakeGitHub()
            api.jobs = [j for j in api.jobs if j['name'] != name]
            self.assertTrue(main_plan(api)['full'])
        api = FakeGitHub()
        api.jobs.append(api.jobs[0])
        self.assertTrue(main_plan(api)['full'])

    def test_missing_expired_old_attempt_or_duplicate_artifact_requires_full(self):
        for artifacts in ([], [{'name': 'ci-verification-123-1', 'size_in_bytes': 500}],
                          [{'name': 'ci-verification-123-2', 'size_in_bytes': 500, 'expired': True}],
                          [{'name': 'ci-verification-123-2', 'size_in_bytes': ci.LIMIT + 1}]):
            api = FakeGitHub()
            api.artifacts = artifacts
            self.assertTrue(main_plan(api)['full'])
        api = FakeGitHub()
        api.artifacts *= 2
        self.assertTrue(main_plan(api)['full'])

    def test_api_failure_falls_back_without_emitting_secret_errors(self):
        api = FakeGitHub()
        with patch.object(api, 'pages', side_effect=OSError('secret URL must not be logged')):
            self.assertEqual(main_plan(api), ci.full_plan('PR evidence unavailable; full verification required'))

    def test_manual_main_run_always_retests(self):
        self.assertTrue(ci.plan('workflow_dispatch', 'refs/heads/main', {}, CURRENT, REPO)['full'])

    def test_production_pr_is_full_even_for_docs(self):
        self.assertTrue(ci.plan('pull_request', '', {'pull_request': PR}, CURRENT, REPO,
                                paths=['worklog/day/README.md'])['full'])

    def test_nonproduction_docs_only_is_narrow_and_renames_cannot_hide_code(self):
        pr = copy.deepcopy(PR)
        pr['base']['ref'] = 'release'
        for paths, full in [(['README.md', 'worklog/day/README.md'], False),
                            (['docs/planning/plan.md'], False),
                            (['docs/development-specs/core/openapi.yaml'], True),
                            (['docs/development-specs/core/spec.md'], True),
                            (['docs/ai/git-workflow.md'], True),
                            (['worklog/test.sql'], True),
                            (['apps/api/src/old.ts', 'worklog/moved.md'], True),
                            (['package-lock.json'], True), ([], True)]:
            self.assertEqual(ci.plan('pull_request', '', {'pull_request': pr}, CURRENT, REPO,
                                    paths=paths)['full'], full, paths)

    def test_receipt_requires_every_job_and_synthetic_merge(self):
        for name in ci.JOBS:
            needs = copy.deepcopy(NEEDS)
            needs[name]['result'] = 'skipped'
            with self.assertRaises(ValueError):
                ci.make_receipt({'pull_request': PR}, {**CURRENT, 'sha': SYNTHETIC}, ENV, needs)
        with self.assertRaises(ValueError):
            ci.make_receipt({'pull_request': PR}, {**CURRENT, 'sha': SYNTHETIC, 'parents': [BASE]}, ENV, NEEDS)
        with self.assertRaises(ValueError):
            ci.make_receipt({'pull_request': PR}, CURRENT, ENV, NEEDS)

    def test_zip_reader_never_extracts_paths_or_accepts_multiple_files(self):
        for names in (['ci-verification.json'], ['../ci-verification.json'],
                      ['ci-verification.json', 'extra.py']):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as z:
                for name in names:
                    z.writestr(name, json.dumps(RECEIPT))
            if len(names) == 1 and names[0] == 'ci-verification.json':
                self.assertEqual(ci.read_receipt(output.getvalue()), RECEIPT)
            else:
                with self.assertRaises(ValueError):
                    ci.read_receipt(output.getvalue())

    def test_artifact_download_checks_digest_and_does_not_forward_api_token(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as z:
            z.writestr('ci-verification.json', json.dumps(RECEIPT))
        archive = output.getvalue()
        artifact = {'id': 789, 'digest': 'sha256:' + hashlib.sha256(archive).hexdigest()}
        api = ci.GitHub(REPO, 'test-token')

        class Redirect:
            def open(self, request, timeout):
                self.assertion(request)
                raise urllib.error.HTTPError(request.full_url, 302, 'redirect',
                                             {'Location': 'https://download.example.invalid/receipt'}, None)

            @staticmethod
            def assertion(request):
                assert request.get_header('Authorization') == 'Bearer test-token'
                assert request.full_url == 'https://api.github.com/repos/owner/repo/actions/artifacts/789/zip'

        def download(request, timeout):
            self.assertEqual(request.full_url, 'https://download.example.invalid/receipt')
            self.assertIsNone(request.get_header('Authorization'))
            return io.BytesIO(archive)

        with patch.object(ci.urllib.request, 'build_opener', return_value=Redirect()), \
                patch.object(ci.urllib.request, 'urlopen', side_effect=download):
            self.assertEqual(api.artifact(artifact), RECEIPT)
            with self.assertRaises(ValueError):
                api.artifact({**artifact, 'digest': 'sha256:' + '0' * 64})

    def test_real_git_merge_has_different_sha_but_identical_tested_tree_and_parents(self):
        with tempfile.TemporaryDirectory() as temp:
            env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
            env['GIT_CONFIG_NOSYSTEM'] = '1'
            env['GIT_CONFIG_GLOBAL'] = os.devnull
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=temp, env=env,
                                               stderr=subprocess.DEVNULL, text=True).strip()
            git('init', '-q', '-b', 'main')
            git('config', 'user.name', 'CI Test')
            git('config', 'user.email', 'ci@example.invalid')
            git('config', 'commit.gpgSign', 'false')
            Path(temp, 'app.txt').write_text('base\n')
            git('add', 'app.txt')
            git('commit', '-qm', 'base')
            base = git('rev-parse', 'HEAD')
            git('switch', '-c', 'release')
            Path(temp, 'app.txt').write_text('candidate\n')
            git('commit', '-qam', 'candidate')
            head = git('rev-parse', 'HEAD')
            git('switch', '-c', 'pr-synthetic', base)
            git('merge', '--no-ff', 'release', '-m', 'synthetic PR merge')
            synthetic = {'sha': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
                         'parents': git('show', '-s', '--format=%P').split()}
            git('switch', 'main')
            git('merge', '--no-ff', 'release', '-m', 'actual main merge')
            current = {'sha': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
                       'parents': git('show', '-s', '--format=%P').split()}
            self.assertNotEqual(current['sha'], synthetic['sha'])
            pr = copy.deepcopy(PR)
            pr['base']['sha'], pr['head']['sha'], pr['merge_commit_sha'] = base, head, current['sha']
            receipt = ci.make_receipt({'pull_request': pr}, synthetic, {**ENV, 'GITHUB_SHA': synthetic['sha']}, NEEDS)
            self.assertTrue(ci.matches(receipt, {**RUN, 'head_sha': head}, pr, current, REPO, JOBS))
            Path(temp, 'app.txt').write_text('changed after verification\n')
            git('commit', '-qam', 'changed content')
            current['tree'] = git('rev-parse', 'HEAD^{tree}')
            self.assertFalse(ci.matches(receipt, {**RUN, 'head_sha': head}, pr, current, REPO, JOBS))

    def test_gate_cli_fails_on_missing_checks_and_accepts_intentional_skips(self):
        script = Path(ci.__file__).resolve()
        with tempfile.TemporaryDirectory() as temp:
            event = Path(temp) / 'event.json'
            event.write_text('{}')
            for full in (True, False):
                needs = copy.deepcopy(NEEDS)
                needs['plan'] = {'result': 'success', 'outputs': {'full': str(full).lower()}}
                if not full:
                    for name in ci.JOBS[1:]:
                        needs[name]['result'] = 'skipped'
                def run():
                    return subprocess.run([sys_executable(), '-B', str(script), 'gate'], capture_output=True,
                                          env={**os.environ, 'GITHUB_EVENT_PATH': str(event), 'CI_NEEDS': json.dumps(needs)})
                self.assertEqual(run().returncode, 0)
                needs['quality']['result'] = 'failure'
                self.assertNotEqual(run().returncode, 0)
                needs['quality']['result'] = 'success'
                needs['browser']['result'] = 'failure'
                self.assertNotEqual(run().returncode, 0)


def sys_executable():
    import sys
    return sys.executable


if __name__ == '__main__':
    unittest.main()
