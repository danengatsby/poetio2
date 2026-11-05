#!/usr/bin/env python3
"""Encrypted, online SQLite backups with an isolated application restore check."""
import argparse
import datetime as dt
import fcntl
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sqlite3
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

MEDIA = {"poem_images": ("images", "poem-images"), "poem_audio": ("audio", "poem-audio"),
         "video_files": ("videos", "videos"), "book_files": ("books", "books")}
EXCLUDES = {".git", "node_modules*", "dist", ".sites-runtime", ".wrangler", "outputs", "work", "__pycache__"}


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read_db(path):
    return sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)


def database_summary(path):
    with read_db(path) as db:
        if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise RuntimeError("SQLite integrity check failed")
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError("SQLite foreign key check failed")
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        return {t: db.execute('SELECT COUNT(*) FROM "' + t.replace('"', '""') + '"').fetchone()[0] for t in tables}


def media_rows(database):
    with read_db(database) as db:
        for table, (folder, prefix) in MEDIA.items():
            for key, size, sha in db.execute(f"SELECT object_key, byte_size, content_hash FROM {table}"):
                if not re.fullmatch(re.escape(prefix) + r"/[0-9a-f-]{36}/[0-9a-f]{64}", key, re.I):
                    raise RuntimeError("Unsafe media object key in " + table)
                yield Path(folder) / key, size, sha


def snapshot_data(source, destination):
    destination.mkdir()
    with read_db(source / "poetio.sqlite3") as src, sqlite3.connect(destination / "poetio.sqlite3") as dst:
        src.backup(dst, pages=256, sleep=0.05)
    counts = database_summary(destination / "poetio.sqlite3")
    # Objects are immutable and are committed to the DB only after the atomic write.
    # Copy precisely the objects in the snapshot, including recoverable detached media.
    for relative, size, sha in media_rows(destination / "poetio.sqlite3"):
        original = source / relative
        if original.is_symlink() or not original.resolve().is_relative_to(source.resolve()):
            raise RuntimeError("Unsafe media path")
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, target)
        if target.stat().st_size != size or digest(target) != sha:
            raise RuntimeError("Media content does not match SQLite: " + str(relative))
    return counts


def copy_configuration(target, config_dir):
    target.mkdir()
    for file in config_dir.iterdir():
        # The encryption key must be stored separately from the archives it unlocks.
        if file.is_file() and file.name != "backup.key":
            shutil.copy2(file, target / file.name)
    for name, file in {
        "systemd/poetio.service": "/etc/systemd/system/poetio.service",
        "systemd/poetio-backup.service": "/etc/systemd/system/poetio-backup.service",
        "systemd/poetio-backup.timer": "/etc/systemd/system/poetio-backup.timer",
        "systemd/poetio-status.service": "/etc/systemd/system/poetio-status.service",
        "systemd/poetio-status.timer": "/etc/systemd/system/poetio-status.timer",
        "nginx/poetio-cloud": "/etc/nginx/sites-enabled/poetio-cloud",
        "nginx/poetio-vps": "/etc/nginx/sites-enabled/poetio-vps",
        "nginx/poetio-comments-rate.conf": "/etc/nginx/conf.d/poetio-comments-rate.conf",
    }.items():
        if Path(file).is_file():
            output = target / name
            output.parent.mkdir(exist_ok=True)
            shutil.copyfile(file, output)
    dropins = Path("/etc/systemd/system/poetio.service.d")
    if dropins.is_dir():
        shutil.copytree(dropins, target / "systemd/poetio.service.d")
    tls = Path("/etc/letsencrypt/live/poetio.cloud")
    if tls.is_dir():
        (target / "tls").mkdir()
        for name in ("cert.pem", "chain.pem", "fullchain.pem", "privkey.pem"):
            shutil.copyfile(tls / name, target / "tls" / name)


def file_manifest(root):
    files = {}
    for path in sorted(root.rglob("*")):
        relative = str(path.relative_to(root))
        if path.is_symlink():
            if not path.resolve().is_relative_to(root.resolve()):
                raise RuntimeError("Archive symlink escapes snapshot: " + relative)
            files[relative] = {"link": os.readlink(path)}
        elif path.is_file() and relative != "manifest.json":
            files[relative] = {"bytes": path.stat().st_size, "sha256": digest(path)}
    return files


def verify_payload(root):
    manifest = json.loads((root / "manifest.json").read_text())
    if manifest["files"] != file_manifest(root):
        raise RuntimeError("Restored archive differs from its SHA-256 manifest")
    if manifest["tables"] != database_summary(root / "data/poetio.sqlite3"):
        raise RuntimeError("Restored SQLite table counts differ")
    for relative, size, sha in media_rows(root / "data/poetio.sqlite3"):
        path = root / "data" / relative
        if path.stat().st_size != size or digest(path) != sha:
            raise RuntimeError("Restored media verification failed")
    return manifest


