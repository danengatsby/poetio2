import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unicodedata
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE = tempfile.mkdtemp(prefix='poetio-release-test-')
os.environ['POETIO_RELEASE_BASE'] = BASE
os.environ['POETIO_RELEASE_DATA'] = os.path.join(BASE, 'data')
os.environ['POETIO_RELEASE_BACKUPS'] = os.path.join(BASE, 'backups')
spec = importlib.util.spec_from_file_location('release', ROOT / 'deploy' / 'release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

COMMIT = 'a' * 40
LOCK = b'{"packages": {}}'


def build_archive(directory, files, *, commit=COMMIT, lock=LOCK, listed=None, extra=None):
    """A package-build style archive and its .sha256 line."""
    archive = Path(directory) / 'build.tar.gz'
    digests = {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}
    info = {'commit': commit, 'package_lock_sha256': hashlib.sha256(lock).hexdigest(), 'files': listed if listed is not None else digests,
            'node': 'v24', 'npm': '11', 'built_at': 'now'}
    with tarfile.open(archive, 'w:gz') as bundle:
        def add(name, data):
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            bundle.addfile(entry, io.BytesIO(data))
        for name, data in files.items():
            add('dist/' + name, data)
        add('build-info.json', json.dumps(info).encode())
        if extra:
            extra(bundle)
    return archive, hashlib.sha256(archive.read_bytes()).hexdigest() + '  build.tar.gz\n'


class ArtifactTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.files = {'server/BUILD_ID': b'id', 'client/app.js': b'console.log(1)'}

    def tearDown(self):
        self.directory.cleanup()

    def target(self):
        target = self.root / 'out'
        target.mkdir()
        return target

    def test_accepts_the_build_of_the_commit(self):
        archive, checksum = build_archive(self.root, self.files)
        info = release.verify_artifact(archive, checksum, COMMIT, LOCK, self.target())
        self.assertEqual(info['commit'], COMMIT)
        self.assertEqual((self.root / 'out/dist/client/app.js').read_bytes(), b'console.log(1)')

    def test_refuses_a_changed_archive(self):
        archive, checksum = build_archive(self.root, self.files)
        with self.assertRaisesRegex(SystemExit, 'does not match its .sha256'):
            release.verify_artifact(archive, '0' * 64 + '  build.tar.gz', COMMIT, LOCK, self.target())

    def test_refuses_another_commit_or_lockfile(self):
        archive, checksum = build_archive(self.root, self.files, commit='b' * 40)
        with self.assertRaisesRegex(SystemExit, 'not ' + COMMIT):
            release.verify_artifact(archive, checksum, COMMIT, LOCK, self.target())
        archive, checksum = build_archive(self.root, self.files, lock=b'{}')
        with self.assertRaisesRegex(SystemExit, 'different package-lock.json'):
            release.verify_artifact(archive, checksum, COMMIT, LOCK, self.root / 'out')

    def test_refuses_files_missing_from_the_list(self):
        archive, checksum = build_archive(self.root, self.files, listed={'server/BUILD_ID': hashlib.sha256(b'id').hexdigest()})
        with self.assertRaisesRegex(SystemExit, 'differ from the list'):
            release.verify_artifact(archive, checksum, COMMIT, LOCK, self.target())

    def test_refuses_entries_outside_dist_and_links(self):
        def outside(bundle):
            entry = tarfile.TarInfo('scripts/start-vps.mjs')
            bundle.addfile(entry, io.BytesIO(b''))
        archive, checksum = build_archive(self.root, self.files, extra=outside)
        with self.assertRaisesRegex(SystemExit, 'Unexpected entry'):
            release.verify_artifact(archive, checksum, COMMIT, LOCK, self.target())

        def link(bundle):
            entry = tarfile.TarInfo('dist/passwd')
            entry.type, entry.linkname = tarfile.SYMTYPE, '/etc/passwd'
            bundle.addfile(entry)
        archive, checksum = build_archive(self.root, self.files, extra=link)
        with self.assertRaisesRegex(SystemExit, 'only files and folders'):
            release.verify_artifact(archive, checksum, COMMIT, LOCK, self.root / 'out')


class InstalledTreeTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.modules = Path(self.directory.name) / 'node_modules'
        self.lock = {'packages': {'': {'name': 'poetio'},
                                  'node_modules/react': {'version': '19.3.1', 'integrity': 'sha512-a'},
                                  'node_modules/@img/sharp-darwin-arm64': {'version': '0.35.5', 'integrity': 'sha512-b', 'optional': True}}}
        self.install({'node_modules/react': {'version': '19.3.1', 'integrity': 'sha512-a'}})

    def tearDown(self):
        self.directory.cleanup()

    def install(self, packages):
        self.modules.mkdir(exist_ok=True)
        (self.modules / '.package-lock.json').write_text(json.dumps({'packages': packages}))
        for key, entry in packages.items():
            folder = self.modules.parent / key
            folder.mkdir(parents=True, exist_ok=True)
            (folder / 'package.json').write_text(json.dumps({'version': entry['version']}))

    def check(self):
        return release.check_installed_tree(self.modules, json.dumps(self.lock).encode())

    def test_matching_tree_without_other_platforms(self):
        self.assertEqual(self.check(), [])

    def test_reports_missing_changed_and_extra_packages(self):
        self.lock['packages']['node_modules/vinext'] = {'version': '1.0.0-beta.9', 'integrity': 'sha512-c'}
        self.lock['packages']['node_modules/react']['version'] = '19.3.2'
        self.install({'node_modules/react': {'version': '19.3.1', 'integrity': 'sha512-a'},
                      'node_modules/recharts': {'version': '3.8.0', 'integrity': 'sha512-d'}})
        self.assertEqual(sorted(self.check()), ['different node_modules/react', 'missing node_modules/vinext',
                                                'not in package-lock.json node_modules/recharts'])

    def test_reports_a_package_deleted_after_install(self):
        (self.modules / 'react' / 'package.json').unlink()
        self.assertEqual(self.check(), ['not on disk as recorded node_modules/react'])

    def test_requires_the_hidden_lockfile(self):
        (self.modules / '.package-lock.json').unlink()
        self.assertIn('run npm ci', self.check()[0])


class PruneTest(unittest.TestCase):
    NOW = 1_795_000_000  # 2026-11-17T...Z

    def setUp(self):
        import shutil
        for folder in (release.RELEASES, release.RECORDS, release.BACKUPS):
            shutil.rmtree(folder, ignore_errors=True)
            folder.mkdir(parents=True)
        if release.CURRENT.is_symlink():
            release.CURRENT.unlink()
        stamp = lambda days_ago: release.dt.datetime.fromtimestamp(self.NOW - days_ago * 86400, release.dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        self.stamp = stamp
        # Eight releases, one a day; the active one is the newest but one, rolled back from the newest.
        self.names = [f'{stamp(8 - day)}-r{day}' for day in range(8)]
        for name in self.names:
            (release.RELEASES / name / 'node_modules').mkdir(parents=True)
        self.active, self.rollback = self.names[6], self.names[1]
        release.switch(release.RELEASES / self.active)
        (release.RECORDS / self.active).mkdir()
        (release.RECORDS / self.active / 'activation.json').write_text(
            json.dumps({'previous_release': str((release.RELEASES / self.rollback).resolve())}))

    def snapshot(self, name):
        path = release.BACKUPS / name
        path.mkdir()
        (path / 'poetio.sqlite3').write_bytes(b'x')
        return path

    def test_keeps_the_five_newest_the_active_one_and_its_rollback_target(self):
        plan = release.prune_plan(now=self.NOW)
        self.assertEqual([path.name for path in plan['releases']], [self.names[0], self.names[2]])
        kept = {path.name for path in plan['kept_releases']}
        self.assertEqual(kept, {self.rollback, *self.names[3:]})
        self.assertIn(self.active, kept)

    def test_snapshots_older_than_thirty_days_go_except_the_active_releases(self):
        old = self.snapshot(f'before-{self.stamp(31)}-old-release')
        old_word_first = self.snapshot(f'before-deploy-{self.stamp(45)}')
        recent = self.snapshot(f'before-{self.stamp(29)}-recent')
        own = self.snapshot('before-' + self.active)
        os.utime(own, (self.NOW - 90 * 86400,) * 2)
        unnamed = self.snapshot('before-something')
        os.utime(unnamed, (self.NOW - 40 * 86400,) * 2)
        (release.BACKUPS / 'automatic').mkdir()
        plan = release.prune_plan(now=self.NOW)
        self.assertEqual(plan['snapshots'], sorted([old, old_word_first, unnamed]))
        self.assertNotIn(recent, plan['snapshots'])

    def test_leftover_staging_folders_older_than_a_day_go(self):
        fresh = release.RELEASES / 'poetio-build-fresh'
        stale = release.RELEASES / 'poetio-build-stale'
        fresh.mkdir()
        stale.mkdir()
        os.utime(stale, (self.NOW - 2 * 86400,) * 2)
        os.utime(fresh, (self.NOW - 3600,) * 2)
        self.assertEqual(release.prune_plan(now=self.NOW)['staging'], [stale])

    def test_apply_deletes_only_what_the_plan_lists(self):
        self.snapshot(f'before-{self.stamp(60)}-gone')
        keep = self.snapshot(f'before-{self.stamp(1)}-stays')
        plan = release.prune_plan(now=self.NOW)
        release.apply_prune(plan)
        self.assertEqual(sorted(path.name for path in release.RELEASES.iterdir()),
                         sorted([self.rollback, *self.names[3:]]))
        self.assertEqual([path.name for path in release.BACKUPS.iterdir()], [keep.name])
        self.assertEqual(release.CURRENT.resolve(), (release.RELEASES / self.active).resolve())

    def test_refuses_paths_outside_releases_and_backups(self):
        outside = Path(BASE) / 'elsewhere'
        outside.mkdir(exist_ok=True)
        with self.assertRaises(SystemExit):
            release.apply_prune({'releases': [outside], 'staging': [], 'snapshots': []})
        self.assertTrue(outside.exists())

    def test_without_current_nothing_is_protected_but_the_newest_five(self):
        release.CURRENT.unlink()
        plan = release.prune_plan(now=self.NOW)
        self.assertEqual([path.name for path in plan['releases']], self.names[:3])


class SwitchTest(unittest.TestCase):
    def test_replaces_current_atomically(self):
        first, second = Path(BASE) / 'releases' / 'one', Path(BASE) / 'releases' / 'two'
        first.mkdir(parents=True, exist_ok=True)
        second.mkdir(exist_ok=True)
        release.switch(first)
        self.assertEqual(release.CURRENT.resolve(), first)
        release.switch(second)
        self.assertEqual(release.CURRENT.resolve(), second)
        self.assertFalse((Path(BASE) / 'current-next').exists())


class HelpersTest(unittest.TestCase):
    def test_github_slug(self):
        self.assertEqual(release.github_slug('https://github.com/danengatsby/poetio2.git'), 'danengatsby/poetio2')
        self.assertEqual(release.github_slug('git@github.com:danengatsby/poetio2.git'), 'danengatsby/poetio2')
        with self.assertRaises(SystemExit):
            release.github_slug('https://example.com/poetio.git')

    def test_strip_marks_and_derived_tables(self):
        self.assertEqual(release.strip_marks(unicodedata.normalize('NFD', 'Întâlnirea din crâng')), 'Intalnirea din crang')
        self.assertTrue(all(release.DERIVED_TABLE.match(name) for name in
                            ['poem_search', 'poem_search_pending', 'book_search_fts_data', 'schema_migrations', 'collection_meta']))
        self.assertFalse(any(release.DERIVED_TABLE.match(name) for name in ['poems', 'content_history', 'videos', 'poem_comments']))


if __name__ == '__main__':
    try:
        unittest.main()
    finally:
        import shutil
        shutil.rmtree(BASE, ignore_errors=True)
