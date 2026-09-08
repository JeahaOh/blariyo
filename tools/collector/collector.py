#!/usr/bin/env python3
"""Operator-local, fail-closed collection worker; standard library only."""
import argparse
import fcntl
from contextlib import closing
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import ssl
import tempfile
import time
from html.parser import HTMLParser
from urllib.parse import urlsplit, urlunsplit, urljoin
from urllib.robotparser import RobotFileParser
import uuid


class CollectError(Exception):
    pass


def checked_url(url, hosts):
    p = urlsplit(url)
    if len(url) > 2048 or p.scheme != 'https' or p.username or p.password or p.port not in (None, 443) or p.hostname not in hosts:
        raise CollectError('SOURCE_NOT_ALLOWED')
    return urlunsplit((p.scheme, p.netloc, p.path or '/', p.query, ''))


def public_addresses(host):
    addresses = sorted({a[4][0] for a in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)})
    if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
        raise CollectError('SSRF_BLOCKED')
    return addresses


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, address):
        super().__init__(host, timeout=15, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        raw = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


class Quota:
    """Shared across local processes and restarts; every external request counts."""
    def __init__(self, path):
        self.path = path
        with closing(sqlite3.connect(path)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS quota(host TEXT PRIMARY KEY, day TEXT, count INTEGER, last REAL)')
        os.chmod(path, 0o600)

    def reserve(self, host, interval, limit):
        while True:
            with closing(sqlite3.connect(self.path, timeout=30)) as db, db:
                db.execute('BEGIN IMMEDIATE')
                now = time.time()
                day = time.strftime('%Y-%m-%d', time.gmtime(now))
                row = db.execute('SELECT day,count,last FROM quota WHERE host=?', (host,)).fetchone()
                count = row[1] if row and row[0] == day else 0
                if count >= limit:
                    raise CollectError('SOURCE_RATE_LIMITED')
                delay = max(0, (row[2] if row else 0) + interval / 1000 - now)
                if not delay:
                    db.execute('INSERT OR REPLACE INTO quota VALUES(?,?,?,?)', (host, day, count + 1, now))
                    return
            time.sleep(min(delay, 10))


class Fetcher:
    def __init__(self, config, quota, heartbeat):
        self.config, self.quota, self.heartbeat = config, quota, heartbeat
        self.robots_interval_ms = 0

    def get(self, url, hosts, maximum, mime_prefix, authorize=None):
        for redirect in range(4):
            url = checked_url(url, hosts)
            if authorize and not authorize(url):
                raise CollectError('ROBOTS_DISALLOWED')
            source = self.heartbeat()
            if not source['isActive'] or source['robotsAllowed'] is not True or not source['robotsCheckedAt']:
                raise CollectError('SOURCE_NOT_ALLOWED')
            self.quota.reserve(source['host'], max(source['requestIntervalMs'], self.robots_interval_ms), source['dailyFetchLimit'])
            # Refresh after rate-limit waiting and immediately before external I/O.
            source = self.heartbeat()
            if not source['isActive'] or source['robotsAllowed'] is not True:
                raise CollectError('SOURCE_NOT_ALLOWED')
            p = urlsplit(url)
            connection = PinnedHTTPS(p.hostname, public_addresses(p.hostname)[0])
            try:
                connection.request('GET', urlunsplit(('', '', p.path or '/', p.query, '')), headers={'User-Agent': self.config['userAgent'], 'Accept-Encoding': 'identity', 'Accept': mime_prefix + '*'})
                response = connection.getresponse()
                if response.status in (301, 302, 303, 307, 308):
                    if redirect == 3 or not response.getheader('Location'):
                        raise CollectError('REDIRECT_LIMIT')
                    url = urljoin(url, response.getheader('Location'))
                    continue
                if response.status != 200:
                    raise CollectError('HTTP_' + str(response.status))
                mime = response.getheader('Content-Type', '').split(';')[0].strip().lower()
                if not mime.startswith(mime_prefix) or response.getheader('Content-Encoding', 'identity') != 'identity':
                    raise CollectError('CONTENT_TYPE_INVALID')
                if int(response.getheader('Content-Length', '0')) > maximum:
                    raise CollectError('RESPONSE_TOO_LARGE')
                started, data = time.monotonic(), bytearray()
                while True:
                    chunk = response.read1(min(65536, maximum + 1 - len(data)))
                    data.extend(chunk)
                    if len(data) > maximum:
                        raise CollectError('RESPONSE_TOO_LARGE')
                    if time.monotonic() - started > 30:
                        raise CollectError('FETCH_TIMEOUT')
                    if not chunk:
                        return bytes(data), mime, url
            finally:
                connection.close()
        raise CollectError('REDIRECT_LIMIT')


def robots_interval(robot, user_agent):
    delay = robot.crawl_delay(user_agent) or 0
    rate = robot.request_rate(user_agent)
    return max(delay * 1000, rate.seconds * 1000 / rate.requests if rate and rate.requests else 0)


class DetailParser(HTMLParser):
    """Explicit simple selectors (.class, #id, tag); never guess the article body."""
    def __init__(self, config, url):
        super().__init__(convert_charrefs=True)
        self.config, self.url = config, url
        self.stack, self.title, self.images, self.canonical = [], [], [], url

    @staticmethod
    def matches(tag, attrs, selector):
        if selector.startswith('#'):
            return attrs.get('id') == selector[1:]
        if selector.startswith('.'):
            return selector[1:] in attrs.get('class', '').split()
        return tag == selector

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        parent = self.stack[-1] if self.stack else (None, False, False, False)
        body = parent[1] or self.matches(tag, attrs, self.config['bodySelector'])
        title = parent[2] or self.matches(tag, attrs, self.config['titleSelector'])
        ignored = parent[3] or tag in ('script', 'style', 'noscript')
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.canonical = urljoin(self.url, attrs.get('href', ''))
        if tag == 'img' and body and not ignored:
            src = attrs.get('data-src') or attrs.get('src')
            if src:
                value = urljoin(self.url, src)
                if value not in self.images:
                    self.images.append(value)
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.stack.append((tag, body, title, ignored))

    def handle_endtag(self, tag):
        for n in range(len(self.stack) - 1, -1, -1):
            if self.stack[n][0] == tag:
                del self.stack[n:]
                break

    def handle_data(self, data):
        if self.stack and self.stack[-1][2] and not self.stack[-1][3]:
            self.title.append(data)

    def extract(self, html):
        self.feed(html)
        title = ' '.join(''.join(self.title).split())
        if not title or len(title) > 300 or not self.images or len(self.images) > 20:
            raise CollectError('PARSER_FAILED')
        checked_url(self.canonical, [urlsplit(self.url).hostname])
        if not re.fullmatch(self.config['detailPathPattern'], urlsplit(self.canonical).path):
            raise CollectError('PARSER_FAILED')
        for image in self.images:
            checked_url(image, self.config['imageHosts'])
        return title, self.canonical, self.images


class API:
    def __init__(self):
        self.base = os.environ['COLLECTOR_API_URL'].rstrip('/')
        self.collector = os.environ['COLLECTOR_ID']
        self.token = os.environ['COLLECTOR_TOKEN']
        p = urlsplit(self.base)
        if p.scheme != 'https' or p.username or p.password or p.query or p.fragment:
            raise CollectError('CONFIG_INVALID')
        if len(self.token) < 32 or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', self.collector):
            raise CollectError('CONFIG_INVALID')

    def call(self, path, body=None, file=None, key=None):
        key = key or str(uuid.uuid4())
        if file:
            boundary = 'blariyo' + uuid.uuid4().hex
            data = bytearray()
            for name, value in body.items():
                data.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
            data.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="preview"\r\nContent-Type: {file[1]}\r\n\r\n'.encode())
            data.extend(file[0]); data.extend(f'\r\n--{boundary}--\r\n'.encode())
            mime = 'multipart/form-data; boundary=' + boundary
        else:
            data, mime = json.dumps(body).encode(), 'application/json'
        for attempt in range(2):
            p = urlsplit(self.base + path)
            conn = http.client.HTTPSConnection(p.hostname, p.port or 443, timeout=30)
            try:
                conn.request('POST', p.path, body=data, headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': mime, 'Idempotency-Key': key})
                response = conn.getresponse()
                result = json.loads(response.read(2 * 1024 * 1024))
                if response.status >= 400:
                    raise CollectError(result.get('error', {}).get('code', 'API_FAILED'))
                return result['data']
            except (OSError, http.client.HTTPException):
                # Preview and heartbeat change versions and intentionally have no replay contract.
                if attempt or file or path.endswith('/heartbeat') or path.endswith('/claim'):
                    raise CollectError('API_UNAVAILABLE')
            finally:
                conn.close()


def process_job(api, job, config, quota):
    version = job['lockVersion']
    submitted = False
    prefix = '/candidates/' + str(job['candidateId'])
    def heartbeat():
        nonlocal version
        response = api.call(prefix + '/heartbeat', {'collectorId': api.collector, 'lockVersion': version, 'leaseSeconds': 900})
        version = response['lockVersion']
        return response['source']
    try:
        rules = config['sources'].get(job['sourceHost'])
        if not rules or not rules.get('enabled') or not rules.get('parserVersion') or not rules.get('imageHosts'):
            raise CollectError('SOURCE_NOT_CONFIGURED')
        if not re.fullmatch(rules['detailPathPattern'], urlsplit(job['originUrl']).path):
            raise CollectError('SOURCE_NOT_ALLOWED')
        fetcher = Fetcher(config, quota, heartbeat)
        origin = 'https://' + job['sourceHost']
        robots, _, _ = fetcher.get(origin + '/robots.txt', [job['sourceHost']], 512 * 1024, 'text/plain')
        robot = RobotFileParser(); robot.parse(robots.decode('utf-8', 'strict').splitlines())
        fetcher.robots_interval_ms = robots_interval(robot, config['userAgent'])
        if not robot.can_fetch(config['userAgent'], job['originUrl']):
            raise CollectError('ROBOTS_DISALLOWED')
        html, _, final_url = fetcher.get(job['originUrl'], [job['sourceHost']], 2 * 1024 * 1024, 'text/html', lambda u: robot.can_fetch(config['userAgent'], u) and re.fullmatch(rules['detailPathPattern'], urlsplit(u).path))
        title, canonical, images = DetailParser(rules, final_url).extract(html.decode('utf-8', 'strict'))
        previews = []
        # Temporary files live only on the operator machine and are removed on all exits.
        with tempfile.TemporaryDirectory(prefix='blariyo-collector-') as directory:
            for index, remote in enumerate(images):
                image_host = urlsplit(remote).hostname
                image_robots, _, _ = fetcher.get('https://' + image_host + '/robots.txt', rules['imageHosts'], 512 * 1024, 'text/plain')
                image_robot = RobotFileParser(); image_robot.parse(image_robots.decode('utf-8', 'strict').splitlines())
                fetcher.robots_interval_ms = max(fetcher.robots_interval_ms, robots_interval(image_robot, config['userAgent']))
                if not image_robot.can_fetch(config['userAgent'], remote):
                    raise CollectError('ROBOTS_DISALLOWED')
                raw, mime, _ = fetcher.get(remote, rules['imageHosts'], 10 * 1024 * 1024, 'image/', lambda u: urlsplit(u).hostname == image_host and image_robot.can_fetch(config['userAgent'], u))
                if mime not in ('image/jpeg', 'image/png', 'image/gif', 'image/webp'):
                    raise CollectError('CONTENT_TYPE_INVALID')
                path = Path(directory) / str(index); path.write_bytes(raw); os.chmod(path, 0o600)
                previews.append((path, mime))
            result = api.call(prefix + '/result', {'collectorId': api.collector, 'lockVersion': version, 'status': 'NEW', 'canonicalUrl': canonical, 'title': title, 'parserVersion': rules['parserVersion'], 'sourcePublishedAt': None, 'warnings': [], 'imageCandidates': [{'position': n + 1, 'remoteUrl': u} for n, u in enumerate(images)]})
            version = result['lockVersion']
            submitted = True
            for item, preview in zip(result['imageCandidates'], previews):
                uploaded = api.call(prefix + '/images/' + str(item['candidateImageId']) + '/preview', {'collectorId': api.collector, 'lockVersion': version}, (preview[0].read_bytes(), preview[1]))
                version = uploaded['lockVersion']
        return {'candidateId': job['candidateId'], 'status': 'NEW'}
    except Exception as error:
        code = str(error) if isinstance(error, CollectError) and re.fullmatch(r'[A-Z0-9_]{1,50}', str(error)) else 'FETCH_FAILED'
        if submitted:
            return {'candidateId': job['candidateId'], 'status': 'PARTIAL_PREVIEW', 'errorCode': code}
        try:
            api.call(prefix + '/result', {'collectorId': api.collector, 'lockVersion': version, 'status': 'FETCH_FAILED', 'fetchErrorCode': code, 'warnings': []})
        except Exception:
            pass
        return {'candidateId': job['candidateId'], 'status': 'FAILED', 'errorCode': code}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    config = json.loads(Path(os.environ['COLLECTOR_CONFIG']).read_text())
    if not config.get('userAgent') or not config.get('sources'):
        raise CollectError('CONFIG_INVALID')
    api = API()
    state = os.environ['COLLECTOR_STATE_DB']
    quota = Quota(state)
    with open(state + '.lock', 'a') as lock_file:
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise CollectError('ALREADY_RUNNING')
        while True:
            jobs = api.call('/candidates/claim', {'collectorId': api.collector, 'maxItems': 1, 'leaseSeconds': 900})['items']
            for job in jobs:
                print(json.dumps(process_job(api, job, config, quota)), flush=True)
            if args.once:
                return
            time.sleep(5)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'status': 'FAILED', 'errorCode': 'WORKER_UNAVAILABLE'}), flush=True)
        raise SystemExit(1)
