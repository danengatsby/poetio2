#!/usr/bin/env python3
"""Install a build that CI tested, with a preview, a database snapshot and automatic fallback.

    sudo python3 deploy/release.py prepare --name <short-name> [--commit <ref>] [--artifact <file.tar.gz>]
    sudo python3 deploy/release.py activate [--release <release directory name>]
    sudo python3 deploy/release.py rollback
    sudo python3 deploy/release.py status

prepare   Takes the build CI attached to the pre-release build-<commit> (or a local
          --artifact made by scripts/package-build.mjs), checks it against the commit,
          assembles a release directory, migrates a private copy of the data and starts
          that copy as the service user on a spare port. Production is not touched.
activate  Checks the last backup, stops the service, snapshots the database, applies
          pending migrations, switches `current` and starts the service. A failed check
          switches back by itself.
rollback  Switches `current` back to the release that was active before the last
          activation. Migrations are additive, so the database stays as it is.
status    Shows the active release, the service, pending migrations and the last backup.

Evidence for each release goes to /var/www/Poetio/publicari/<release>/.

Without root, POETIO_RELEASE_BASE and POETIO_RELEASE_DATA must point elsewhere; commands
then run as the current user and `activate`/`rollback` are refused. This is how the
script is tested away from production.
"""
import argparse
import datetime as dt
import grp
import hashlib
import html
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import unicodedata
import urllib.parse
import urllib.request

SOURCE = Path(__file__).resolve().parents[1]
BASE = Path(os.environ.get('POETIO_RELEASE_BASE', '/var/www/Poetio'))
DATA = Path(os.environ.get('POETIO_RELEASE_DATA', '/var/lib/poetio'))
RELEASES, CURRENT, RECORDS = BASE / 'releases', BASE / 'current', BASE / 'publicari'
BACKUPS = Path('/var/backups/poetio')
SERVICE, SERVICE_USER, LIVE_PORT = 'poetio.service', 'poetio', 4106
PREVIEW_PORT = int(os.environ.get('POETIO_PREVIEW_PORT', '4203'))
PUBLIC_ORIGIN = 'https://poetio.cloud'
NODE = os.environ.get('POETIO_NODE') or ('/usr/local/bin/node' if Path('/usr/local/bin/node').exists() else shutil.which('node'))
ROOT = os.geteuid() == 0
# Tables a migration may legitimately rebuild or add rows to (markers in collection_meta).
DERIVED_TABLE = re.compile(r'^(schema_migrations$|collection_meta$|sqlite_|.*_search($|_)|.*_fts($|_))')


# ---- helpers -------------------------------------------------------------------------

def as_user(user, command):
    command = [str(part) for part in command]
    return ['runuser', '-u', user, '--', *command] if user and ROOT else command


def run(*command, user=None, text=True, **options):
    command = as_user(user, command)
    try:
        return subprocess.run(command, check=True, text=text, capture_output=True, **options)
    except subprocess.CalledProcessError as error:
        output = error.stderr if text else error.stderr.decode(errors='replace')
        raise SystemExit(f'{" ".join(command)} failed:\n{output.strip()[-2000:]}') from error


def source_owner():
    info = SOURCE.stat()
    return info.st_uid, info.st_gid


def git_command(*args):
    # As the repository's owner: git refuses a repository that another user owns.
    return as_user(pwd.getpwuid(source_owner()[0]).pw_name, ['git', '-C', SOURCE, *args])


