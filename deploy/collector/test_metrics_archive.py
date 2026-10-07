import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import metrics_archive as m


class ArchiveTest(unittest.TestCase):
    def fixture(self, root):
        folder = root / 'metrics';folder.mkdir()
        path = folder / 'metrics-20261007T145900Z-12345678.jsonl'
        rows = [{'executionId':'20261007T145900Z-12345678','timestamp':t,'containers':{}}
                for t in ['2026-10-07T14:59:00+00:00','2026-10-07T15:00:00+00:00']]
        path.write_text(''.join(json.dumps(r)+'\n' for r in rows))
        return path

    def test_kst_midnight_partitions_actual_measurements(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.fixture(Path(folder))
            data, objects = m.objects_for(path)
            self.assertEqual([o['key'].split('/')[1:4] for o in objects], [['2026','10','07'],['2026','10','08']])
            self.assertEqual(b''.join(base64.b64decode(o['body']) for o in objects), data)

    def test_failure_keeps_local_file_and_retry_creates_verified_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder);path = self.fixture(root)
            with patch.object(m, 'transfer', side_effect=TimeoutError):
                self.assertEqual(m.archive_pending(root)['state'], 'PENDING')
            self.assertTrue(path.exists());self.assertFalse(m.uploaded(path))
            def transfer(root, objects, timeout):
                return {'state':'VERIFIED','objects':[{'key':o['key'],'sha256':o['sha256'],'bytes':len(base64.b64decode(o['body']))} for o in objects]}
            with patch.object(m, 'transfer', side_effect=transfer) as send:
                self.assertEqual(len(m.archive_pending(root)['uploaded']), 2)
                self.assertTrue(m.uploaded(path))
                self.assertEqual(m.archive_pending(root)['uploaded'], [])
                self.assertEqual(send.call_count, 1)

    def test_false_success_does_not_create_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder);path = self.fixture(root)
            with patch.object(m, 'transfer', return_value={'state':'VERIFIED','objects':[]}):
                self.assertEqual(m.archive_pending(root)['state'], 'PENDING')
            self.assertFalse(m.uploaded(path));self.assertTrue(path.exists())

    def test_partial_line_wrong_execution_and_symlinks_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);path=self.fixture(root)
            original=path.read_text()
            path.write_text(original.rstrip())
            with self.assertRaises(ValueError):m.objects_for(path)
            path.write_text(original.replace('12345678','aaaaaaaa'))
            with self.assertRaises(ValueError):m.objects_for(path)
            path.unlink();path.symlink_to(root/'secret')
            with self.assertRaises(ValueError):m.objects_for(path)


if __name__ == '__main__':unittest.main()
