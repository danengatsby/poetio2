#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
CHECKS = [
    ['npm', 'run', 'format:check'], ['npm', 'run', 'lint', '--', '--max-warnings=0'],
    ['./node_modules/.bin/tsc', '--noEmit', '--incremental', 'false'],
    ['npm', 'run', 'build:vps'], ['npm', 'run', 'test:vps'],
    ['node', '--test', 'tests/ui-components.test.mjs'],
    *[['npm', 'run', 'test:' + suite] for suite in ('backup', 'operations', 'release', 'external', 'e2e')],
]


def verify(output):
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

    commit = git('rev-parse', 'HEAD')
    if git('status', '--porcelain'):
        raise SystemExit('Use a clean checkout for a verified local build.')
    checks = []
    for command in CHECKS:
        start = time.monotonic()
        subprocess.run(command, cwd=ROOT, check=True)
        checks.append({'command': command, 'seconds': round(time.monotonic() - start, 2), 'exit': 0})
    if git('status', '--porcelain') or git('rev-parse', 'HEAD') != commit:
        raise SystemExit('Source changed during verification.')
    subprocess.run(['node', 'scripts/package-build.mjs', str(output)], cwd=ROOT, check=True)
    archive = output / f'poetio-build-{commit}.tar.gz'
    with archive.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    report = {'commit': commit, 'archive_sha256': digest, 'completed_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': checks}
    Path(str(archive) + '.checks.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Verify and package a local Poetio release.')
    parser.add_argument('output', type=Path)
    verify(parser.parse_args().output.resolve())
