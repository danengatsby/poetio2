import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({
  appType: 'custom',
  configFile: false,
  root,
  resolve: { alias: { '@': root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async entry => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith('.css') ? readFile(entryPath, 'utf8') : '';
    }),
  );
  return contents.join('\n');
}

test('emits the dialog animations and the reduced-motion override', async () => {
  const css = await readCssTree(path.join(root, 'dist'));

  // Video gallery and admin confirmation dialogs animate with tw-animate-css.
  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /--tw-exit-opacity/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('renders the language selector as a single-choice group', async () => {
  const { default: LanguageSelector } = await vite.ssrLoadModule('/app/language-selector.tsx');
  const html = renderToStaticMarkup(React.createElement(LanguageSelector, { language: 'en-US', onChange() {} }));

  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-label="Site language"/);
  assert.match(html, /<button[^>]*aria-checked="false"[^>]*lang="ro"[^>]*>Română<\/button>/);
  assert.match(html, /<button[^>]*aria-checked="true"[^>]*lang="en-US"[^>]*>English \(US\)<\/button>/);
});

test('renders the compact language labels', async () => {
  const { default: LanguageSelector } = await vite.ssrLoadModule('/app/language-selector.tsx');
  const html = renderToStaticMarkup(
    React.createElement(LanguageSelector, {
      language: 'ro',
      onChange() {},
      compact: true,
    }),
  );

  assert.match(html, /aria-label="Limba site-ului"/);
  assert.match(html, />RO<\/button>/);
  assert.match(html, />EN<\/button>/);
});
