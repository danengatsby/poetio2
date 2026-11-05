"""Recovery failure tests; all data and encryption keys are temporary."""
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tarfile
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("backup", Path(__file__).parents[1] / "scripts/backup-vps.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def test_collection_restore_checks_every_page_and_rejects_missing_or_repeated_poems(self):
        first = b'<a class="poem-card" data-poem-id="a"></a><a rel="next" href="/?page=2&amp;lang=ro#collection">Next</a>'
        last = b'<a class="poem-card" data-poem-id="b"></a>'
        def fetch(path):
            self.assertEqual(path, '/?page=2&lang=ro')
            return 200, last
        self.assertEqual(backup.check_poem_collection(fetch, ['a','b'], first), ['/', '/?page=2&lang=ro'])
        with self.assertRaisesRegex(RuntimeError, 'missing'):
            backup.check_poem_collection(lambda _: (200, b''), ['a','b'], first)
        with self.assertRaisesRegex(RuntimeError, 'duplicates'):
            backup.check_poem_collection(lambda _: (200, first), ['a','b'], first)
        external = first.replace(b'/?page=2&amp;lang=ro#collection', b'https://outside.test/')
        with self.assertRaisesRegex(RuntimeError, 'Invalid'):
            backup.check_poem_collection(fetch, ['a','b'], external)
        self.assertEqual(backup.check_poem_collection(fetch, ['old-id'], b'Legacy collection old-id'), ['/'])

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.data = self.root / "live"
        self.data.mkdir()
        self.db = sqlite3.connect(self.data / "poetio.sqlite3")
        self.db.execute("PRAGMA journal_mode=WAL")
        for table in backup.MEDIA:
            self.db.execute(f"CREATE TABLE {table}(object_key TEXT, byte_size INTEGER, content_hash TEXT)")
        self.db.execute("CREATE TABLE poems(id TEXT PRIMARY KEY, content TEXT)")
        self.db.execute("INSERT INTO poems VALUES('poem', 'Vers nou în WAL')")
        self.db.execute("CREATE TABLE book_page_texts(file_id TEXT, page INTEGER, content TEXT)")
        self.db.execute("INSERT INTO book_page_texts VALUES('book', 1, 'Transcriere corectată — ș, ț')")
        self.db.execute("CREATE TABLE content_history(kind TEXT, snapshot TEXT)")
        self.db.execute("INSERT INTO content_history VALUES('book', '{\"description\":\"Carte ștearsă\"}')")
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_online_snapshot_contains_committed_wal(self):
        target = self.root / "copy"
        backup.snapshot_data(self.data, target)
        with backup.read_db(target / "poetio.sqlite3") as db:
            self.assertEqual(db.execute("SELECT content FROM poems").fetchone()[0], "Vers nou în WAL")
            self.assertEqual(db.execute("SELECT content FROM book_page_texts").fetchone()[0], "Transcriere corectată — ș, ț")
            self.assertEqual(json.loads(db.execute("SELECT snapshot FROM content_history WHERE kind='book'").fetchone()[0])["description"], "Carte ștearsă")

    def test_missing_or_corrupt_media_rejects_snapshot(self):
        key = "poem-images/72766231-67aa-4db8-9123-77071144a730/" + "a" * 64
        self.db.execute("INSERT INTO poem_images VALUES(?, 3, ?)", (key, "a" * 64))
        self.db.commit()
        with self.assertRaises(FileNotFoundError):
            backup.snapshot_data(self.data, self.root / "missing")
        path = self.data / "images" / key
        path.parent.mkdir(parents=True)
        path.write_bytes(b"bad")
        with self.assertRaisesRegex(RuntimeError, "does not match"):
            backup.snapshot_data(self.data, self.root / "corrupt")

    def test_archive_roundtrip_and_tampering(self):
        payload = self.root / "payload"
        payload.mkdir()
        counts = backup.snapshot_data(self.data, payload / "data")
        manifest = {"files": backup.file_manifest(payload), "tables": counts}
        (payload / "manifest.json").write_text(json.dumps(manifest))
        key = self.root / "key"
        key.write_bytes(os.urandom(48).hex().encode())
        key.chmod(0o600)
        tar_path = self.root / "payload.tar.gz"
        with tarfile.open(tar_path, "w:gz") as tar:
            for child in payload.iterdir():
                tar.add(child, arcname=child.name)
        archive = self.root / "encrypted.gpg"
        backup.gpg(key, "--cipher-algo", "AES256", "--output", archive, "--symmetric", tar_path)
        restored = self.root / "restored"
        backup.restore_archive(archive, key, restored)
        (restored / "data/poetio.sqlite3").write_bytes(b"corrupt")
        with self.assertRaisesRegex(RuntimeError, "SHA-256"):
            backup.verify_payload(restored)
        with self.assertRaisesRegex(RuntimeError, "already exist"):
            backup.restore_archive(archive, key, restored)

    def test_external_symlinks_are_not_archived(self):
        folder = self.root / "payload"
        folder.mkdir()
        (folder / "escape").symlink_to("/etc/passwd")
        with self.assertRaisesRegex(RuntimeError, "escapes snapshot"):
            backup.file_manifest(folder)

    def arguments(self):
        for name in ['runtime', 'source', 'config', 'backups']:
            (self.root / name).mkdir(exist_ok=True)
        key = self.root / 'key'
        key.write_bytes(os.urandom(48).hex().encode())
        key.chmod(0o600)
        return SimpleNamespace(data_dir=self.data, source_dir=self.root/'source', runtime_dir=self.root/'runtime',
                               config_dir=self.root/'config', output_dir=self.root/'backups', key_file=key, keep=14, reserve_mib=0)

    def test_low_space_fails_before_snapshot_and_preserves_last_success(self):
        args = self.arguments()
        marker = args.output_dir / 'last-success.json'
        marker.write_text('{"ok":true,"archive":"existing"}')
        with patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=1)), patch.object(backup, 'snapshot_data') as snapshot:
            with self.assertRaisesRegex(RuntimeError, 'Insufficient backup space'):
                backup.create_backup(args)
            snapshot.assert_not_called()
        self.assertEqual(json.loads(marker.read_text())['archive'], 'existing')
        self.assertEqual(list(args.output_dir.glob('.backup-*')), [])

    def test_streamed_creation_restores_after_removing_snapshot_and_publishes_only_verified_archive(self):
        args = self.arguments()
        (args.runtime_dir / 'marker').write_text('runtime preserved')
        def smoke(root):
            self.assertFalse((root.parent / 'payload').exists())
            self.assertEqual(list(root.parent.glob('*.tar.gz')), [])
            self.assertEqual((root/'runtime/marker').read_text(), 'runtime preserved')
            return ['/']
        with patch.object(backup, 'copy_configuration', side_effect=lambda target, _: target.mkdir()), patch.object(backup, 'smoke_restore', side_effect=smoke):
            result = backup.create_backup(args)
        self.assertTrue(result['ok'])
        self.assertEqual(json.loads((args.output_dir/'last-success.json').read_text()), result)
        archive = args.output_dir/result['archive']
        self.assertTrue(archive.is_file())
        # The streaming restore remains compatible with existing encrypted tar.gz
        # archives and must reject a truncated authenticated ciphertext.
        damaged = self.root/'damaged.gpg'
        damaged.write_bytes(archive.read_bytes()[:-12])
        with self.assertRaises((RuntimeError, tarfile.TarError, EOFError)):
            backup.restore_archive(damaged, args.key_file, self.root/'damaged-restore')

    def test_failed_restore_never_replaces_success_or_publishes_an_archive(self):
        args = self.arguments()
        marker = args.output_dir/'last-success.json'
        marker.write_text('{"ok":true,"archive":"existing"}')
        with patch.object(backup, 'copy_configuration', side_effect=lambda target, _: target.mkdir()), patch.object(backup, 'smoke_restore', side_effect=RuntimeError('Restore check failed')):
            with self.assertRaisesRegex(RuntimeError, 'Restore check failed'):
                backup.create_backup(args)
        self.assertEqual(json.loads(marker.read_text())['archive'], 'existing')
        self.assertEqual(list(args.output_dir.glob('*.gpg')), [])
        self.assertEqual(list(args.output_dir.glob('.backup-*')), [])


if __name__ == "__main__":
    unittest.main()
