import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('operations', Path(__file__).parent.parent / 'scripts' / 'operations-status.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StatusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = 'poetio-20260927T030000Z.tar.gz.gpg'
        self.value = dict(ok=True, created_utc='20260927T030000Z', archive=self.archive, bytes=4, restore_http_checks=['/', '/autor', '/video', '/carti'], secret='MUST_NOT_LEAK')
        (self.root / self.archive).write_bytes(b'test')
        self.save()

    def save(self):
        (self.root / 'last-success.json').write_text(json.dumps(self.value))

    def test_verified_status_is_allowlisted(self):
        def show(unit, properties):
            return {'ActiveState': 'active'} if unit.endswith('timer') else {'ActiveState': 'inactive', 'Result': 'success', 'ExecMainStartTimestamp': 'today'}
        value = module.collect(self.root, show)
        self.assertTrue(value['backup']['verified'])
        self.assertTrue(value['scheduled'])
        self.assertEqual(value['lastAttempt'], 'success')
        self.assertNotIn('MUST_NOT_LEAK', json.dumps(value))
        self.assertEqual(set(value['backup']), {'verified', 'createdAt', 'archive', 'bytes'})

    def test_failed_attempt_preserves_last_verified_backup(self):
        value = module.collect(self.root, lambda *args: {'ActiveState': 'failed', 'Result': 'exit-code'})
        self.assertEqual(value['lastAttempt'], 'failed')
        self.assertIsNotNone(value['backup'])
        self.assertFalse(value['scheduled'])

    def test_unavailable_evidence_is_unknown(self):
        for change in [{'archive': '../../etc/passwd'}, {'restore_http_checks': []}, {'bytes': 20}, {'ok': False}, {'created_utc': 'bad'}]:
            previous = self.value.copy()
            self.value.update(change); self.save()
            value = module.collect(self.root, lambda *args: {})
            self.assertIsNone(value['backup'])
            self.assertEqual(value['lastAttempt'], 'unknown')
            self.value = previous
        (self.root / 'last-success.json').write_text('{')
        def fail(*args):
            raise subprocess.TimeoutExpired('systemctl', 5)
        value = module.collect(self.root, fail)
        self.assertIsNone(value['backup'])
        self.assertIsNone(value['scheduled'])


if __name__ == '__main__':
    unittest.main()
