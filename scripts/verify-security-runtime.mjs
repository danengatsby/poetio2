import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packages = [
  ['react', 'node_modules/react/package.json'],
  ['react-dom', 'node_modules/react-dom/package.json'],
  ['react-server-dom-webpack', 'node_modules/react-server-dom-webpack/package.json'],
  ['plugin-rsc bundled React server', 'node_modules/@vitejs/plugin-rsc/dist/vendor/react-server-dom/package.json'],
];
const versions = [];
for (const [name, path] of packages) {
  const { version } = JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
  assert.match(version, /^\d+\.\d+\.\d+$/, `${name}: expected a stable release`);
  const [major, minor, patch] = version.split('.').map(Number);
  // GHSA-xqc2-xf4c-x3h3 (remote code execution in React Server Components)
  // affects 19.2.0-19.2.8; the earlier GHSA-wx67-qw84-cm4g needed 19.2.8.
  assert(major > 19 || (major === 19 && (minor > 2 || (minor === 2 && patch >= 9))),
    `${name} ${version}: upgrade for GHSA-xqc2-xf4c-x3h3`);
  versions.push(version);
  console.log(`${name}: ${version}`);
}
assert.equal(new Set(versions).size, 1, 'React, React DOM and both RSC copies must match');
