import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyVpsAssets } from '../scripts/verify-vps-assets.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'poetio-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, value) => { mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), value); };
  const js = '/_next/static/chunks/index-12345678.js', css = '/_next/static/css/video.12345678.css';
  put('client' + js, 'export {};'); put('client' + css, 'body {}');
  put('client/.vite/manifest.json', JSON.stringify({ entry: { file: js.slice(1), css: [css.slice(1)] }, stylesheet: { file: css.slice(1) } }));
  const manifest = { clientEntryUrl: js, clientEntryDeps: { js: [js], css: [] }, clientReferenceDeps: { book: { js: [js, '/_next/static/chunks/video-12345678.js'], css: [css] } }, serverResources: {} };
  const files = ['server/__vite_rsc_assets_manifest.js', 'server/ssr/__vite_rsc_assets_manifest.js'];
  const save = () => files.forEach(file => put(file, 'export default ' + JSON.stringify(manifest)));
  save();
  return { root, manifest, files, save };
}

test('CSS-only preloads are removed while stylesheet and executable dependencies remain', t => {
  const { root, files } = fixture(t);
  assert.deepEqual(verifyVpsAssets(root), ['/_next/static/chunks/video-12345678.js']);
  for (const file of files) {
    const result = JSON.parse(readFileSync(join(root, file), 'utf8').replace(/^export default /, ''));
    assert.deepEqual(result.clientReferenceDeps.book.js, ['/_next/static/chunks/index-12345678.js']);
    assert.deepEqual(result.clientReferenceDeps.book.css, ['/_next/static/css/video.12345678.css']);
  }
  assert.deepEqual(verifyVpsAssets(root), []);
});

test('a missing executable dependency fails before either manifest is changed', t => {
  const { root, manifest, files, save } = fixture(t);
  manifest.clientReferenceDeps.book.js.push('/_next/static/chunks/editor-12345678.js'); save();
  const before = files.map(file => readFileSync(join(root, file), 'utf8'));
  assert.throws(() => verifyVpsAssets(root), /Missing JavaScript/);
  assert.deepEqual(files.map(file => readFileSync(join(root, file), 'utf8')), before);
});

test('a file required by the final Vite manifest cannot be silently removed', t => {
  const { root } = fixture(t);
  rmSync(join(root, 'client/_next/static/chunks/index-12345678.js'));
  assert.throws(() => verifyVpsAssets(root), /Missing final Vite asset/);
});
