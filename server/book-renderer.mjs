import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

const execute = promisify(execFile);
const MAX_PAGES = 2000;
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_RENDER_BYTES = 512 * 1024 * 1024;
const JOB_TIMEOUT = 10 * 60 * 1000;
const POLICY_VERSION = 1;
class BookCheckError extends Error {
  constructor(code) { super(`PDF verification: ${code}`); this.code = code; }
}
function checkEnvelope(bytes) {
  if (bytes.length > MAX_BYTES) throw new BookCheckError('limits');
  // Poppler can repair some truncated PDFs. Publication requires a complete
  // file, including its final EOF marker, instead of silently accepting repair.
  if (!/^%PDF-[12]\.\d/.test(bytes.subarray(0, 8).toString('latin1')) || !/%%EOF[\x00\t\n\f\r ]*$/.test(bytes.subarray(-1024).toString('latin1'))) throw new BookCheckError('invalid');
}
function errorCode(error) {
  return error instanceof BookCheckError ? error.code : 'unavailable';
}
async function poppler(command, args, binary = false) {
  let result;
  try {
    // prlimit is supplied by util-linux on the supported Linux VPS runtime.
    // Caps apply even if a child outlives a server restart; stdout is bounded too.
    result = await execute('prlimit', ['--as=536870912', '--cpu=20', '--', command, ...args], {
      encoding: binary ? 'buffer' : 'utf8', timeout: binary ? 30000 : 20000, killSignal: 'SIGKILL',
      maxBuffer: binary ? 20 * 1024 * 1024 : 128 * 1024,
      env: { ...process.env, LC_ALL: 'C', OMP_THREAD_LIMIT: '1' },
    });
  } catch (error) {
    const diagnostic = String(error.stderr || '');
    if (/Incorrect password|encrypted/i.test(diagnostic)) throw new BookCheckError('encrypted');
    if (error.code === 'ENOENT' || /prlimit:.*(?:failed to execute|No such file|not permitted)/i.test(diagnostic)) throw new BookCheckError('unavailable');
    if (error.killed || error.signal || error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || /out of memory|cannot allocate memory/i.test(diagnostic)) throw new BookCheckError('limits');
    throw new BookCheckError('invalid');
  }
  // Poppler may exit successfully after recovering damaged objects/streams.
  if (/Syntax (?:Error|Warning)|(?:^|\n)Error:/i.test(String(result.stderr))) throw new BookCheckError('invalid');
  return result.stdout;
}
async function inspect(source) {
  const stdout = await poppler('pdfinfo', [source]);
  if (/^Encrypted:\s+yes/m.test(stdout)) throw new BookCheckError('encrypted');
  const pages = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!Number.isSafeInteger(pages) || pages < 1) throw new BookCheckError('invalid');
  if (pages > MAX_PAGES) throw new BookCheckError('limits');
  return { pages };
}
async function render(source, number) {
  const bytes = await poppler('pdftoppm', ['-f', String(number), '-l', String(number), '-singlefile', '-scale-to', '1800', '-jpeg', source], true);
  try { return await sharp(bytes, { limitInputPixels: 1800 * 1800, failOn: 'warning' }).jpeg({ quality: 88 }).toBuffer(); }
  catch { throw new BookCheckError('invalid'); }
}
const stamp = details => `${details.size}:${details.mtimeMs}:${details.ctimeMs}`;

