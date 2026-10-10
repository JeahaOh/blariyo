import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('job', ROOT / 'run-job.py')
job = importlib.util.module_from_spec(spec)
spec.loader.exec_module(job)


class AutoPublishJobTests(unittest.TestCase):
    def invoke(self, name, result=None, busy=False, timeout=False):
        output = io.StringIO()
        with patch.object(job.os, 'open', return_value=11) as opened, \
                patch.object(job.os, 'close') as closed, \
                patch.object(job.fcntl, 'flock', side_effect=BlockingIOError if busy else None), \
                patch.object(job.subprocess, 'run', side_effect=subprocess.TimeoutExpired('fixture', 180) if timeout else None,
                             return_value=result or subprocess.CompletedProcess([], 0, b'', b'')) as executed, \
                contextlib.redirect_stdout(output):
            code = job.run(name)
        return code, output.getvalue(), opened, closed, executed

    def test_dedicated_command_and_lock(self):
        result = subprocess.CompletedProcess([], 0, b'{"event":"SOURCE_AUTO_PUBLISH","counts":{"PUBLISHED":2,"UNCERTAIN_TOPIC":1}}\nsecret=fixture\n', b'')
        code, output, opened, closed, executed = self.invoke('auto-publish', result)
        self.assertEqual(code, 0)
        self.assertEqual(opened.call_args.args[0], '/run/blariyo-auto-publish.lock')
        self.assertEqual(executed.call_args.args[0][-1], 'collection:auto-publish')
        self.assertEqual(json.loads(output.splitlines()[0])['counts']['PUBLISHED'], 2)
        self.assertNotIn('secret', output)
        closed.assert_called_once_with(11)

    def test_scheduled_publication_remains_independent(self):
        code, _, opened, _, executed = self.invoke('publish')
        self.assertEqual(code, 0)
        self.assertEqual(opened.call_args.args[0], '/run/blariyo-job.lock')
        self.assertEqual(executed.call_args.args[0][-1], 'posts:publish-due')

    def test_busy_failure_timeout_and_unknown_job(self):
        code, output, _, closed, executed = self.invoke('auto-publish', busy=True)
        self.assertEqual(code, 0)
        self.assertIn('JOB_SKIPPED_BUSY', output)
        executed.assert_not_called()
        closed.assert_called_once()
        self.assertEqual(self.invoke('auto-publish', timeout=True)[0], 1)
        self.assertEqual(self.invoke('auto-publish', subprocess.CompletedProcess([], 1, b'', b'private diagnostic'))[0], 1)
        _, output, opened, _, executed = self.invoke('unknown')
        self.assertEqual(output, 'JOB_UNKNOWN\n')
        opened.assert_not_called()
        executed.assert_not_called()

    def test_timer_is_separate_and_does_not_replay_missed_jobs(self):
        timer = (ROOT / 'blariyo-auto-publish.timer').read_text()
        service = (ROOT / 'blariyo-auto-publish.service').read_text()
        self.assertIn('OnCalendar=*-*-* *:*:20', timer)
        self.assertIn('Persistent=false', timer)
        self.assertIn('Unit=blariyo-auto-publish.service', timer)
        self.assertIn('run-job.py auto-publish', service)
        self.assertNotIn('auto-publish', (ROOT / 'install-jobs-server.py').read_text())


if __name__ == '__main__':
    unittest.main()
