"""Bounded container metrics while a collection execution owns the run lock."""
import json
import math
import os
import re
import subprocess
import threading
import time
from datetime import datetime, timezone
from metrics_archive import uploaded

SAMPLE_INTERVAL_SECONDS = 60
STATS_TIMEOUT_SECONDS = 8
METRICS_RETENTION_DAYS = 7
CONTAINERS = {
    'web': 'blariyo-app-web-1',
    'api': 'blariyo-app-api-1',
    'batch': 'blariyo-collector-scheduled',
}


def byte_count(value):
    match = re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)\s*(B|KiB|MiB|GiB|TiB|kB|MB|GB|TB)', value.strip())
    if not match:
        raise ValueError('INVALID_MEMORY')
    units = {'B': 1, **{u: 1024 ** n for n, u in enumerate(['KiB', 'MiB', 'GiB', 'TiB'], 1)},
             **{u: 1000 ** n for n, u in enumerate(['kB', 'MB', 'GB', 'TB'], 1)}}
    return round(float(match[1]) * units[match[2]])


def read_sample(execution_id, source):
    record = {'timestamp': datetime.now(timezone.utc).isoformat(), 'executionId': execution_id,
              'source': source, 'containers': {}}
    rows = {}
    try:
        result = subprocess.run(['docker', 'stats', '--no-stream', '--format', '{{json .}}',
                                 *CONTAINERS.values()], capture_output=True, text=True,
                                timeout=STATS_TIMEOUT_SECONDS)
        if result.returncode:
            record['error'] = 'STATS_PARTIAL_OR_FAILED'
        for line in result.stdout.splitlines():
            try:
                row = json.loads(line)
                if row.get('Name') in CONTAINERS.values():
                    rows[row['Name']] = row
            except (ValueError, AttributeError):
                record['error'] = 'INVALID_STATS_OUTPUT'
    except (OSError, subprocess.TimeoutExpired):
        record['error'] = 'STATS_UNAVAILABLE'
    for role, name in CONTAINERS.items():
        metric = {'container': name, 'state': 'UNAVAILABLE'}
        try:
            row = rows[name]
            cpu = float(row['CPUPerc'].removesuffix('%'))
            used, limit = (byte_count(v) for v in row['MemUsage'].split('/'))
            if not math.isfinite(cpu) or cpu < 0 or limit <= 0:
                raise ValueError('INVALID_STATS')
            metric.update(state='OK', cpuPercent=cpu, memoryBytes=used, memoryLimitBytes=limit)
        except (KeyError, ValueError, TypeError, AttributeError):
            pass
        record['containers'][role] = metric
    return record


class ResourceSampler:
    def __init__(self, root, execution_id):
        self.directory = root / 'metrics'
        self.path = self.directory / ('metrics-' + execution_id + '.jsonl')
        self.execution_id = execution_id
        self.source = None
        self.samples = 0
        self.sample_errors = 0
        self.write_errors = 0
        self.started = False
        self.stop_event = threading.Event()
        self.thread = None

    def start(self):
        if self.started:
            return
        self.started = True
        try:
            self.directory.mkdir(mode=0o700, exist_ok=True)
            for path in self.directory.glob('metrics-*.jsonl'):
                if (re.fullmatch(r'metrics-\d{8}T\d{6}Z-[a-f0-9]{8}\.jsonl', path.name)
                        and not path.is_symlink() and path.is_file()
                        and time.time() - path.stat().st_mtime > METRICS_RETENTION_DAYS * 86400
                        and uploaded(path)):
                    path.unlink()
                    path.with_suffix('.uploaded.json').unlink(missing_ok=True)
            # Exclusive creation: no overwritten history or followed file symlink.
            fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            os.close(fd)
            self.thread = threading.Thread(target=self._run, name='collection-metrics', daemon=True)
            self.thread.start()
        except OSError:
            self.write_errors += 1

    def _run(self):
        next_sample = time.monotonic()
        while not self.stop_event.is_set():
            record = read_sample(self.execution_id, self.source)
            if record.get('error') or any(v['state'] != 'OK' for v in record['containers'].values()):
                self.sample_errors += 1
            try:
                with self.path.open('a') as stream:
                    stream.write(json.dumps(record, allow_nan=False, separators=(',', ':')) + '\n')
                self.samples += 1
            except OSError:
                self.write_errors += 1
            next_sample += SAMPLE_INTERVAL_SECONDS
            # Skip missed ticks; never generate a catch-up burst.
            while next_sample <= time.monotonic():
                next_sample += SAMPLE_INTERVAL_SECONDS
            if self.stop_event.wait(max(0, next_sample - time.monotonic())):
                break

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(STATS_TIMEOUT_SECONDS + 2)
        return {'file': str(self.path) if self.started else None,
                'intervalSeconds': SAMPLE_INTERVAL_SECONDS, 'samples': self.samples,
                'sampleErrors': self.sample_errors, 'writeErrors': self.write_errors,
                'state': ('NOT_STARTED' if not self.started else
                          'ERROR' if self.write_errors or (self.thread and self.thread.is_alive()) else
                          'PARTIAL' if self.sample_errors else 'RECORDED')}