def git(*args):
    return run(*git_command(*args)).stdout.strip()


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    with open(path, 'rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def record(directory, name, value):
    path = directory / name
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    os.chown(path, *source_owner())
    return value


def records_for(release_name):
    directory = RECORDS / release_name
    directory.mkdir(parents=True, exist_ok=True, mode=0o750)
    os.chown(RECORDS, *source_owner())
    os.chown(directory, *source_owner())
    return directory


def github_slug(remote):
    match = re.match(r'^(?:https://github\.com/|git@github\.com:)([\w.-]+/[\w.-]+?)(?:\.git)?/?$', remote)
    if not match:
        raise SystemExit(f'origin is not a GitHub repository: {remote}')
    return match.group(1)


def download(url, destination, timeout=60):
    request = urllib.request.Request(url, headers={'User-Agent': 'poetio-release'})
    with urllib.request.urlopen(request, timeout=timeout) as response, open(destination, 'wb') as output:
        shutil.copyfileobj(response, output)


DIRECT = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def fetch(url, timeout=10, headers=None):
    """GET without any proxy from the environment: health checks target this machine."""
    request = urllib.request.Request(url, headers={'User-Agent': 'poetio-release', **(headers or {})})
    with DIRECT.open(request, timeout=timeout) as response:
        return response.status, response.headers, response.read()


def strip_marks(text):
    return ''.join(char for char in unicodedata.normalize('NFD', text) if not unicodedata.combining(char))


# ---- artifact and dependencies -------------------------------------------------------

def verify_artifact(archive, checksum_line, commit, package_lock, destination):
    """Extract a package-build archive into destination after checking it belongs to commit."""
    expected = checksum_line.split()[0] if checksum_line.strip() else ''
    if sha256_file(archive) != expected:
        raise SystemExit('The build archive does not match its .sha256 file.')
    with tarfile.open(archive) as bundle:
        for member in bundle.getmembers():
            name = member.name
            if not (name == 'build-info.json' or name == 'dist' or name.startswith('dist/')) or '..' in Path(name).parts:
                raise SystemExit(f'Unexpected entry in the build archive: {name}')
            if not (member.isfile() or member.isdir()):
                raise SystemExit(f'The build archive may hold only files and folders: {name}')
        bundle.extractall(destination, filter='data')
    info = json.loads((destination / 'build-info.json').read_text())
    if info.get('commit') != commit:
        raise SystemExit(f'The build is of {info.get("commit")}, not {commit}.')
    if info.get('package_lock_sha256') != sha256_bytes(package_lock):
        raise SystemExit('The build used a different package-lock.json than the commit.')
    dist = destination / 'dist'
    found = {str(path.relative_to(dist)): sha256_file(path) for path in dist.rglob('*') if path.is_file()}
    if found != info.get('files'):
        raise SystemExit('The files in dist/ differ from the list in build-info.json.')
    return info


def check_installed_tree(node_modules, package_lock):
    """Whether node_modules holds exactly the packages package-lock.json describes."""
    wanted = {key: entry for key, entry in json.loads(package_lock)['packages'].items() if key}
    hidden_file = node_modules / '.package-lock.json'
    if not hidden_file.exists():
        return ['node_modules/.package-lock.json is missing; run npm ci']
    installed = json.loads(hidden_file.read_text())['packages']
    problems = []
    for key, entry in wanted.items():
        found = installed.get(key)
        if found is None:
            if not entry.get('optional'):
                problems.append('missing ' + key)
        elif (found.get('version'), found.get('integrity')) != (entry.get('version'), entry.get('integrity')):
            problems.append('different ' + key)
    problems += ['not in package-lock.json ' + key for key in installed if key not in wanted]
    for key, entry in installed.items():
        manifest = node_modules.parent / key / 'package.json'
        if entry.get('link'):
            continue
        if not manifest.exists() or json.loads(manifest.read_text()).get('version') != entry.get('version'):
            problems.append('not on disk as recorded ' + key)
    return problems[:20]


def install_dependencies(release, package_lock):
    current_lock = CURRENT / 'package-lock.json'
    if current_lock.exists() and current_lock.read_bytes() == package_lock and (CURRENT / 'node_modules').is_dir():
        # Same lockfile: share the running release's files. Never chown or chmod these.
        run('cp', '-al', CURRENT.resolve() / 'node_modules', release / 'node_modules')
        return {'mode': 'hard links', 'from': str(CURRENT.resolve())}
    problems = check_installed_tree(SOURCE / 'node_modules', package_lock)
    if problems:
        raise SystemExit('The lockfile changed and sursa/node_modules does not match it:\n  ' + '\n  '.join(problems))
    shutil.copytree(SOURCE / 'node_modules', release / 'node_modules', symlinks=True)
    return {'mode': 'copy', 'from': str(SOURCE / 'node_modules')}


def set_permissions(release, linked_dependencies):
    group = grp.getgrnam(SERVICE_USER).gr_gid if ROOT else os.getegid()
    owner = 0 if ROOT else os.geteuid()
    for path in [release, *release.rglob('*')]:
        if linked_dependencies and (release / 'node_modules') in [path, *path.parents]:
            continue
        if path.is_symlink():
            os.lchown(path, owner, group)
        else:
            os.chown(path, owner, group)
            path.chmod(0o750 if path.is_dir() or path.stat().st_mode & 0o111 else 0o640)


# ---- data, migrations and health -----------------------------------------------------

def connect(database):
    return sqlite3.connect(f'file:{database}?mode=ro', uri=True)


def row_counts(database):
    with connect(database) as db:
        tables = [name for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'") if not DERIVED_TABLE.match(name)]
        return {table: db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in sorted(tables)}


def migrate(release, database):
    status = json.loads(run(NODE, 'scripts/migrate.mjs', 'status', database, user=SERVICE_USER, cwd=release).stdout)
    before = row_counts(database)
    applied = json.loads(run(NODE, 'scripts/migrate.mjs', 'apply', database, user=SERVICE_USER, cwd=release).stdout)
    after = row_counts(database)
    changed = {table: (count, after.get(table)) for table, count in before.items() if after.get(table) != count}
    if changed:
        raise SystemExit(f'Rows changed during migration: {changed}')
    return {'before': status, 'result': applied, 'row_counts': before}


def expected(database):
    """What a healthy instance must show, read from its database."""
    with connect(database) as db:
        count = lambda table: db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
        first = lambda sql: db.execute(sql).fetchone()
        poem = first('SELECT id, title, image_id FROM poems ORDER BY created_at LIMIT 1')
        video = first('SELECT id, file_id FROM videos ORDER BY created_at LIMIT 1')
        book = first('SELECT id FROM books ORDER BY created_at LIMIT 1')
        videos = [row[0] for row in db.execute('SELECT id FROM videos')]
        return {
            'urls': 4 + count('poems') + count('videos') + count('books'),
            'poem': poem and {'id': poem[0], 'title': poem[1], 'image': poem[2]},
            'video': video and {'id': video[0], 'file': video[1]},
            'videos': videos,
            'book': book and book[0],
        }


def check_site(base, want):
    """Raises AssertionError describing the first thing that is wrong."""
    status, _, body = fetch(base + '/')
    assert status == 200 and b'<html lang="ro"' in body, 'home page'
    status, _, body = fetch(base + '/sitemap.xml')
    # One address without a language parameter per page; language versions follow it.
    pages = len(re.findall(rb'<loc>[^<?]*</loc>', body))
    assert status == 200 and pages == want['urls'], f'sitemap has {pages} pages'
    for path in ('/autor', '/carti', '/video'):
        assert fetch(base + path)[0] == 200, path
    if want['poem']:
        poem = want['poem']
        status, _, body = fetch(base + '/poeme/' + poem['id'])
        assert status == 200 and (poem['title'].encode() in body or html.escape(poem['title']).encode() in body), 'poem page'
        found = []
        for term in (poem['title'], unicodedata.normalize('NFD', poem['title']), strip_marks(poem['title'])):
            status, _, page = fetch(base + '/?' + urllib.parse.urlencode({'q': term}))
            assert status == 200, 'collection search'
            found.append(sorted(set(re.findall(rb'data-poem-id="([^"]+)"', page))))
        assert found[0] and found[0] == found[1] == found[2], 'search differs between composed, decomposed and unaccented text'
        if poem['image']:
            status, _, image = fetch(base + f'/api/images/{poem["image"]}?w=640', timeout=40)
            assert status == 200 and image[:4] == b'RIFF' and image[8:12] == b'WEBP', 'resized poem image'
    if want['video']:
        status, headers, poster = fetch(base + '/api/video-posters/' + want['video']['file'], timeout=40)
        assert status == 200 and headers.get('Content-Type') == 'image/jpeg' and poster[:3] == b'\xff\xd8\xff', 'video poster'
        for video in want['videos']:
            status, _, page = fetch(base + '/video/' + video)
            assert status == 200, 'video page ' + video
            for track in re.findall(rb'<track[^>]*\ssrc="([^"]+)"', page):
                status, _, captions = fetch(base + html.unescape(track.decode()))
                assert status == 200 and captions.startswith(b'WEBVTT'), 'captions ' + track.decode()
    if want['book']:
        assert fetch(base + '/carti/' + want['book'])[0] == 200, 'book page'


def healthy(base, want, attempts=60):
    for attempt in range(attempts):
        try:
            check_site(base, want)
            return True, None
        except Exception as error:  # the server may still be starting
            problem = f'{type(error).__name__}: {error}'[:300]
            time.sleep(0.25 if attempt < attempts - 1 else 0)
    return False, problem


def switch(target):
    temporary = CURRENT.with_name('current-next')
    if temporary.is_symlink() or temporary.exists():
        temporary.unlink()
    temporary.symlink_to(target, target_is_directory=True)
    os.replace(temporary, CURRENT)


def systemctl(*args):
    return subprocess.run(['systemctl', *args], check=True, text=True, capture_output=True).stdout.strip()


def copy_data(destination):
    needed = sum(path.stat().st_size for path in DATA.rglob('*') if path.is_file())
    if shutil.disk_usage(destination.parent).free < needed * 1.2 + 3 * 1024**3:
        raise SystemExit(f'Not enough free space for a {needed / 1024**3:.1f} GiB preview copy plus 3 GiB.')
    destination.mkdir(mode=0o700)
    with connect(DATA / 'poetio.sqlite3') as live, sqlite3.connect(destination / 'poetio.sqlite3') as copy:
        live.backup(copy)
    for folder in ('images', 'audio', 'videos', 'books'):
        if (DATA / folder).is_dir():
            shutil.copytree(DATA / folder, destination / folder)
        else:
            (destination / folder).mkdir()
    if ROOT:
        run('chown', '-R', f'{SERVICE_USER}:{SERVICE_USER}', destination)


# ---- commands ------------------------------------------------------------------------

def prepare(arguments):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,39}', arguments.name):
        raise SystemExit('--name: 3-40 lowercase letters, digits and hyphens.')
    if not arguments.artifact:
        git('fetch', '--quiet', 'origin')
    commit = git('rev-parse', '--verify', arguments.commit + '^{commit}')
    package_lock = run(*git_command('show', f'{commit}:package-lock.json'), text=False).stdout
    name = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + arguments.name
    evidence = records_for(name)
    release = RELEASES / name
    previous = CURRENT.resolve()
    preview_data = Path(tempfile.mkdtemp(prefix=f'poetio-preview-{name}-', dir=DATA.parent)) / 'data'
    if ROOT:
        os.chmod(preview_data.parent, 0o711)

    if arguments.artifact:
        archive = Path(arguments.artifact).resolve()
        checksum = Path(str(archive) + '.sha256').read_text()
        origin = {'artifact': str(archive), 'tested_by_ci': False}
    else:
        slug = github_slug(git('remote', 'get-url', 'origin'))
        if subprocess.run(git_command('merge-base', '--is-ancestor', commit, 'origin/main')).returncode:
            raise SystemExit(f'{commit} is not on origin/main; CI publishes builds only for main.')
        url = f'https://github.com/{slug}/releases/download/build-{commit}/poetio-build-{commit}.tar.gz'
        archive = evidence / f'poetio-build-{commit}.tar.gz'
        try:
            download(url, archive)
            download(url + '.sha256', evidence / (archive.name + '.sha256'))
        except urllib.error.HTTPError as error:
            raise SystemExit(f'No tested build at {url} ({error.code}). Wait for CI on main, or check that it passed.')
        checksum = (evidence / (archive.name + '.sha256')).read_text()
        origin = {'artifact': url, 'tested_by_ci': True}

    server = log = None
    release.mkdir(mode=0o750)
    try:
        staging = Path(tempfile.mkdtemp(prefix='poetio-build-', dir=RELEASES))
        try:
            info = verify_artifact(archive, checksum, commit, package_lock, staging)
            with tempfile.TemporaryFile() as source_tar:
                subprocess.run(git_command('archive', '--format=tar', commit), check=True, stdout=source_tar)
                source_tar.seek(0)
                with tarfile.open(fileobj=source_tar) as bundle:
                    if bundle.pax_headers.get('comment') != commit:
                        raise SystemExit('git archive did not record the expected commit.')
                    sources = [member.name for member in bundle.getmembers() if member.isfile()]
                    bundle.extractall(release, filter='data')
            shutil.move(staging / 'dist', release / 'dist')
        finally:
            shutil.rmtree(staging, ignore_errors=True)
        dependencies = install_dependencies(release, package_lock)
        set_permissions(release, dependencies['mode'] == 'hard links')
        if ROOT:
            unreadable = run('find', release, '!', '-readable', '-print', '-quit', user=SERVICE_USER).stdout.strip()
            if unreadable:
                raise SystemExit('Not readable by the service user: ' + unreadable)
        security = run(NODE, 'scripts/verify-security-runtime.mjs', user=SERVICE_USER, cwd=release).stdout.strip()

        # A private copy of the data on a spare port; production keeps running untouched.
        copy_data(preview_data)
        migration = migrate(release, preview_data / 'poetio.sqlite3')
        again = migrate(release, preview_data / 'poetio.sqlite3')['result']
        if again != {'baseline': None, 'applied': [], 'completed': []}:
            raise SystemExit(f'A second migration run was not empty: {again}')
        record(evidence, 'migration-preview.json', migration)
        log = open(evidence / 'preview.log', 'w')
        os.chown(evidence / 'preview.log', *source_owner())
        environment = ['env', 'NODE_ENV=production', f'POETIO_DATA_DIR={preview_data}', f'POETIO_BUILD_DIR={release}/dist',
                       f'POETIO_PORT={PREVIEW_PORT}', 'VINEXT_TRUSTED_HOSTS=poetio.cloud']
        command = [*environment, NODE, str(release / 'scripts/start-vps.mjs')]
        server = subprocess.Popen(['runuser', '-u', SERVICE_USER, '--', *command] if ROOT else command,
                                  cwd=release, stdout=log, stderr=subprocess.STDOUT)
        ok, problem = healthy(f'http://127.0.0.1:{PREVIEW_PORT}', expected(preview_data / 'poetio.sqlite3'))
        record(evidence, 'preview.json', {'ok': ok, 'problem': problem, 'user': SERVICE_USER if ROOT else pwd.getpwuid(os.geteuid()).pw_name})
        if not ok:
            raise SystemExit(f'The preview did not pass its checks: {problem}. See {evidence / "preview.log"}.')
    except BaseException:
        shutil.rmtree(release, ignore_errors=True)
        raise
    finally:
        if server:
            server.terminate()
            try:
                server.wait(10)
            except subprocess.TimeoutExpired:
                server.kill()
        if log:
            log.close()
        shutil.rmtree(preview_data.parent, ignore_errors=True)

    record(evidence, 'build-manifest.json', info['files'])
    record(evidence, 'source-manifest.json', {name: sha256_file(release / name) for name in sources})
    result = record(evidence, 'release.json', {
        'release': str(release), 'previous_release': str(previous), 'commit': commit, 'prepared_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        **origin, 'built_with': {key: info[key] for key in ('node', 'npm', 'built_at')}, 'dependencies': dependencies,
        'security': security, 'source_files': len(sources), 'build_files': len(info['files']),
    })
    print(json.dumps({'prepared': name, 'commit': commit, 'tested_by_ci': origin['tested_by_ci'], 'evidence': str(evidence)}))
    return result


def verify_release(release, evidence):
    for name, digest in json.loads((evidence / 'source-manifest.json').read_text()).items():
        if sha256_file(release / name) != digest:
            raise SystemExit(f'{name} changed since prepare.')
    for name, digest in json.loads((evidence / 'build-manifest.json').read_text()).items():
        if sha256_file(release / 'dist' / name) != digest:
            raise SystemExit(f'dist/{name} changed since prepare.')


def require_production():
    if not ROOT or BASE != Path('/var/www/Poetio') or DATA != Path('/var/lib/poetio'):
        raise SystemExit('activate and rollback run only as root on the production paths.')


def activate(arguments):
    require_production()
    prepared = sorted(path.name for path in RECORDS.glob('*') if (path / 'release.json').exists() and not (path / 'activation.json').exists())
    name = arguments.release or (prepared[-1] if prepared else None)
    if not name:
        raise SystemExit('No prepared release waiting for activation.')
    evidence = RECORDS / name
    info = json.loads((evidence / 'release.json').read_text())
    release, previous = Path(info['release']), CURRENT.resolve()
    if str(previous) != info['previous_release'] or release == previous or not release.is_dir():
        raise SystemExit(f'Prepared against {info["previous_release"]}, but {previous} is active. Prepare again.')
    if not json.loads((evidence / 'preview.json').read_text())['ok']:
        raise SystemExit('The preview of this release failed.')
    verify_release(release, evidence)
    if systemctl('show', 'poetio-backup.service', '-p', 'ActiveState', '--value') in ('active', 'activating', 'deactivating'):
        raise SystemExit('A backup is running; try again when it has finished.')
    backup = json.loads((BACKUPS / 'automatic' / 'last-success.json').read_text())
    if not (backup.get('ok') and backup.get('restore_http_checks') and (BACKUPS / 'automatic' / backup['archive']).is_file()):
        raise SystemExit('The last automatic backup is not verified; check poetio-backup.service first.')
    want = expected(DATA / 'poetio.sqlite3')

    started = time.monotonic()
    systemctl('stop', SERVICE)
    try:
        snapshot_dir = BACKUPS / ('before-' + name)
        snapshot_dir.mkdir(mode=0o700)
        snapshot = snapshot_dir / 'poetio.sqlite3'
        with connect(DATA / 'poetio.sqlite3') as live, sqlite3.connect(snapshot) as copy:
            live.backup(copy)
            if copy.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise SystemExit('The database snapshot failed its integrity check.')
        snapshot.chmod(0o600)
        record(evidence, 'migration.json', {**migrate(release, DATA / 'poetio.sqlite3'), 'snapshot': str(snapshot)})
        switch(release)
        systemctl('start', SERVICE)
        ok, problem = healthy(f'http://127.0.0.1:{LIVE_PORT}', want)
        if not ok:
            raise SystemExit(f'The new release is not healthy: {problem}')
        downtime = round(time.monotonic() - started, 2)
        # nginx reloads gradually and connections settle; poll before judging.
        public = None
        for _ in range(40):
            try:
                status, _, body = fetch(f'{PUBLIC_ORIGIN}/poeme/{want["poem"]["id"]}' if want['poem'] else PUBLIC_ORIGIN + '/', timeout=20)
                public = status
                if status == 200:
                    break
            except Exception as error:
                public = repr(error)[:200]
            time.sleep(0.25)
        if public != 200:
            raise SystemExit(f'The public site did not answer as expected: {public}')
        if want['video']:
            # Films go through nginx (X-Accel-Redirect): a range must come back with its length.
            status, headers, body = fetch(f'{PUBLIC_ORIGIN}/api/video-files/{want["video"]["file"]}', timeout=20,
                                          headers={'Range': 'bytes=0-99'})
            if (status, headers.get('Content-Length'), len(body)) != (206, '100', 100):
                raise SystemExit(f'A film range came back as {status} with Content-Length {headers.get("Content-Length")}.')
    except BaseException:
        switch(previous)
        subprocess.run(['systemctl', 'restart', SERVICE], check=True)
        print(f'ROLLED BACK to {previous}. The database snapshot is in {BACKUPS / ("before-" + name)}.', file=sys.stderr)
        raise
    result = record(evidence, 'activation.json', {
        'ok': True, 'release': str(release), 'previous_release': str(previous), 'commit': info['commit'],
        'stop_to_health_seconds': downtime, 'activated_at': dt.datetime.now(dt.timezone.utc).isoformat(),
    })
    print(json.dumps(result))


def rollback(arguments):
    require_production()
    active = CURRENT.resolve()
    activation = RECORDS / active.name / 'activation.json'
    if not activation.exists():
        raise SystemExit(f'No activation record for {active.name}; switch manually if needed.')
    previous = Path(json.loads(activation.read_text())['previous_release'])
    if not previous.is_dir():
        raise SystemExit(f'{previous} no longer exists.')
    want = expected(DATA / 'poetio.sqlite3')
    switch(previous)
    systemctl('restart', SERVICE)
    ok, problem = healthy(f'http://127.0.0.1:{LIVE_PORT}', want)
    record(RECORDS / active.name, 'rollback.json', {'ok': ok, 'problem': problem, 'from': str(active), 'to': str(previous),
                                                     'at': dt.datetime.now(dt.timezone.utc).isoformat()})
    if not ok:
        raise SystemExit(f'{previous} is active again but not healthy: {problem}')
    print(json.dumps({'rolled_back_to': str(previous)}))


def status(arguments):
    active = CURRENT.resolve()
    info = RECORDS / active.name / 'release.json'
    report = {
        'current': active.name,
        'commit': json.loads(info.read_text())['commit'] if info.exists() else None,
        'service': systemctl('show', SERVICE, '-p', 'ActiveState', '--value') if ROOT else None,
        'migrations': json.loads(run(NODE, 'scripts/migrate.mjs', 'status', DATA / 'poetio.sqlite3', user=SERVICE_USER, cwd=active).stdout)
        if (active / 'scripts/migrate.mjs').exists() else 'this release predates scripts/migrate.mjs',
    }
    last = BACKUPS / 'automatic' / 'last-success.json'
    if ROOT and last.exists():
        backup = json.loads(last.read_text())
        report['last_backup'] = {key: backup.get(key) for key in ('created_utc', 'archive', 'ok', 'restore_http_checks')}
    print(json.dumps(report, indent=2, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    commands = parser.add_subparsers(dest='command', required=True)
    p = commands.add_parser('prepare')
    p.add_argument('--name', required=True)
    p.add_argument('--commit', default='origin/main')
    p.add_argument('--artifact', help='a poetio-build-<commit>.tar.gz made by scripts/package-build.mjs')
    a = commands.add_parser('activate')
    a.add_argument('--release')
    commands.add_parser('rollback')
    commands.add_parser('status')
    arguments = parser.parse_args()
    if not ROOT and (BASE == Path('/var/www/Poetio') or DATA == Path('/var/lib/poetio')) and arguments.command != 'status':
        raise SystemExit('Run with sudo, or set POETIO_RELEASE_BASE and POETIO_RELEASE_DATA for a test run.')
    {'prepare': prepare, 'activate': activate, 'rollback': rollback, 'status': status}[arguments.command](arguments)


if __name__ == '__main__':
    main()
