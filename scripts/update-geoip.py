#!/usr/bin/env python3
"""Install the monthly DB-IP City Lite database used for visitor locations in /admin/vizite.

DB-IP publishes a new free file at the start of each month (CC BY 4.0, attribution
shown in /admin/vizite). The download goes to a temporary file next to the target,
is checked to be a MaxMind DB City file, then replaces city.mmdb atomically. The
running site notices the new file within ten minutes. Only the database is
downloaded; no visitor data leaves the server.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import urllib.error
import urllib.request

URL = "https://download.db-ip.com/free/dbip-city-lite-{month}.mmdb.gz"
MARKER = bytes.fromhex("abcdef4d61784d696e642e636f6d")  # "\xab\xcd\xefMaxMind.com"
MIN_BYTES = 20_000_000


def months(today):
    """This month's file, then last month's (the new one appears during the 1st)."""
    first = today.replace(day=1)
    previous = (first - dt.timedelta(days=1)).replace(day=1)
    return [first.strftime("%Y-%m"), previous.strftime("%Y-%m")]


def is_city_database(path, min_bytes):
    size = path.stat().st_size
    if size < min_bytes:
        return False
    with path.open("rb") as file:
        file.seek(max(0, size - 131072))
        tail = file.read()
    at = tail.rfind(MARKER)
    return at >= 0 and b"City" in tail[at:]


def fetch(url, target):
    request = urllib.request.Request(url, headers={"User-Agent": "poetio-geoip-update/1"})
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as out:
        shutil.copyfileobj(gzip.GzipFile(fileobj=response), out, 1 << 20)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def update(directory, today, download=fetch, min_bytes=MIN_BYTES):
    directory = Path(directory)
    directory.mkdir(mode=0o750, parents=True, exist_ok=True)
    target, state = directory / "city.mmdb", directory / "city.json"
    installed = json.loads(state.read_text()).get("month") if state.exists() and target.exists() else None
    for month in months(today):
        if installed == month:
            return {"ok": True, "month": month, "updated": False}
        fd, name = tempfile.mkstemp(dir=directory, prefix=".city-", suffix=".part")
        os.close(fd)
        part = Path(name)
        try:
            try:
                download(URL.format(month=month), part)
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    continue
                raise
            if not is_city_database(part, min_bytes):
                raise RuntimeError(f"The {month} download is not a MaxMind DB City file")
            part.chmod(0o640)
            os.replace(part, target)
            record = {"month": month, "source": URL.format(month=month), "bytes": target.stat().st_size,
                      "sha256": sha256(target), "installed_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
            fd, name = tempfile.mkstemp(dir=directory, prefix=".city-", suffix=".json")
            with os.fdopen(fd, "w") as out:
                json.dump(record, out)
            os.chmod(name, 0o640)
            os.replace(name, state)
            return {"ok": True, "updated": True, **record}
        finally:
            part.unlink(missing_ok=True)
    if installed:
        # Neither month is published yet: keep the installed file.
        return {"ok": True, "month": installed, "updated": False}
    raise RuntimeError("No DB-IP City Lite file is published for this or last month")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--directory", type=Path, default=Path("/var/lib/poetio/geoip"))
    args = parser.parse_args()
    os.umask(0o027)
    try:
        print(json.dumps(update(args.directory, dt.date.today())))
    except Exception as error:  # noqa: BLE001 - report one line to the journal and fail the unit
        print(json.dumps({"ok": False, "error": f"{type(error).__name__}: {error}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
