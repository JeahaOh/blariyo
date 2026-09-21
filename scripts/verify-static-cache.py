#!/usr/bin/env python3
"""Bounded public GET/HEAD audit; no login, purge, writes, or load generation."""
import argparse
import hashlib
import json
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', required=True, type=Path,
                        help='JSON with files [{path, sha256}] from the running image')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--expect-query-hit', action='store_true',
                        help='Require the second unique query to HIT after rule deployment')
    args = parser.parse_args()
    inventory = json.loads(args.inventory.read_text())
    assets = [f for f in inventory['files'] if f['path'].endswith(('.js', '.css'))]
    if not 1 <= len(assets) <= 100:
        parser.error('Expected 1..100 JS/CSS assets; review scope before increasing limit')
    for item in assets:
        if not re.fullmatch(r'/_nuxt/[A-Za-z0-9_.-]+\.(?:js|css)', item['path']):
            parser.error('Only flat, generated Nuxt JS/CSS paths are supported')
        if not re.fullmatch(r'[0-9a-f]{64}', item['sha256']):
            parser.error('Inventory must contain SHA-256 for every asset')
    opener = build_opener(NoRedirect)
    run = uuid.uuid4().hex
    rows, failures = [], []
    previous = 0.0

    def fetch(path, label, method='GET', extra=None):
        nonlocal previous
        time.sleep(max(0, 1 - (time.monotonic() - previous)))
        previous = time.monotonic()
        headers = {'User-Agent': 'Blariyo-Static-Audit/1.0', 'Accept-Encoding': 'identity', 'Accept': '*/*'}
        headers.update(extra or {})
        request = Request('https://blariyo.com' + path, headers=headers, method=method)
        row = {'path': path, 'case': label, 'method': method}
        try:
            try:
                response = opener.open(request, timeout=20)
            except HTTPError as error:
                response = error
            with response:
                body = response.read(8 * 1024 * 1024 + 1)
                if len(body) > 8 * 1024 * 1024:
                    raise ValueError('response exceeds audit size limit')
                row.update(status=response.status, bytes=len(body),
                           sha256=hashlib.sha256(body).hexdigest(),
                           headers={k: response.headers.get(k) for k in
                                    ('content-type', 'cache-control', 'cf-cache-status', 'age')},
                           has_set_cookie=bool(response.headers.get_all('set-cookie')))
        except (URLError, TimeoutError, OSError, ValueError) as error:
            row['error_type'] = type(error).__name__
            failures.append(f'{label}: transport or size failure')
        rows.append(row)
        return row

    def check(condition, message):
        if not condition:
            failures.append(message)

    for item in assets:
        path = item['path']
        variants = [
            ('base', path, 'GET', None),
            ('query-a', f'{path}?cache_audit={run}a', 'GET', None),
            ('query-b', f'{path}?cache_audit={run}b', 'GET', None),
            ('synthetic-cookie', path, 'GET', {'Cookie': 'cache_audit=synthetic'}),
            ('synthetic-authorization', path, 'GET', {'Authorization': 'Bearer cache-audit-invalid'}),
            ('head', path, 'HEAD', None),
        ]
        for label, target, method, extra in variants:
            row = fetch(target, label, method, extra)
            h = row.get('headers', {})
            check(row.get('status') == 200, f'{path}/{label}: expected 200')
            check(not row.get('has_set_cookie'), f'{path}/{label}: unexpected Set-Cookie')
            cc = (h.get('cache-control') or '').lower()
            check('public' in cc and 'immutable' in cc and 'max-age=31536000' in cc
                  and not any(x in cc for x in ('private', 'no-store', 'no-cache')),
                  f'{path}/{label}: unexpected Cache-Control')
            mime = (h.get('content-type') or '').split(';')[0].strip()
            expected = ('text/css',) if path.endswith('.css') else ('text/javascript', 'application/javascript')
            check(mime in expected, f'{path}/{label}: unexpected content type')
            if method == 'GET':
                check(row.get('sha256') == item['sha256'], f'{path}/{label}: image/body hash mismatch')
            if label == 'query-b' and args.expect_query_hit:
                check(h.get('cf-cache-status') == 'HIT', f'{path}: query reuse not confirmed')
        print(f'checked {path}', flush=True)

    controls = [('/meme', {200}), ('/meme?page=1', {200}),
                # Page 2 may be out of range while the board is empty.
                ('/meme?page=2', {200, 404}),
                ('/api/v1/boards/meme/posts', {200}),
                ('/api/v1/boards/meme/posts?page=1', {200}), ('/health/live', {200}),
                (f'/_nuxt/missing-{run}.js', {404}),
                (f'/_nuxt/missing-{run}.css', {404}),
                (f'/_nuxt/nested-{run}/missing.js', {404}),
                (f'/meme/missing-{run}.js', {404})]
    for path, statuses in controls:
        for accept in ('text/html', 'application/json'):
            row = fetch(path, 'uncacheable-control-' + accept, extra={'Accept': accept})
            h = row.get('headers', {})
            check(row.get('status') in statuses, f'{path}: expected one of {sorted(statuses)}')
            check('no-store' in (h.get('cache-control') or '').lower(), f'{path}: missing no-store')
            check(h.get('cf-cache-status') in ('DYNAMIC', 'BYPASS'), f'{path}: unexpected caching')

    result = {'recorded_at': datetime.now(timezone.utc).isoformat(),
              'scope': 'Sequential <=1 request/second; synthetic non-credential headers only on public assets',
              'expect_query_hit': args.expect_query_hit, 'asset_count': len(assets),
              'request_count': len(rows), 'failures': failures, 'requests': rows}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'assets': len(assets), 'requests': len(rows), 'failures': failures}, ensure_ascii=False))
    raise SystemExit(bool(failures))


if __name__ == '__main__':
    main()