class CollectionPage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.next = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and 'poem-card' in attrs.get('class', '').split() and attrs.get('data-poem-id'):
            self.ids.append(attrs['data-poem-id'])
        if tag == 'a' and 'next' in attrs.get('rel', '').split():
            self.next = attrs.get('href')


def check_poem_collection(fetch, expected_ids, body):
    checked, found, seen = [], [], set()
    path = '/'
    while True:
        if path in seen:
            raise RuntimeError('Restored collection pagination loops')
        seen.add(path)
        page = CollectionPage()
        page.feed(body.decode('utf-8'))
        # Older archives contain the complete collection without card IDs.
        if path == '/' and not page.ids and not page.next and all(identifier.encode() in body for identifier in expected_ids):
            return ['/']
        found.extend(page.ids)
        checked.append(path)
        if len(found) > len(expected_ids) or len(found) != len(set(found)):
            raise RuntimeError('Restored collection duplicates saved poems')
        if not page.next:
            break
        target = urlsplit(page.next)
        if target.scheme or target.netloc or target.path != '/' or not page.ids:
            raise RuntimeError('Invalid restored collection pagination')
        path = target.path + ('?' + target.query if target.query else '')
        status, body = fetch(path)
        if status != 200:
            raise RuntimeError('Restored collection page unavailable')
    if found != expected_ids:
        raise RuntimeError('Restored collection is missing or reordering saved poems')
    return checked


