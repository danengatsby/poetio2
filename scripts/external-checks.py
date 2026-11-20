#!/usr/bin/env python3
"""Copy the verified backup off the server and report to an external heartbeat service.

    poetio-external offsite   daily, after the backup (poetio-offsite.timer)
    poetio-external site      every five minutes (poetio-heartbeat.timer)
    poetio-external status    the last off-site copy, as recorded on this server

Settings come from the environment; systemd reads them from /etc/poetio/external.env
(see deploy/poetio-external.env.example):

  POETIO_OFFSITE_REMOTE        rclone destination, e.g. poetio-offsite:poetio-backups/poetio
  POETIO_OFFSITE_KEEP          optional: keep only this many archives at the destination.
                               Unset, nothing is deleted there (use a lifecycle rule instead,
                               so a key on this server cannot erase the copies).
  POETIO_HEARTBEAT_BACKUP      ping URL for the daily backup and off-site copy
  POETIO_HEARTBEAT_SITE        ping URL for the site check
  POETIO_SITE_URL              default https://poetio.cloud
  POETIO_CERT_MIN_DAYS         default 14
  POETIO_BACKUP_MAX_AGE_HOURS  default 26

Heartbeat URLs follow the Healthchecks.io protocol: the URL itself reports success,
URL/fail reports a failure, and a POST body is shown in the alert. A check that stops
reporting is what makes the service send an email, so a dead server is noticed too.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

BACKUPS = Path(os.environ.get('POETIO_BACKUP_DIR', '/var/backups/poetio/automatic'))
STATE = Path(os.environ.get('STATE_DIRECTORY', '/var/lib/poetio-offsite'))
ARCHIVE = re.compile(r'^poetio-\d{8}T\d{6}Z\.tar\.gz\.gpg$')


class Problem(Exception):
    """A failure worth a clear sentence in the alert."""


def setting(name, default=None):
    value = os.environ.get(name, '').strip()
    return value or default


def ping(url, body, failed=False, attempts=3):
    """Report to the heartbeat service; a missing URL just skips reporting."""
    if not url:
        return False
    target = url.rstrip('/') + ('/fail' if failed else '')
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(target, data=body.encode()[:100_000], method='POST',
                                             headers={'User-Agent': 'poetio-external', 'Content-Type': 'text/plain; charset=utf-8'})
            with urllib.request.urlopen(request, timeout=15) as response:
                return 200 <= response.status < 300
        except Exception as error:  # report, retry, but never hide the real result
            print(f'heartbeat attempt {attempt + 1} failed: {error}', file=sys.stderr)
            time.sleep(2 ** attempt)
    return False


def rclone(*args):
    result = subprocess.run(['rclone', *args], text=True, capture_output=True)
    if result.returncode:
        raise Problem(f'rclone {args[0]} failed ({result.returncode}): {result.stderr.strip()[-1500:]}')
    return result.stdout


def sha256(path):
    with open(path, 'rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def latest_backup(now=None):
    """The newest verified archive, refused when it is too old or no longer matches its digest."""
    now = now or dt.datetime.now(dt.timezone.utc)
    marker = BACKUPS / 'last-success.json'
    if not marker.exists():
        raise Problem(f'{marker} is missing: no verified backup yet.')
    last = json.loads(marker.read_text())
    created = dt.datetime.strptime(last['created_utc'], '%Y%m%dT%H%M%SZ').replace(tzinfo=dt.timezone.utc)
    hours = (now - created).total_seconds() / 3600
    limit = float(setting('POETIO_BACKUP_MAX_AGE_HOURS', '26'))
    if not last.get('ok') or hours > limit:
        raise Problem(f'The last verified backup, {last.get("archive")}, is {hours:.0f} h old (limit {limit:.0f} h). '
                      'Check poetio-backup.service.')
    archive = BACKUPS / last['archive']
    if not ARCHIVE.match(archive.name) or not archive.is_file():
        raise Problem(f'{archive} is missing.')
    if sha256(archive) != last['sha256']:
        raise Problem(f'{archive.name} no longer matches the SHA-256 recorded when it was verified.')
    return archive, last


def offsite():
    remote = setting('POETIO_OFFSITE_REMOTE')
    if not remote:
        raise Problem('POETIO_OFFSITE_REMOTE is not set.')
    archive, last = latest_backup()
    names = [archive.name] + [archive.name + suffix for suffix in ('.sha256', '.verified.json') if (BACKUPS / (archive.name + suffix)).exists()]
    started = time.monotonic()
    with tempfile.NamedTemporaryFile('w', suffix='.txt') as listing:
        listing.write('\n'.join(names) + '\n')
        listing.flush()
        common = ['--files-from-raw', listing.name, '--retries', '5', '--low-level-retries', '20']
        # Identical files already at the destination are skipped, so a rerun is cheap.
        rclone('copy', str(BACKUPS), remote, '--no-traverse', *common)
        # Size and a hash both sides support; rclone says when no hash is common.
        rclone('check', str(BACKUPS), remote, '--one-way', *common)
    seconds = round(time.monotonic() - started)

    remote_archives = sorted(name for name in rclone('lsf', remote, '--files-only').split() if ARCHIVE.match(name))
    if archive.name not in remote_archives:
        raise Problem(f'{archive.name} is not listed at the destination after the copy.')
    removed = []
    keep = setting('POETIO_OFFSITE_KEEP')
    if keep:
        for old in remote_archives[: max(0, len(remote_archives) - int(keep))]:
            for name in (old, old + '.sha256', old + '.verified.json'):
                subprocess.run(['rclone', 'deletefile', f'{remote.rstrip("/")}/{name}'], capture_output=True)
            removed.append(old)
    result = {
        'ok': True, 'archive': archive.name, 'bytes': last['bytes'], 'sha256': last['sha256'], 'remote': remote,
        'seconds': seconds, 'remote_archives': len(remote_archives) - len(removed), 'removed': removed,
        'at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
    }
    STATE.mkdir(parents=True, exist_ok=True)
    (STATE / 'last-offsite.json').write_text(json.dumps(result, indent=2) + '\n')
    return (f'{archive.name} ({last["bytes"] / 1024**2:.0f} MiB) is at {remote} and matches the local copy; '
            f'{result["remote_archives"]} archives there.')


def certificate_days(host, port=443):
    context = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=15) as raw, context.wrap_socket(raw, server_hostname=host) as tls:
        expires = ssl.cert_time_to_seconds(tls.getpeercert()['notAfter'])
    return (expires - time.time()) / 86400


def site():
    base = setting('POETIO_SITE_URL', 'https://poetio.cloud').rstrip('/')
    started = time.monotonic()
    request = urllib.request.Request(base + '/', headers={'User-Agent': 'poetio-external'})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, body = response.status, response.read()
    except urllib.error.HTTPError as error:
        error.close()
        raise Problem(f'{base}/ did not answer: {error}')
    except Exception as error:
        raise Problem(f'{base}/ did not answer: {error}')
    elapsed = time.monotonic() - started
    if status != 200 or b'<html lang="ro"' not in body:
        raise Problem(f'{base}/ answered {status} without the expected page.')
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme == 'https':
        days = certificate_days(parsed.hostname, parsed.port or 443)
        minimum = float(setting('POETIO_CERT_MIN_DAYS', '14'))
        if days < minimum:
            raise Problem(f'The TLS certificate of {parsed.hostname} expires in {days:.0f} days; renewal is not working.')
        return f'{base}/ answered in {elapsed:.2f} s; the certificate is valid for {days:.0f} more days.'
    return f'{base}/ answered in {elapsed:.2f} s.'


def run(check, heartbeat):
    try:
        message = check()
    except Exception as error:
        message = str(error) if isinstance(error, Problem) else f'{type(error).__name__}: {error}'
        print(message, file=sys.stderr)
        ping(setting(heartbeat), message, failed=True)
        return 1
    print(message)
    ping(setting(heartbeat), message)
    return 0


def main(argv):
    command = argv[1] if len(argv) > 1 else ''
    if command == 'offsite':
        return run(offsite, 'POETIO_HEARTBEAT_BACKUP')
    if command == 'site':
        return run(site, 'POETIO_HEARTBEAT_SITE')
    if command == 'status':
        state = STATE / 'last-offsite.json'
        print(state.read_text() if state.exists() else 'No off-site copy recorded on this server yet.')
        return 0
    print(__doc__.split('\n\n')[1], file=sys.stderr)
    return 64


if __name__ == '__main__':
    sys.exit(main(sys.argv))
