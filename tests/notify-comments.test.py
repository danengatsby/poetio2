from contextlib import closing
import importlib.util
import json
from pathlib import Path
import smtplib
import sqlite3
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('notify', Path(__file__).parent.parent / 'scripts' / 'notify-comments.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

ENV = {'POETIO_SMTP_HOST': 'smtp.example.org', 'POETIO_SMTP_USER': 'sender@example.org', 'POETIO_SMTP_PASSWORD': 'MUST_NOT_LEAK', 'POETIO_NOTIFY_TO': 'owner@example.org'}


class NoticeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.database = self.root / 'poetio.sqlite3'
        self.state = self.root / 'state' / 'comments.json'
        self.sent = []
        with closing(sqlite3.connect(self.database)) as db, db:
            for parent in ('poems', 'videos', 'books'):
                db.execute(f'CREATE TABLE {parent} (id TEXT PRIMARY KEY, title TEXT NOT NULL)')
                db.execute(f'INSERT INTO {parent} VALUES (?, ?)', (parent[0], f'Titlu {parent}'))
            for table, key in (('poem_comments', 'poem_id'), ('video_comments', 'video_id'), ('book_comments', 'book_id'), ('about_comments', None)):
                db.execute(f"CREATE TABLE {table} (id TEXT PRIMARY KEY, {key + ' TEXT NOT NULL, ' if key else ''}name TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending')")

    def add(self, table, comment_id, created_at, status='pending', name='Ana', content='Frumos poem.'):
        parent = {'poem_comments': 'p', 'video_comments': 'v', 'book_comments': 'b'}.get(table)
        with closing(sqlite3.connect(self.database)) as db, db:
            if parent:
                db.execute(f'INSERT INTO {table} VALUES (?, ?, ?, ?, ?, ?)', (comment_id, parent, name, content, created_at, status))
            else:
                db.execute(f'INSERT INTO {table} VALUES (?, ?, ?, ?, ?)', (comment_id, name, content, created_at, status))

    def run_notice(self, env=ENV, fail=False):
        def send(message, config):
            if fail:
                raise smtplib.SMTPException('refused')
            self.sent.append((message, config))
        return module.run(self.database, self.state, env, send)

    def test_unconfigured_notice_reads_and_sends_nothing(self):
        self.add('poem_comments', 'c1', 1000)
        for env in ({}, {'POETIO_SMTP_HOST': 'smtp.example.org'}, {'POETIO_NOTIFY_TO': 'owner@example.org'}):
            self.assertEqual(module.run(self.root / 'missing.sqlite3', self.state, env, self.fail), {'configured': False, 'sent': 0})
        self.assertFalse(self.state.exists())

    def test_one_message_lists_each_pending_comment_once(self):
        self.add('poem_comments', 'c1', 1_790_000_000_000, content='Prima  linie\nA doua linie')
        self.add('video_comments', 'c2', 1_790_000_100_000, name='Ion\r\nBcc: other@example.org')
        self.add('book_comments', 'c3', 1_790_000_200_000, status='approved')
        self.add('about_comments', 'c4', 1_790_000_300_000, content='x' * 900)
        self.assertEqual(self.run_notice(), {'configured': True, 'sent': 3})
        message, config = self.sent[0]
        self.assertEqual(message['Subject'], 'Poetio: 3 comentarii noi așteaptă moderare')
        self.assertEqual((message['From'], message['To']), ('sender@example.org', 'owner@example.org'))
        self.assertIsNone(message['Bcc'])
        body = message.get_content()
        self.assertIn('Poem „Titlu poems”', body)
        self.assertIn('Prima linie A doua linie', body)
        self.assertIn('De la: Ion Bcc: other@example.org', body)
        self.assertIn('Pagina autorului', body)
        self.assertIn('x' * 600 + '…', body)
        self.assertNotIn('x' * 601, body)
        self.assertNotIn('Titlu books', body, 'An approved comment is not announced')
        self.assertIn('https://poetio.cloud/admin/comentarii', body)
        self.assertNotIn('MUST_NOT_LEAK', message.as_string())
        self.assertEqual(config['mode'], 'starttls')
        self.assertEqual(config['port'], 587)
        self.assertEqual(json.loads(self.state.read_text()), {'notified_until': 1_790_000_300_000})
        self.assertEqual(self.run_notice(), {'configured': True, 'sent': 0})
        self.assertEqual(len(self.sent), 1)
        self.add('poem_comments', 'c5', 1_790_000_400_000)
        self.assertEqual(self.run_notice(), {'configured': True, 'sent': 1})
        self.assertEqual(self.sent[1][0]['Subject'], 'Poetio: un comentariu nou așteaptă moderare')
        self.assertNotIn('Prima linie', self.sent[1][0].get_content())

    def test_failed_delivery_is_retried(self):
        self.add('poem_comments', 'c1', 5000)
        with self.assertRaises(smtplib.SMTPException):
            self.run_notice(fail=True)
        self.assertFalse(self.state.exists())
        self.assertEqual(self.run_notice(), {'configured': True, 'sent': 1})

    def test_damaged_state_announces_again_rather_than_never(self):
        self.add('poem_comments', 'c1', 5000)
        self.state.parent.mkdir()
        for content in ('{', '{"notified_until": "soon"}', '{"notified_until": -1}', '[]'):
            self.state.write_text(content)
            self.assertEqual(module.load(self.state), 0)
        self.assertEqual(self.run_notice(), {'configured': True, 'sent': 1})

    def test_check_counts_without_sending_or_recording(self):
        self.add('poem_comments', 'c1', 5000)
        self.add('video_comments', 'c2', 6000, status='hidden')
        script = Path(__file__).parent.parent / 'scripts' / 'notify-comments.py'
        result = subprocess.run([sys.executable, str(script), '--check', '--database', str(self.database), '--state', str(self.state)], capture_output=True, text=True, env={})
        self.assertEqual((result.returncode, json.loads(result.stdout)), (0, {'pending': 1}))
        self.assertFalse(self.state.exists())
        missing = subprocess.run([sys.executable, str(script), '--check', '--database', str(self.root / 'none.sqlite3'), '--state', str(self.state)], capture_output=True, text=True, env={})
        self.assertEqual((missing.returncode, missing.stderr.strip()), (1, 'Comment notice failed: OperationalError'))

    def test_settings(self):
        self.assertEqual(module.settings({**ENV, 'POETIO_SMTP_PORT': '465'})['mode'], 'ssl')
        self.assertEqual(module.settings({**ENV, 'POETIO_NOTIFY_FROM': 'Poetio <site@example.org>', 'POETIO_SITE_URL': 'https://example.org/'})['sender'], 'Poetio <site@example.org>')
        self.assertEqual(module.settings({**ENV, 'POETIO_SITE_URL': 'https://example.org/'})['site'], 'https://example.org')
        with self.assertRaises(ValueError):
            module.settings({**ENV, 'POETIO_SMTP_TLS': 'none'})

    def test_delivery_uses_tls_before_login(self):
        calls = []
        class Server:
            def __init__(self, host, port, **options): calls.append(('connect', host, port, sorted(options)))
            def __enter__(self): return self
            def __exit__(self, *args): calls.append(('quit',))
            def starttls(self, context): calls.append(('starttls', context.verify_mode.name))
            def login(self, user, password): calls.append(('login', user))
            def send_message(self, message): calls.append(('send', message['To']))
        message = module.compose([{'kind': 'poem', 'id': 'c', 'name': 'Ana', 'content': 'Text', 'created_at': 1000, 'title': 'T'}], module.settings(ENV))
        module.deliver(message, module.settings(ENV), plain=Server, secure=None)
        self.assertEqual(calls, [('connect', 'smtp.example.org', 587, ['timeout']), ('starttls', 'CERT_REQUIRED'), ('login', 'sender@example.org'), ('send', 'owner@example.org'), ('quit',)])
        calls.clear()
        module.deliver(message, module.settings({**ENV, 'POETIO_SMTP_PORT': '465'}), plain=None, secure=Server)
        self.assertEqual([call[0] for call in calls], ['connect', 'login', 'send', 'quit'])
        self.assertEqual(calls[0][3], ['context', 'timeout'])


if __name__ == '__main__':
    unittest.main()
