// Starts the built VPS server on a throwaway data directory for the browser tests.
//
// The database is created by the migration runner. Poems are added through the
// server's own API, as the editor adds them, so the build under test writes the
// search index. Playwright waits for http://127.0.0.1:<port + 1>/ready, which
// answers once the poems are in. Requires `npm run build:vps` first.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { migrate } from '../../scripts/migrate.mjs';
import { OWNER_EMAIL, fixtureBook, fixturePoems } from './fixture.mjs';
import { bookFixture } from '../book-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.POETIO_E2E_PORT || 4310);
const base = `http://127.0.0.1:${port}`;
// POETIO_E2E_BUILD_DIR runs the tests against another build, e.g. an older release.
const build = process.env.POETIO_E2E_BUILD_DIR || join(root, 'dist');
if (!existsSync(join(build, 'server'))) throw new Error('Run `npm run build:vps` before the browser tests.');

const data = mkdtempSync(join(tmpdir(), 'poetio-e2e-'));
const cleanup = () => rmSync(data, { recursive: true, force: true });
process.on('exit', cleanup);
for (const folder of ['images', 'audio', 'videos', 'books']) mkdirSync(join(data, folder));
await migrate(join(data, 'poetio.sqlite3'), { create: true });

const server = spawn(process.execPath, [join(root, 'scripts/start-vps.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    POETIO_DATA_DIR: data,
    POETIO_BUILD_DIR: build,
    POETIO_PORT: String(port),
    OPENAI_API_KEY: '',
  },
});
let ready;
const stop = () => {
  ready?.close();
  server.kill('SIGTERM');
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
server.on('exit', code => {
  ready?.close();
  cleanup();
  process.exit(code ?? 0);
});

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(base + '/')).ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('The Poetio server did not start.');
}

try {
  await waitForServer();
  const { translationProvenance } = await tsImport('../../lib/translation-provenance.ts', import.meta.url);
  for (const poem of fixturePoems) {
    const body = { id: crypto.randomUUID(), ...poem };
    if (poem.translated_content) body.translation_provenance = await translationProvenance(poem, 'manual');
    const response = await fetch(base + '/api/poems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, 'oai-authenticated-user-email': OWNER_EMAIL },
      body: JSON.stringify(body),
    });
    if (response.status !== 201) throw new Error(`Adding "${poem.title}" failed: ${await response.text()}`);
  }
  // A book: upload the PDF, then publish once its pages have been checked.
  const owner = { Origin: base, 'oai-authenticated-user-email': OWNER_EMAIL };
  const fileId = crypto.randomUUID();
  const upload = await fetch(base + '/api/book-files', {
    method: 'POST',
    headers: { ...owner, 'Content-Type': 'application/pdf', 'X-Upload-Id': fileId, 'X-File-Name': 'carte.pdf' },
    body: bookFixture({ count: fixtureBook.pages }),
  });
  if (upload.status !== 201) throw new Error(`Uploading the book failed: ${await upload.text()}`);
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(base + '/api/books', {
      method: 'POST',
      headers: { ...owner, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fixtureBook.record, file_id: fileId }),
    });
    if (response.status === 201) break;
    if (response.status !== 409 || attempt > 120) throw new Error(`Adding the book failed: ${await response.text()}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
} catch (error) {
  console.error(error);
  stop();
}

ready = createServer((request, response) => {
  response.writeHead(request.url === '/ready' ? 200 : 404).end();
}).listen(port + 1, '127.0.0.1');
