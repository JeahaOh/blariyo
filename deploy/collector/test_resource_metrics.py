import json
import hashlib
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import resource_metrics as m


def stats(name, cpu='12.5%', memory='1.5MiB / 512MiB'):
    return json.dumps({'Name': name, 'CPUPerc': cpu, 'MemUsage': memory, 'Secret': 'never-persist'})


class ResourceMetricsTest(unittest.TestCase):
    def test_partial_output_keeps_web_api_and_marks_missing_batch(self):
        output = '\n'.join(stats(m.CONTAINERS[k]) for k in ['web', 'api'])
        with patch.object(m.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout=output)):
            record = m.read_sample('fixture', 'goodgag')
        self.assertEqual(record['containers']['web']['memoryBytes'], 1572864)
        self.assertEqual(record['containers']['api']['cpuPercent'], 12.5)
        self.assertEqual(record['containers']['batch']['state'], 'UNAVAILABLE')
        self.assertNotIn('cpuPercent', record['containers']['batch'])
        self.assertNotIn('never-persist', json.dumps(record))

    def test_timeout_and_invalid_numbers_never_become_zero_measurements(self):
        with patch.object(m.subprocess, 'run', side_effect=subprocess.TimeoutExpired('docker', 8)):
            record = m.read_sample('fixture', None)
        self.assertEqual(record['error'], 'STATS_UNAVAILABLE')
        self.assertTrue(all(v['state'] == 'UNAVAILABLE' for v in record['containers'].values()))
        with patch.object(m.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=stats(m.CONTAINERS['api'], 'NaN%'))):
            self.assertEqual(m.read_sample('fixture', None)['containers']['api']['state'], 'UNAVAILABLE')

    def test_si_and_binary_memory_units(self):
        self.assertEqual(m.byte_count('1.5GB'), 1500000000)
        self.assertEqual(m.byte_count('1 GiB'), 1073741824)
        with self.assertRaises(ValueError):
            m.byte_count('unavailable')

    def test_fixed_minute_cadence_stop_and_source_change(self):
        with tempfile.TemporaryDirectory() as folder:
            sampler = m.ResourceSampler(Path(folder), '20261007T120000Z-12345678')
            sampler.directory.mkdir()
            clock = [0.0]
            starts = []
            class Stop:
                def is_set(self): return False
                def wait(self, seconds):
                    clock[0] += seconds
                    sampler.source = 'second'
                    return len(starts) == 3
            sampler.stop_event = Stop()
            def sample(execution, source):
                starts.append(clock[0])
                clock[0] += 2  # docker stats sampling wait must not add cadence drift
                return {'containers': {}, 'source': source}
            sampler.source = 'first'
            with patch.object(m.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(m, 'read_sample', side_effect=sample):
                sampler._run()
            self.assertEqual(starts, [0, 60, 120])
            rows = [json.loads(s) for s in sampler.path.read_text().splitlines()]
            self.assertEqual([r['source'] for r in rows], ['first', 'second', 'second'])

    def test_retention_is_scoped_and_files_are_private(self):
        with tempfile.TemporaryDirectory() as folder:
            sampler = m.ResourceSampler(Path(folder), '20261007T120000Z-12345678')
            sampler.directory.mkdir()
            expired = sampler.directory / 'metrics-20260901T120000Z-12345678.jsonl'
            unrelated = sampler.directory / 'operator-notes.jsonl'
            outside = Path(folder) / 'outside'
            for p in [expired, unrelated, outside]:
                p.write_text('keep unless owned and expired')
                os.utime(p, (0, 0))
            expired.with_suffix('.uploaded.json').write_text(json.dumps({'state':'VERIFIED','localSha256':hashlib.sha256(expired.read_bytes()).hexdigest()}))
            pending = sampler.directory / 'metrics-20260903T120000Z-12345678.jsonl'
            pending.write_text('pending');os.utime(pending, (0, 0))
            link = sampler.directory / 'metrics-20260902T120000Z-12345678.jsonl'
            link.symlink_to(outside)
            with patch.object(m.threading, 'Thread'):
                sampler.start()
            self.assertFalse(expired.exists())
            self.assertTrue(unrelated.exists())
            self.assertTrue(link.is_symlink())
            self.assertTrue(outside.exists())
            self.assertTrue(pending.exists())
            self.assertEqual(sampler.path.stat().st_mode & 0o777, 0o600)

    def test_write_failure_does_not_raise_into_collection(self):
        with tempfile.TemporaryDirectory() as folder:
            sampler = m.ResourceSampler(Path(folder), '20261007T120000Z-12345678')
            sampler.directory.write_text('not a directory')
            sampler.start()
            self.assertEqual(sampler.stop()['state'], 'ERROR')
            self.assertEqual(sampler.write_errors, 1)

    def test_thread_stops_without_waiting_one_minute_and_start_is_idempotent(self):
        import threading
        with tempfile.TemporaryDirectory() as folder:
            sampler = m.ResourceSampler(Path(folder), '20261007T120000Z-12345678')
            sampled = threading.Event()
            def sample(*args):
                sampled.set()
                return {'containers': {}}
            with patch.object(m, 'read_sample', side_effect=sample):
                sampler.start()
                sampler.start()
                self.assertTrue(sampled.wait(1))
                summary = sampler.stop()
            self.assertFalse(sampler.thread.is_alive())
            self.assertEqual(summary['samples'], 1)


if __name__ == '__main__':
    unittest.main()
