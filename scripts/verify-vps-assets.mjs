import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// plugin-rsc collects preload dependencies before Vite removes empty CSS-only
// JavaScript chunks. Keep their stylesheets, but omit the obsolete JS preloads.
// Any missing executable chunk or stylesheet remains a build failure.
export function verifyVpsAssets(directory) {
  const root = resolve(directory);
  const client = resolve(root, 'client');
  const vite = JSON.parse(readFileSync(resolve(client, '.vite/manifest.json'), 'utf8'));
  const present = path => path.startsWith('/_next/static/') && !path.includes('..') && existsSync(resolve(client, '.' + path));
  for (const entry of Object.values(vite)) {
    for (const file of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
      if (!present('/' + file)) throw new Error(`Missing final Vite asset: ${file}`);
    }
  }
  const styles = new Set(Object.values(vite).filter(entry => entry.file.endsWith('.css')).map(entry => '/' + entry.file));
  const planned = [];
  const removed = new Set();
  for (const file of ['server/__vite_rsc_assets_manifest.js', 'server/ssr/__vite_rsc_assets_manifest.js']) {
    const target = resolve(root, file);
    const original = readFileSync(target, 'utf8');
    const match = /^export default\s+([\s\S]*?)\s*;?\s*$/.exec(original);
    if (!match) throw new Error(`Unexpected RSC assets manifest format: ${file}`);
    const manifest = JSON.parse(match[1]);
    if (!present(manifest.clientEntryUrl)) throw new Error('Missing browser entry');
    const groups = [manifest.clientEntryDeps, ...Object.values(manifest.clientReferenceDeps), ...Object.values(manifest.serverResources ?? {})];
    for (const group of groups) {
      for (const css of group.css ?? []) if (!present(css)) throw new Error(`Missing stylesheet: ${css}`);
      group.js = (group.js ?? []).filter(js => {
        if (present(js)) return true;
        const name = /^(.*)-[\w-]{8}\.js$/.exec(basename(js))?.[1];
        const cssOnly = name && (group.css ?? []).some(css => {
          const cssName = basename(css);
          return styles.has(css) && cssName.startsWith(name + '.') && /^[\w-]{8}\.css$/.test(cssName.slice(name.length + 1));
        });
        if (!cssOnly) throw new Error(`Missing JavaScript asset without a CSS counterpart: ${js}`);
        removed.add(js);
        return false;
      });
    }
    planned.push([target, 'export default ' + JSON.stringify(manifest, null, 2) + '\n']);
  }
  // Validate both manifests before changing either of them.
  if (removed.size) for (const [file, content] of planned) writeFileSync(file, content);
  return [...removed];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const removed = verifyVpsAssets(process.argv[2] ?? 'dist');
  console.log(JSON.stringify({ assets_verified: true, removed_css_only_preloads: removed }));
}
