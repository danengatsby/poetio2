#!/usr/bin/env python3
"""Publish a minimal, read-only backup status for the Poetio web process."""
import datetime as dt
import grp
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


def collect(backup_dir, show, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    result = {"sampledAt": now.isoformat(), "backup": None, "lastAttempt": "unknown", "scheduled": None}
    try:
        path = backup_dir / "last-success.json"
        if path.stat().st_size > 65536:
            raise ValueError("Invalid status size")
        saved = json.loads(path.read_text())
        archive = saved.get("archive", "")
        if saved.get("ok") is not True or not re.fullmatch(r"poetio-\d{8}T\d{6}Z\.tar\.gz\.gpg", archive):
            raise ValueError("Invalid archive")
        created = dt.datetime.strptime(saved["created_utc"], "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc)
        if type(saved.get("bytes")) is not int or saved["bytes"] <= 0 or (backup_dir / archive).stat().st_size != saved["bytes"]:
            raise ValueError("Archive unavailable")
        if not isinstance(saved.get("restore_http_checks"), list) or not {"/", "/autor", "/video", "/carti"}.issubset(saved["restore_http_checks"]):
            raise ValueError("Restore not verified")
        result["backup"] = {"verified": True, "createdAt": created.isoformat(), "archive": archive, "bytes": saved["bytes"]}
    except (OSError, ValueError, TypeError, KeyError):
        pass
    try:
        service = show("poetio-backup.service", ["ActiveState", "Result", "ExecMainStartTimestamp"])
        if service.get("ActiveState") in ("active", "activating"):
            result["lastAttempt"] = "running"
        elif service.get("Result") and service["Result"] != "success":
            result["lastAttempt"] = "failed"
        elif service.get("Result") == "success" and service.get("ExecMainStartTimestamp"):
            result["lastAttempt"] = "success"
        timer_state = show("poetio-backup.timer", ["ActiveState"]).get("ActiveState")
        result["scheduled"] = timer_state == "active" if timer_state in ("active", "inactive", "failed", "activating", "deactivating") else None
    except (OSError, subprocess.SubprocessError):
        pass
    return result


def systemd_show(unit, properties):
    output = subprocess.run(["systemctl", "show", unit, *["--property=" + key for key in properties]], check=True, capture_output=True, text=True, timeout=5).stdout
    return dict(line.split("=", 1) for line in output.splitlines() if "=" in line)


def main():
    os.umask(0o077)
    target = Path("/run/poetio-status/status.json")
    target.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
    group = grp.getgrnam("poetio").gr_gid
    os.chown(target.parent, 0, group)
    target.parent.chmod(0o750)
    result = collect(Path("/var/backups/poetio/automatic"), systemd_show)
    fd, name = tempfile.mkstemp(dir=target.parent)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump(result, output)
            output.write("\n")
        os.chown(name, 0, group)
        os.chmod(name, 0o640)
        os.replace(name, target)
    finally:
        Path(name).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
