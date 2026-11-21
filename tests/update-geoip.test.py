import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error

spec = importlib.util.spec_from_file_location('update_geoip', Path(__file__).parent.parent / 'scripts' / 'update-geoip.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

CITY = b'\0' * 64 + module.MARKER + b'database_type\x4eDBIP-City-Lite'
COUNTRY = b'\0' * 64 + module.MARKER + b'database_type\x51DBIP-Country-Lite'


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name) / 'geoip'
        self.requests = []

    def serve(self, files):
        def download(url, target):
            month = url.split('dbip-city-lite-')[1][:7]
            self.requests.append(month)
            if month not in files:
                raise urllib.error.HTTPError(url, 404, 'Not Found', {}, io.BytesIO())
            target.write_bytes(files[month])
        return download

    def update(self, files, today=dt.date(2026, 11, 2)):
        return module.update(self.directory, today, download=self.serve(files), min_bytes=10)

    def test_months_try_this_month_then_the_previous_one(self):
        self.assertEqual(module.months(dt.date(2026, 1, 1)), ['2026-01', '2025-12'])

    def test_installs_this_month_and_skips_it_next_time(self):
        result = self.update({'2026-11': CITY})
        self.assertTrue(result['updated'])
        self.assertEqual((self.directory / 'city.mmdb').read_bytes(), CITY)
        self.assertEqual(json.loads((self.directory / 'city.json').read_text())['month'], '2026-11')
        self.assertEqual(self.update({'2026-11': CITY}), {'ok': True, 'month': '2026-11', 'updated': False})
        self.assertEqual(len(self.requests), 1)
        self.assertEqual([path.name for path in self.directory.iterdir() if path.name.startswith('.')], [])

    def test_falls_back_to_last_month_early_on_the_first(self):
        self.assertEqual(self.update({'2026-10': CITY}, dt.date(2026, 11, 1))['month'], '2026-10')
        # Once October is installed, an unpublished November keeps it without a new download.
        self.assertEqual(self.update({'2026-10': CITY}, dt.date(2026, 11, 1))['updated'], False)

    def test_a_wrong_download_keeps_the_installed_database(self):
        self.update({'2026-10': CITY}, dt.date(2026, 10, 5))
        with self.assertRaises(RuntimeError):
            self.update({'2026-11': COUNTRY})
        self.assertEqual((self.directory / 'city.mmdb').read_bytes(), CITY)
        self.assertEqual(json.loads((self.directory / 'city.json').read_text())['month'], '2026-10')
        self.assertEqual([path.name for path in self.directory.iterdir() if path.name.startswith('.')], [])

    def test_nothing_published_and_nothing_installed_is_an_error(self):
        with self.assertRaises(RuntimeError):
            self.update({})


if __name__ == '__main__':
    unittest.main()
