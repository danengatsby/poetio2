"""Recovery failure tests; all data and encryption keys are temporary."""
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("backup", Path(__file__).parents[1] / "scripts/backup-vps.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
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
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_online_snapshot_contains_committed_wal(self):
        target = self.root / "copy"
        backup.snapshot_data(self.data, target)
        with backup.read_db(target / "poetio.sqlite3") as db:
            self.assertEqual(db.execute("SELECT content FROM poems").fetchone()[0], "Vers nou în WAL")

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


if __name__ == "__main__":
    unittest.main()
