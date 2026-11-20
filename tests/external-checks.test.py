import datetime as dt
import hashlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORK = Path(tempfile.mkdtemp(prefix='poetio-external-test-'))
os.environ['POETIO_BACKUP_DIR'] = str(WORK / 'backups')
os.environ['STATE_DIRECTORY'] = str(WORK / 'state')
spec = importlib.util.spec_from_file_location('external', ROOT / 'scripts' / 'external-checks.py')
external = importlib.util.module_from_spec(spec)
spec.loader.exec_module(external)
HAVE_RCLONE = shutil.which('rclone') is not None


def free_port():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        return probe.getsockname()[1]


class Recorder(http.server.ThreadingHTTPServer):
    """Heartbeat service stand-in; also serves a page for the site check."""

    def __init__(self, page=b'<html lang="ro"><body>Poetio</body></html>', status=200):
        self.calls, self.page, self.status = [], page, status
        recorder = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
                recorder.calls.append((self.path, body))
                self.send_response(200)
                self.end_headers()

            def do_GET(self):
                self.send_response(recorder.status)
                self.end_headers()
                self.wfile.write(recorder.page)

            def log_message(self, *args):
                pass

        super().__init__(('127.0.0.1', 0), Handler)
        threading.Thread(target=self.serve_forever, daemon=True).start()

    @property
    def url(self):
        return f'http://127.0.0.1:{self.server_address[1]}'


def make_backup(name, age_hours=1, size=256 * 1024, publish=True):
    backups = external.BACKUPS
    backups.mkdir(parents=True, exist_ok=True)
    data = os.urandom(size)
    archive = backups / name
    archive.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    (backups / (name + '.sha256')).write_text(f'{digest}  {name}\n')
    created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=age_hours)).strftime('%Y%m%dT%H%M%SZ')
    info = {'ok': True, 'created_utc': created, 'archive': name, 'bytes': size, 'sha256': digest}
    (backups / (name + '.verified.json')).write_text(json.dumps(info))
    if publish:
        (backups / 'last-success.json').write_text(json.dumps(info))
    return archive


class ExternalTestCase(unittest.TestCase):
    def setUp(self):
        for folder in ('backups', 'state', 'remote'):
            shutil.rmtree(WORK / folder, ignore_errors=True)
        (WORK / 'remote').mkdir()
        self.heartbeat = Recorder()
        self.addCleanup(self.heartbeat.shutdown)
        self.environment = {'POETIO_OFFSITE_REMOTE': str(WORK / 'remote'), 'POETIO_HEARTBEAT_BACKUP': self.heartbeat.url + '/backup-check',
                            'POETIO_HEARTBEAT_SITE': self.heartbeat.url + '/site-check'}
        for key in ('POETIO_OFFSITE_KEEP', 'POETIO_OFFSITE_MIN_FREE_GB', 'POETIO_SITE_URL', 'POETIO_BACKUP_MAX_AGE_HOURS'):
            os.environ.pop(key, None)
        os.environ.update(self.environment)


@unittest.skipUnless(HAVE_RCLONE, 'rclone is not installed')
class OffsiteTest(ExternalTestCase):
    def test_copies_the_verified_archive_and_reports_success(self):
        archive = make_backup('poetio-20261120T031500Z.tar.gz.gpg')
        self.assertEqual(external.main(['x', 'offsite']), 0)
        for suffix in ('', '.sha256', '.verified.json'):
            self.assertEqual((WORK / 'remote' / (archive.name + suffix)).read_bytes(), Path(str(archive) + suffix).read_bytes())
        self.assertEqual(self.heartbeat.calls[-1][0], '/backup-check')
        self.assertIn(archive.name, self.heartbeat.calls[-1][1])
        state = json.loads((WORK / 'state' / 'last-offsite.json').read_text())
        self.assertEqual((state['archive'], state['remote_archives']), (archive.name, 1))
        # A second run finds the copy in place and still reports success.
        self.assertEqual(external.main(['x', 'offsite']), 0)
        self.assertEqual([path for path, _ in self.heartbeat.calls], ['/backup-check', '/backup-check'])

    def test_reports_a_stale_backup_as_a_failure(self):
        make_backup('poetio-20261118T031500Z.tar.gz.gpg', age_hours=50)
        self.assertEqual(external.main(['x', 'offsite']), 1)
        path, body = self.heartbeat.calls[-1]
        self.assertEqual(path, '/backup-check/fail')
        self.assertIn('50 h old', body)
        self.assertEqual(list((WORK / 'remote').iterdir()), [])

    def test_reports_an_archive_that_changed_after_verification(self):
        archive = make_backup('poetio-20261120T031500Z.tar.gz.gpg')
        with open(archive, 'r+b') as handle:
            handle.write(b'X')
        self.assertEqual(external.main(['x', 'offsite']), 1)
        self.assertIn('no longer matches', self.heartbeat.calls[-1][1])

    def test_reports_an_unreachable_destination(self):
        make_backup('poetio-20261120T031500Z.tar.gz.gpg')
        os.environ['POETIO_OFFSITE_REMOTE'] = 'missing-remote-name:bucket/poetio'
        self.assertEqual(external.main(['x', 'offsite']), 1)
        path, body = self.heartbeat.calls[-1]
        self.assertEqual(path, '/backup-check/fail')
        self.assertIn('rclone copy failed', body)

    def test_keeps_only_the_newest_archives_when_asked(self):
        for day in ('17', '18', '19'):
            old = make_backup(f'poetio-202611{day}T031500Z.tar.gz.gpg', publish=False)
            for suffix in ('', '.sha256', '.verified.json'):
                shutil.copy(str(old) + suffix, WORK / 'remote')
        make_backup('poetio-20261120T031500Z.tar.gz.gpg')
        os.environ['POETIO_OFFSITE_KEEP'] = '2'
        self.assertEqual(external.main(['x', 'offsite']), 0)
        self.assertEqual(sorted(path.name for path in (WORK / 'remote').iterdir()), [
            'poetio-20261119T031500Z.tar.gz.gpg', 'poetio-20261119T031500Z.tar.gz.gpg.sha256', 'poetio-20261119T031500Z.tar.gz.gpg.verified.json',
            'poetio-20261120T031500Z.tar.gz.gpg', 'poetio-20261120T031500Z.tar.gz.gpg.sha256', 'poetio-20261120T031500Z.tar.gz.gpg.verified.json'])

    def test_reports_a_destination_running_out_of_space(self):
        make_backup('poetio-20261120T031500Z.tar.gz.gpg')
        os.environ['POETIO_OFFSITE_MIN_FREE_GB'] = '100000000'
        self.assertEqual(external.main(['x', 'offsite']), 1)
        path, body = self.heartbeat.calls[-1]
        self.assertEqual(path, '/backup-check/fail')
        self.assertIn('GiB left at', body)

    def test_never_deletes_without_a_limit(self):
        old = make_backup('poetio-20261101T031500Z.tar.gz.gpg', publish=False)
        shutil.copy(old, WORK / 'remote')
        make_backup('poetio-20261120T031500Z.tar.gz.gpg')
        self.assertEqual(external.main(['x', 'offsite']), 0)
        self.assertTrue((WORK / 'remote' / old.name).exists())


