// Packs a finished VPS build for deploy/release.py.
//
//   node scripts/package-build.mjs <output directory>
//
// Writes poetio-build-<commit>.tar.gz with `dist/` and `build-info.json` (commit,
// lockfile digest, toolchain and the SHA-256 of every file), plus a .sha256 file
// in the format `sha256sum -c` reads. Run it in a clean checkout after
// `npm run build:vps`.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] || 'build-out');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const sha256 = data => createHash('sha256').update(data).digest('hex');

const commit = git('rev-parse', 'HEAD');
const changed = git('status', '--porcelain', '--untracked-files=no');
if (changed) throw new Error('The checkout has uncommitted changes:\n' + changed);

const dist = join(root, 'dist');
const files = {};
(function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files[relative(dist, path)] = sha256(readFileSync(path));
    else throw new Error('Unexpected entry in dist: ' + path);
  }
})(dist);
if (!files['server/BUILD_ID']) throw new Error('dist/ is not a finished vinext build.');
const newest = Math.max(...Object.keys(files).map(file => statSync(join(dist, file)).mtimeMs));
const committed = Number(git('log', '-1', '--format=%ct')) * 1000;
if (newest < committed) throw new Error('dist/ is older than the checked-out commit; run npm run build:vps.');

const info = {
  commit,
  built_at: new Date().toISOString(),
  node: process.version,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  package_lock_sha256: sha256(readFileSync(join(root, 'package-lock.json'))),
  files,
};
const staging = mkdtempSync(join(tmpdir(), 'poetio-package-'));
try {
  writeFileSync(join(staging, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
  mkdirSync(output, { recursive: true });
  const name = `poetio-build-${commit}.tar.gz`;
  const archive = join(output, name);
  execFileSync('tar', [
    '--create',
    '--gzip',
    '--file',
    archive,
    '--sort=name',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '--directory',
    root,
    'dist',
    '--directory',
    staging,
    'build-info.json',
  ]);
  writeFileSync(archive + '.sha256', `${sha256(readFileSync(archive))}  ${name}\n`);
  console.log(JSON.stringify({ archive, commit, files: Object.keys(files).length }));
} finally {
  rmSync(staging, { recursive: true, force: true });
}