def smoke_restore(root):
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    runtime = root / "runtime"
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "NODE_ENV": "production",
           "POETIO_PORT": str(port), "POETIO_BUILD_DIR": str(runtime / "dist"),
           "POETIO_DATA_DIR": str(root / "data"), "VINEXT_TRUSTED_HOSTS": "127.0.0.1,localhost"}
    # No live environment/secrets are inherited and no mutation requests are sent.
    with tempfile.TemporaryFile() as log:
        process = subprocess.Popen(["node", "scripts/start-vps.mjs"], cwd=runtime, env=env, stdout=log, stderr=log)
        try:
            base = f"http://127.0.0.1:{port}"
            def fetch(path):
                try:
                    with urllib.request.urlopen(base + path, timeout=15) as response:
                        return response.status, response.read()
                except urllib.error.HTTPError as error:
                    return error.code, error.read()
            for attempt in range(80):
                if process.poll() is not None:
                    raise RuntimeError("Restored runtime exited during startup")
                try:
                    status, body = fetch("/")
                    if status == 200 and b"Poetio" in body:
                        break
                except (OSError, urllib.error.URLError):
                    pass
                time.sleep(0.25)
            else:
                raise RuntimeError("Restored application did not become healthy")
            with read_db(root / "data/poetio.sqlite3") as db:
                expected_ids = {path: [row[0] for row in db.execute(f"SELECT id FROM {table} ORDER BY created_at, id")]
                                for path, table in [("/", "poems"), ("/video", "videos"), ("/carti", "books")]}
            checked = check_poem_collection(fetch, expected_ids['/'], body)
            for path in ["/autor", "/video", "/carti"]:
                status, body = fetch(path)
                if status != 200 or b"Poetio" not in body:
                    raise RuntimeError("Restored page check failed: " + path)
                if any(identifier.encode() not in body for identifier in expected_ids.get(path, [])):
                    raise RuntimeError("Restored collection is missing saved entries: " + path)
                checked.append(path)
            if fetch("/api/poems")[0] != 401:
                raise RuntimeError("Restored API unexpectedly allows anonymous administration")
            with read_db(root / "data/poetio.sqlite3") as db:
                book = db.execute("SELECT id, file_id FROM books LIMIT 1").fetchone()
            if book:
                for path in [f"/carti/{book[0]}", f"/api/book-pages/{book[1]}", f"/api/book-pages/{book[1]}/1"]:
                    if fetch(path)[0] != 200:
                        raise RuntimeError("Restored book reader check failed")
                    checked.append(path)
                if fetch(f"/api/book-files/{book[1]}")[0] != 404:
                    raise RuntimeError("Restored original PDF unexpectedly public")
            return checked
        finally:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def gpg(key, *arguments):
    if key.is_symlink() or not key.is_file() or key.stat().st_mode & 0o077:
        raise RuntimeError("Encryption key must be a private regular file (0600)")
    if key.stat().st_size < 32:
        raise RuntimeError("Encryption key is too short")
    with tempfile.TemporaryDirectory(prefix="poetio-gpg-") as home:
        try:
            subprocess.run(["gpg", "--homedir", home, "--batch", "--yes", "--no-symkey-cache",
                            "--pinentry-mode", "loopback", "--passphrase-file", str(key), *map(str, arguments)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        finally:
            subprocess.run(["gpgconf", "--homedir", home, "--kill", "gpg-agent"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def restore_archive(archive, key, destination):
    if destination.exists():
        raise RuntimeError("Restore destination must not already exist")
    destination.mkdir(mode=0o700, parents=True)
    with tempfile.TemporaryDirectory(prefix="decrypt-", dir=destination.parent) as temporary:
        plaintext = Path(temporary) / "payload.tar.gz"
        gpg(key, "--output", plaintext, "--decrypt", archive)
        with tarfile.open(plaintext, "r:gz") as tar:
            tar.extractall(destination, filter="data")
    manifest = verify_payload(destination)
    # Data extraction deliberately removes executable bits. Restore only files
    # recorded as executable in the authenticated manifest (e.g. native helpers).
    for relative in manifest.get("executables", []):
        path = destination / relative
        if relative not in manifest["files"] or path.is_symlink() or not path.resolve().is_relative_to(destination.resolve()):
            raise RuntimeError("Invalid executable entry")
        path.chmod(0o700)
    return manifest


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def create_backup(args):
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (output / ".lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        archive = output / f"poetio-{stamp}.tar.gz.gpg"
        if archive.exists():
            raise RuntimeError("Backup already exists for this timestamp")
        with tempfile.TemporaryDirectory(prefix=".backup-", dir=output) as temp:
            temporary = Path(temp)
            payload = temporary / "payload"
            payload.mkdir()
            counts = snapshot_data(args.data_dir, payload / "data")
            shutil.copytree(args.runtime_dir.resolve(), payload / "runtime", symlinks=True,
                            ignore=shutil.ignore_patterns(".git", ".wrangler", ".sites-runtime", "*.tsbuildinfo", "__pycache__"))
            shutil.copytree(args.source_dir, payload / "source", symlinks=True,
                            ignore=shutil.ignore_patterns(*EXCLUDES, "*.tsbuildinfo"))
            copy_configuration(payload / "config", args.config_dir)
            manifest = {"format": 1, "created_utc": stamp, "runtime": str(args.runtime_dir.resolve()),
                        "tables": counts, "files": file_manifest(payload),
                        "executables": [str(p.relative_to(payload)) for p in payload.rglob("*")
                                        if p.is_file() and not p.is_symlink() and p.stat().st_mode & 0o111]}
            write_json(payload / "manifest.json", manifest)
            plaintext = temporary / "payload.tar.gz"
            with tarfile.open(plaintext, "w:gz", compresslevel=3) as tar:
                for child in sorted(payload.iterdir()):
                    tar.add(child, arcname=child.name)
            encrypted = temporary / archive.name
            gpg(args.key_file, "--cipher-algo", "AES256", "--compress-algo", "none", "--output", encrypted, "--symmetric", plaintext)
            restored = temporary / "restored"
            restore_archive(encrypted, args.key_file, restored)
            checked = smoke_restore(restored)
            checksum = digest(encrypted)
            result = {"ok": True, "created_utc": stamp, "archive": archive.name, "sha256": checksum,
                      "bytes": encrypted.stat().st_size, "tables": counts, "restore_http_checks": checked}
            # Publish only after decryption, manifest, DB, media and HTTP checks pass.
            encrypted.replace(archive)
            archive.with_name(archive.name + ".sha256").write_text(checksum + "  " + archive.name + "\n")
            write_json(archive.with_name(archive.name + ".verified.json"), result)
            write_json(output / "last-success.json", result)
            for old in sorted(output.glob("poetio-????????T??????Z.tar.gz.gpg"), reverse=True)[args.keep:]:
                # Remove only this tool's successfully verified archives.
                marker = old.with_name(old.name + ".verified.json")
                if marker.is_file() and json.loads(marker.read_text()).get("ok") is True:
                    old.unlink()
                    old.with_name(old.name + ".sha256").unlink(missing_ok=True)
                    marker.unlink()
            return result


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["create", "verify"])
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--restore-dir", type=Path)
    parser.add_argument("--data-dir", type=Path, default=Path("/var/lib/poetio"))
    parser.add_argument("--source-dir", type=Path, default=Path("/var/www/Poetio/sursa"))
    parser.add_argument("--runtime-dir", type=Path, default=Path("/var/www/Poetio/current"))
    parser.add_argument("--config-dir", type=Path, default=Path("/etc/poetio"))
    parser.add_argument("--key-file", type=Path, default=Path("/etc/poetio/backup.key"))
    parser.add_argument("--output-dir", type=Path, default=Path("/var/backups/poetio/automatic"))
    parser.add_argument("--keep", type=int, default=14)
    args = parser.parse_args()
    if args.keep < 1:
        parser.error("--keep must be positive")
    if args.command == "create":
        result = create_backup(args)
    else:
        if not args.archive or not args.restore_dir:
            parser.error("verify requires --archive and a new --restore-dir")
        manifest = restore_archive(args.archive, args.key_file, args.restore_dir)
        checked = smoke_restore(args.restore_dir)
        result = {"ok": True, "tables": manifest["tables"], "restore_http_checks": checked, "restore_dir": str(args.restore_dir)}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