def rclone_serves_s3():
    # `rclone serve s3 --help` exits 0 even where `serve s3` does not exist (rclone
    # before 1.65, as packaged in Ubuntu 24.04), so read the list of subcommands.
    if not HAVE_RCLONE:
        return False
    listing = subprocess.run(['rclone', 'serve', '--help'], text=True, capture_output=True).stdout
    return any(line.split()[:1] == ['s3'] for line in listing.splitlines())


@unittest.skipUnless(rclone_serves_s3(), 'rclone without `serve s3`')
class S3Test(ExternalTestCase):
    """The same copy over the S3 protocol, with multipart upload, as on a real bucket."""

    def test_copies_over_s3_with_multipart_upload(self):
        served = WORK / 'served'
        shutil.rmtree(served, ignore_errors=True)
        (served / 'poetio-backups').mkdir(parents=True)
        port = free_port()
        server = subprocess.Popen(['rclone', 'serve', 's3', str(served), '--addr', f'127.0.0.1:{port}', '--auth-key', 'test-key,test-secret'],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(server.wait)
        self.addCleanup(server.terminate)
        for _ in range(100):
            if server.poll() is not None:
                self.fail(f'rclone serve s3 exited with {server.returncode}')
            try:
                socket.create_connection(('127.0.0.1', port), timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        else:
            self.fail('rclone serve s3 did not start listening within 10 seconds')
        os.environ.update({
            'RCLONE_CONFIG_TESTS3_TYPE': 's3', 'RCLONE_CONFIG_TESTS3_PROVIDER': 'Rclone',
            'RCLONE_CONFIG_TESTS3_ENDPOINT': f'http://127.0.0.1:{port}',
            'RCLONE_CONFIG_TESTS3_ACCESS_KEY_ID': 'test-key', 'RCLONE_CONFIG_TESTS3_SECRET_ACCESS_KEY': 'test-secret',
            'RCLONE_S3_UPLOAD_CUTOFF': '1M', 'RCLONE_S3_CHUNK_SIZE': '5M',
            'POETIO_OFFSITE_REMOTE': 'tests3:poetio-backups/poetio',
        })
        archive = make_backup('poetio-20261120T031500Z.tar.gz.gpg', size=12 * 1024 * 1024)
        self.assertEqual(external.main(['x', 'offsite']), 0, self.heartbeat.calls)
        self.assertEqual((served / 'poetio-backups' / 'poetio' / archive.name).read_bytes(), archive.read_bytes())
        self.assertEqual(external.main(['x', 'offsite']), 0)


class SiteTest(ExternalTestCase):
    def test_reports_a_working_site(self):
        os.environ['POETIO_SITE_URL'] = self.heartbeat.url
        self.assertEqual(external.main(['x', 'site']), 0)
        self.assertEqual(self.heartbeat.calls[-1][0], '/site-check')

    def test_reports_a_broken_site(self):
        broken = Recorder(page=b'Bad gateway', status=502)
        self.addCleanup(broken.shutdown)
        os.environ['POETIO_SITE_URL'] = broken.url
        self.assertEqual(external.main(['x', 'site']), 1)
        path, body = self.heartbeat.calls[-1]
        self.assertEqual(path, '/site-check/fail')
        self.assertIn('did not answer', body)

    def test_reports_nothing_without_a_heartbeat_url(self):
        os.environ['POETIO_SITE_URL'] = self.heartbeat.url
        os.environ.pop('POETIO_HEARTBEAT_SITE')
        self.assertEqual(external.main(['x', 'site']), 0)
        self.assertEqual(self.heartbeat.calls, [])


if __name__ == '__main__':
    try:
        unittest.main()
    finally:
        shutil.rmtree(WORK, ignore_errors=True)
