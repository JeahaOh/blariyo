#!/usr/bin/env python3
"""Plan CI and reuse only successful PR evidence for an identical main merge."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile

WORKFLOW = '.github/workflows/ci.yml'
JOBS = ('quality', 'integration', 'browser', 'collector')
SHA = re.compile(r'^[0-9a-f]{40}$')
LIMIT = 1024 * 1024


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def snapshot():
    return {'sha': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
            'parents': git('show', '-s', '--format=%P', 'HEAD').split()}


def docs_only(paths):
    # Deliberately narrow: specs, OpenAPI, configuration and arbitrary docs files
    # may be executable inputs. Renames include both the old and new paths.
    return bool(paths) and all(
        p.endswith('.md') and (p.startswith('worklog/') or p in ('README.md',)
                              or p.startswith('docs/planning/') or p.startswith('docs/legal/'))
        for p in paths)


def full_plan(reason):
    return {'full': True, 'reason': reason, 'reused_run': ''}


def eligible_pr(pr, current, repo):
    return (pr.get('merged_at') is not None and pr.get('merge_commit_sha') == current['sha']
            and pr.get('base', {}).get('ref') == 'main'
            and pr.get('base', {}).get('repo', {}).get('full_name') == repo
            and pr.get('head', {}).get('repo', {}).get('full_name') == repo
            and (pr['head']['ref'] == 'release' or pr['head']['ref'].startswith('hotfix-'))
            and len(current['parents']) == 2 and pr['head']['sha'] == current['parents'][1])


def matches(receipt, run, pr, current, repo, jobs):
    # A successful workflow with skipped heavy jobs is not full verification.
    return (receipt.get('schema') == 1 and receipt.get('scope') == 'full'
            and receipt.get('repository') == repo and receipt.get('workflow') == WORKFLOW
            and receipt.get('run_id') == run['id'] and receipt.get('attempt') == run['run_attempt']
            and receipt.get('pr') == pr['number']
            and receipt.get('head') == pr['head']['sha'] == run['head_sha']
            and receipt.get('base') == current['parents'][0]
            and receipt.get('parents') == current['parents']
            and receipt.get('tree') == current['tree']
            and isinstance(receipt.get('sha'), str) and SHA.fullmatch(receipt['sha']) is not None
            and receipt.get('results') == dict.fromkeys(JOBS, 'success')
            and successful_jobs(jobs))


def successful_jobs(jobs):
    for name in (*JOBS, 'verify'):
        selected = [job for job in jobs if job.get('name') == name]
        if len(selected) != 1 or selected[0].get('status') != 'completed' or selected[0].get('conclusion') != 'success':
            return False
    return True


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class GitHub:
    def __init__(self, repo, token):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo) or not token:
            raise ValueError('missing GitHub identity')
        self.root = 'https://api.github.com/repos/' + repo
        self.headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'blariyo-ci'}

    def request(self, path):
        if not path.startswith('/') or path.startswith('//'):
            raise ValueError('invalid API path')
        return urllib.request.Request(self.root + path, headers=self.headers)

    def get(self, path):
        with urllib.request.urlopen(self.request(path), timeout=20) as response:
            data = response.read(8 * LIMIT + 1)
            if len(data) > 8 * LIMIT:
                raise ValueError('API response too large')
            return json.loads(data)

    def pages(self, path, key=None):
        values = []
        for page in range(1, 4):
            data = self.get(path + ('&' if '?' in path else '?') + f'per_page=100&page={page}')
            batch = data[key] if key else data
            values.extend(batch)
            if len(batch) < 100:
                return values
        raise ValueError('API pagination exceeds bounded lookup')

    def artifact(self, artifact):
        # Never forward the GitHub token to the signed download URL.
        try:
            with urllib.request.build_opener(NoRedirect).open(
                    self.request(f"/actions/artifacts/{int(artifact['id'])}/zip"), timeout=20):
                raise ValueError('expected artifact redirect')
        except urllib.error.HTTPError as error:
            if error.code != 302:
                error.close()
                raise
            location = error.headers['Location']
            error.close()
        target = urllib.parse.urlsplit(location)
        if target.scheme != 'https' or not target.hostname or target.username or target.password:
            raise ValueError('invalid artifact redirect')
        with urllib.request.urlopen(urllib.request.Request(location), timeout=20) as response:
            archive = response.read(LIMIT + 1)
        if len(archive) > LIMIT or artifact.get('digest') != 'sha256:' + hashlib.sha256(archive).hexdigest():
            raise ValueError('artifact size or digest mismatch')
        return read_receipt(archive)


def read_receipt(archive):
    # Read one JSON member in memory; never extract or execute downloaded files.
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        if bundle.namelist() != ['ci-verification.json']:
            raise ValueError('unexpected receipt archive')
        info = bundle.getinfo('ci-verification.json')
        if info.file_size > 32768:
            raise ValueError('receipt too large')
        receipt = json.loads(bundle.read(info))
        if not isinstance(receipt, dict):
            raise ValueError('receipt must be an object')
        return receipt


def reused_plan(api, current, repo):
    if api is None:
        raise ValueError('GitHub API unavailable')
    if len(current['parents']) != 2:
        return full_plan('main is not a two-parent merge')
    prs = api.pages(f"/commits/{current['sha']}/pulls")
    for pr in prs:
        if not eligible_pr(pr, current, repo):
            continue
        workflow = api.get('/actions/workflows/ci.yml')
        runs = api.pages('/actions/workflows/ci.yml/runs?event=pull_request&status=success&head_sha='
                         + pr['head']['sha'], 'workflow_runs')
        for run in runs:
            if not (run.get('event') == 'pull_request' and run.get('status') == 'completed'
                    and run.get('conclusion') == 'success' and run.get('workflow_id') == workflow['id']
                    and run.get('path') == WORKFLOW and run.get('head_sha') == pr['head']['sha']
                    and run.get('head_repository', {}).get('full_name') == repo):
                continue
            artifacts = api.pages(f"/actions/runs/{run['id']}/artifacts", 'artifacts')
            name = f"ci-verification-{run['id']}-{run['run_attempt']}"
            candidates = [a for a in artifacts if a.get('name') == name and not a.get('expired')
                          and 0 < a.get('size_in_bytes', 0) <= LIMIT]
            if len(candidates) != 1:
                continue
            receipt = api.artifact(candidates[0])
            jobs = api.pages(f"/actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs", 'jobs')
            if matches(receipt, run, pr, current, repo, jobs):
                return {'full': False, 'reason': 'identical merge tree and successful full PR verification',
                        'reused_run': str(run['id'])}
    return full_plan('no matching successful full PR verification')


def plan(event_name, ref, event, current, repo, api=None, paths=()):
    if event_name == 'pull_request':
        if event['pull_request']['base']['ref'] != 'main' and docs_only(paths):
            return {'full': False, 'reason': 'non-production PR changes only ordinary Markdown', 'reused_run': ''}
        return full_plan('PR full verification')
    if event_name == 'push' and ref == 'refs/heads/main':
        try:
            return reused_plan(api, current, repo)
        except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile):
            # Availability problems must cost time, never remove verification.
            return full_plan('PR evidence unavailable; full verification required')
    return full_plan('manual or other event requires full verification')


def make_receipt(event, current, env, needs):
    pr = event['pull_request']
    if current['sha'] != env['GITHUB_SHA']:
        raise ValueError('receipt checkout differs from event SHA')
    results = {name: needs[name]['result'] for name in JOBS}
    if any(value != 'success' for value in results.values()):
        raise ValueError('full verification incomplete')
    if current['parents'] != [pr['base']['sha'], pr['head']['sha']]:
        raise ValueError('checkout is not the PR synthetic merge')
    return {'schema': 1, 'scope': 'full', 'repository': env['GITHUB_REPOSITORY'], 'workflow': WORKFLOW,
            'run_id': int(env['GITHUB_RUN_ID']), 'attempt': int(env['GITHUB_RUN_ATTEMPT']),
            'pr': pr['number'], 'head': pr['head']['sha'], 'base': pr['base']['sha'],
            **current, 'results': results}


def main():
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    mode = sys.argv[1]
    if mode == 'plan':
        current = snapshot()
        if current['sha'] != os.environ['GITHUB_SHA']:
            raise ValueError('checkout differs from event SHA')
        paths = []
        if os.environ['GITHUB_EVENT_NAME'] == 'pull_request':
            pr = event['pull_request']
            paths = subprocess.check_output(['git', 'diff', '--name-only', '--no-renames', '-z',
                                             pr['base']['sha'], pr['head']['sha']]).decode().split('\0')
            paths = [p for p in paths if p]
        api = None
        if os.environ['GITHUB_EVENT_NAME'] == 'push':
            api = GitHub(os.environ['GITHUB_REPOSITORY'], os.environ['GH_TOKEN'])
        result = plan(os.environ['GITHUB_EVENT_NAME'], os.environ['GITHUB_REF'], event,
                      current, os.environ['GITHUB_REPOSITORY'], api, paths)
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('full=' + str(result['full']).lower() + '\nreused_run=' + result['reused_run'] + '\n')
        print(json.dumps(result))
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write('CI decision: ' + result['reason'] + '\n')
            if result['reused_run']:
                summary.write(f"Verified PR run: https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{result['reused_run']}\n")
    elif mode == 'receipt':
        receipt = make_receipt(event, snapshot(), os.environ, json.loads(os.environ['CI_NEEDS']))
        Path(sys.argv[2]).write_text(json.dumps(receipt, indent=2) + '\n')
    elif mode == 'gate':
        needs = json.loads(os.environ['CI_NEEDS'])
        selection = needs['plan']['outputs'].get('full')
        if selection not in ('true', 'false'):
            raise ValueError('invalid CI plan')
        full = selection == 'true'
        if needs['plan']['result'] != 'success' or needs['quality']['result'] != 'success':
            raise ValueError('CI planning or quality checks failed')
        required = 'success' if full else 'skipped'
        if any(needs[name]['result'] != required for name in JOBS if name != 'quality'):
            raise ValueError('required verification missing or failed')
        print('CI verification gate passed')
    else:
        raise ValueError('unknown mode')


if __name__ == '__main__':
    main()