export function openBookRenderer(directory) {
  const pending = new Map(), jobs = new Map();
  let active = 0;
  const queue = [];
  async function limited(task) {
    if (active >= 2) {
      if (queue.length >= 16) throw new BookCheckError('unavailable');
      await new Promise((resolve, reject) => {
        const entry = { resolve: () => { clearTimeout(timer); resolve(); } };
        const timer = setTimeout(() => { queue.splice(queue.indexOf(entry), 1); reject(new BookCheckError('unavailable')); }, 15000);
        queue.push(entry);
      });
    } else active++;
    try { return await task(); }
    finally { const next = queue.shift(); if (next) next.resolve(); else active--; }
  }
  function paths(file) {
    if (!/^books\/[0-9a-f-]{36}\/[0-9a-f]{64}$/i.test(file.object_key) || file.object_key !== `books/${file.id}/${file.content_hash}`) throw new Error('Invalid book path');
    // v3 never trusts images/info generated before strict PDF verification.
    return { source: join(directory, 'books', file.object_key), cache: join(directory, 'book-pages', 'v3', file.id, file.content_hash) };
  }
  async function once(key, task) {
    if (pending.has(key)) return pending.get(key);
    const result = task(); pending.set(key, result);
    try { return await result; } finally { pending.delete(key); }
  }
  async function atomic(path, data) {
    const temp = `${path}.${randomUUID()}.tmp`;
    try { await writeFile(temp, data, { mode: 0o600 }); await rename(temp, path); }
    finally { await rm(temp, { force: true }); }
  }
  async function checkUpload(input) {
    const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    checkEnvelope(bytes);
    return limited(async () => {
      const temp = await mkdtemp(join(tmpdir(), 'poetio-pdf-'));
      try {
        const source = join(temp, 'upload.pdf');
        await writeFile(source, bytes, { mode: 0o600 });
        const metadata = await inspect(source);
        await render(source, 1);
        return metadata;
      } finally { await rm(temp, { recursive: true, force: true }); }
    });
  }
  async function info(file) {
    const { source, cache } = paths(file);
    return once(`${cache}:info`, async () => {
      try { const data = JSON.parse(await readFile(join(cache, 'info.json'), 'utf8')); if (Number.isSafeInteger(data.pages) && data.pages > 0 && data.pages <= MAX_PAGES) return data; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const data = await limited(() => inspect(source));
      await mkdir(cache, { recursive: true, mode: 0o700 }); await atomic(join(cache, 'info.json'), JSON.stringify(data));
      return data;
    });
  }
  async function page(file, number) {
    const { source, cache } = paths(file);
    const { pages } = await info(file);
    if (!Number.isSafeInteger(number) || number < 1 || number > pages) return null;
    return once(`${cache}:${number}`, async () => {
      const target = join(cache, `${number}.jpg`);
      try { return await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return limited(async () => { const image = await render(source, number); await atomic(target, image); return image; });
    });
  }
  async function text(file, number, forceOcr = false) {
    const { source, cache } = paths(file);
    const { pages } = await info(file);
    if (!Number.isSafeInteger(number) || number < 1 || number > pages) return null;
    const target = join(cache, `${number}-text-v1${forceOcr ? '-ocr' : ''}.json`);
    return once(target, async () => {
      const sourceStamp = stamp(await stat(source));
      try {
        const saved = JSON.parse(await readFile(target, 'utf8'));
        if (saved.sourceStamp === sourceStamp) return saved.result;
      } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
      return limited(async () => {
        // Default Poppler output follows reading order; -layout/-raw would
        // preserve visual columns or PDF drawing order instead.
        let content = forceOcr ? '' : await poppler('pdftotext', ['-f', String(number), '-l', String(number), '-enc', 'UTF-8', '-nopgbrk', source, '-']);
        let method = 'pdf';
        if (forceOcr || !/[\p{L}\p{N}]/u.test(content)) {
          method = 'ocr';
          const temp = await mkdtemp(join(tmpdir(), 'poetio-ocr-'));
          try {
            const image = join(temp, 'page.jpg');
            await writeFile(image, await poppler('pdftoppm', ['-f', String(number), '-l', String(number), '-singlefile', '-scale-to', '2800', '-jpeg', source], true), { mode: 0o600 });
            content = await poppler('tesseract', [image, 'stdout', '-l', 'ron+eng', '--psm', '3']);
          } finally { await rm(temp, { recursive: true, force: true }); }
        }
        content = content.replace(/\r\n?/g, '\n').replace(/\f/g, '').normalize('NFC').trim();
        if (content.length > 64000) throw new BookCheckError('limits');
        if (stamp(await stat(source)) !== sourceStamp) throw new BookCheckError('invalid');
        const result = { text: content, source: method };
        await atomic(target, JSON.stringify({ sourceStamp, result }));
        return result;
      });
    });
  }
  async function validation(file, retry = false) {
    const { source, cache } = paths(file);
    return once(`${cache}:validation`, async () => {
      if (jobs.has(cache)) return { ...jobs.get(cache).state };
      const sourceStamp = stamp(await stat(source));
      const marker = join(cache, 'validation.json');
      try {
        const saved = JSON.parse(await readFile(marker, 'utf8'));
        const result = saved.result;
        if (saved.version === POLICY_VERSION && saved.sourceStamp === sourceStamp && saved.hash === file.content_hash && saved.byteSize === file.byte_size && result && Number.isSafeInteger(result.pages) && result.pages > 0 && result.pages <= MAX_PAGES && result.checkedPages === result.pages && result.status === 'ready') return result;
        if (saved.version === POLICY_VERSION && saved.sourceStamp === sourceStamp && saved.hash === file.content_hash && saved.byteSize === file.byte_size && result?.status === 'error' && ['invalid', 'encrypted', 'limits', 'unavailable'].includes(result.code) && !(retry && result.code === 'unavailable')) return result;
      } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
      // Two background books at most. Other private uploads wait for the next
      // authenticated poll; no unbounded in-memory queue is accumulated.
      const waiting = { status: 'checking', pages: 0, checkedPages: 0 };
      if (jobs.size >= 2) return waiting;
      const persist = result => atomic(marker, JSON.stringify({ version: POLICY_VERSION, sourceStamp, hash: file.content_hash, byteSize: file.byte_size, result }));
      const job = { state: waiting };
      jobs.set(cache, job);
      try {
        await mkdir(cache, { recursive: true, mode: 0o700 });
        await persist(waiting);
      } catch (error) { jobs.delete(cache); throw error; }
      // Jobs stay in this long-lived Node process, independently of HTTP polls.
      // A checking marker left by a restart is resumed on the next owner request.
      job.done = (async () => {
        const deadline = Date.now() + JOB_TIMEOUT;
        try {
          const details = await stat(source);
          if (details.size > MAX_BYTES) throw new BookCheckError('limits');
          const bytes = await readFile(source);
          checkEnvelope(bytes);
          if (bytes.length !== file.byte_size || createHash('sha256').update(bytes).digest('hex') !== file.content_hash) throw new BookCheckError('invalid');
          const metadata = await limited(() => inspect(source));
          await atomic(join(cache, 'info.json'), JSON.stringify(metadata));
          job.state = { status: 'checking', pages: metadata.pages, checkedPages: 0 };
          let renderedBytes = 0;
          for (let number = 1; number <= metadata.pages; number++) {
            if (Date.now() >= deadline) throw new BookCheckError('limits');
            const image = await page(file, number);
            if (!image) throw new BookCheckError('invalid');
            renderedBytes += image.length;
            if (renderedBytes > MAX_RENDER_BYTES || Date.now() >= deadline) throw new BookCheckError('limits');
            job.state = { status: 'checking', pages: metadata.pages, checkedPages: number };
          }
          if (stamp(await stat(source)) !== sourceStamp) throw new BookCheckError('invalid');
          const ready = { ...job.state, status: 'ready' };
          await persist(ready); // Durable evidence must precede authorization.
          job.state = ready;
        } catch (error) {
          const failed = { ...job.state, status: 'error', code: errorCode(error) };
          await persist(failed);
          job.state = failed;
        }
      })().catch(() => { /* Storage unavailable: no ready marker; a later retry starts safely. */ }).finally(() => jobs.delete(cache));
      return { ...job.state };
    });
  }
  return { info, page, text, checkUpload, validation };
}
