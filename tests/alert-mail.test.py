import importlib.util
import os
from pathlib import Path
import smtplib
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
STATE = tempfile.mkdtemp(prefix='poetio-alert-test-')
os.environ['STATE_DIRECTORY'] = STATE
spec = importlib.util.spec_from_file_location('alert_mail', ROOT / 'scripts' / 'alert-mail.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

ENV = {'POETIO_SMTP_HOST': 'smtp.example.org', 'POETIO_SMTP_USER': 'sender@example.org',
       'POETIO_SMTP_PASSWORD': 'MUST_NOT_LEAK', 'POETIO_NOTIFY_TO': 'owner@example.org'}
UNIT = 'poetio-backup.service'
HOUR = 3600


class AlertTest(unittest.TestCase):
    def setUp(self):
        for path in Path(STATE).glob('*'):
            path.unlink()
        self.sent, self.outcome, self.journal_calls = [], 'exit-code', []

    def run_alert(self, now, env=ENV, outcome=None, unit=UNIT):
        def result(name):
            self.assertEqual(name, unit)
            return (outcome or self.outcome), 'abc123'

        def read_journal(name, invocation):
            self.journal_calls.append((name, invocation))
            return '2026-11-24T03:20:00+00:00 server poetio-backup[1]: disk full'

        return module.handle(unit, env, result=result, read_journal=read_journal,
                             send=lambda message, config: self.sent.append(message), now=now)

    def state(self, unit=UNIT):
        return module.load(Path(STATE) / f'{unit}.json')

    def test_success_without_an_open_alert_does_nothing(self):
        self.assertEqual(self.run_alert(1000, outcome='success'), 'ok')
        self.assertEqual(self.sent, [])
        self.assertEqual(list(Path(STATE).glob('*')), [])

    def test_failure_sends_once_then_waits_then_repeats_then_recovers(self):
        start = 1_000_000
        self.assertEqual(self.run_alert(start), 'alert')
        first = self.sent[-1]
        self.assertEqual(first['Subject'], 'Poetio: Copia de siguranță zilnică a eșuat')
        self.assertEqual(first['To'], 'owner@example.org')
        body = first.get_content()
        self.assertIn('disk full', body)
        self.assertIn('/var/backups/poetio/automatic', body)
        self.assertIn('journalctl -u poetio-backup.service', body)
        self.assertNotIn('MUST_NOT_LEAK', first.as_string())
        self.assertEqual(self.journal_calls, [(UNIT, 'abc123')])

        # A failure every few minutes does not flood the mailbox.
        self.assertEqual(self.run_alert(start + HOUR), 'repeat-later')
        self.assertEqual(self.run_alert(start + 5 * HOUR), 'repeat-later')
        self.assertEqual(len(self.sent), 1)
        self.assertEqual(self.state()['failures'], 3)

        self.assertEqual(self.run_alert(start + 6 * HOUR), 'alert')
        self.assertEqual(len(self.sent), 2)
        self.assertIn('(4 încercări)', self.sent[-1].get_content())

        self.assertEqual(self.run_alert(start + 7 * HOUR, outcome='success'), 'recovered')
        recovered = self.sent[-1]
        self.assertEqual(recovered['Subject'], 'Poetio: Copia de siguranță zilnică funcționează din nou')
        self.assertIn('4 încercări eșuate', recovered.get_content())
        self.assertEqual(self.state(), {})
        self.assertEqual(self.run_alert(start + 8 * HOUR, outcome='success'), 'ok')
        self.assertEqual(len(self.sent), 3)

    def test_a_new_problem_after_recovery_alerts_at_once(self):
        self.run_alert(0)
        self.run_alert(HOUR, outcome='success')
        self.assertEqual(self.run_alert(2 * HOUR), 'alert')
        self.assertEqual(len(self.sent), 3)
        self.assertEqual(self.state()['failures'], 1)

    def test_smtp_error_keeps_the_count_and_retries_on_the_next_failure(self):
        def refuse(message, config):
            raise smtplib.SMTPException('refused')

        with self.assertRaises(smtplib.SMTPException):
            module.handle(UNIT, ENV, result=lambda name: ('exit-code', ''), read_journal=lambda *a: 'x',
                          send=refuse, now=100)
        self.assertEqual(self.state()['failures'], 1)
        self.assertIsNone(self.state()['last_sent'])
        self.assertEqual(self.run_alert(200), 'alert')

    def test_without_email_settings_it_only_logs(self):
        for env in ({}, {'POETIO_SMTP_HOST': 'smtp.example.org'}):
            self.assertEqual(self.run_alert(100, env=env), 'not-configured')
        self.assertEqual(self.sent, [])
        self.assertTrue(self.state()['open'])
        self.assertEqual(self.run_alert(200, env={}, outcome='success'), 'not-configured')
        self.assertEqual(self.state(), {})

    def test_alert_recipient_and_repeat_interval_can_be_set(self):
        env = {**ENV, 'POETIO_ALERT_TO': 'alerts@example.org', 'POETIO_ALERT_REPEAT_HOURS': '1'}
        self.run_alert(0, env=env)
        self.assertEqual(self.sent[-1]['To'], 'alerts@example.org')
        self.assertEqual(self.run_alert(HOUR, env=env), 'alert')

    def test_every_hooked_unit_has_a_description(self):
        hooked = set()
        for unit in (ROOT / 'deploy').glob('poetio-*.service'):
            if 'OnFailure=poetio-alert@%n.service' in unit.read_text():
                hooked.add(unit.name)
        self.assertEqual(hooked, set(module.JOBS))
        for unit in hooked:
            self.assertRegex(unit, module.UNIT)

    def test_unknown_or_unsafe_unit_names_are_refused(self):
        for argv in (['poetio-alert'], ['poetio-alert', 'sshd.service'], ['poetio-alert', '../poetio-x.service'],
                     ['poetio-alert', 'poetio-backup.service', 'extra']):
            self.assertEqual(module.main(argv), 64)

    def test_delivery_uses_tls_before_login(self):
        calls = []

        class Server:
            def __init__(self, host, port, **options): calls.append(('connect', host, port))
            def __enter__(self): return self
            def __exit__(self, *args): calls.append(('quit',))
            def starttls(self, context): calls.append(('starttls', context.verify_mode.name))
            def login(self, user, password): calls.append(('login', user))
            def send_message(self, message): calls.append(('send', message['To']))

        self.run_alert(0)
        module.deliver(self.sent[-1], module.settings(ENV), plain=Server, secure=None)
        self.assertEqual(calls, [('connect', 'smtp.example.org', 587), ('starttls', 'CERT_REQUIRED'),
                                 ('login', 'sender@example.org'), ('send', 'owner@example.org'), ('quit',)])


if __name__ == '__main__':
    unittest.main()
