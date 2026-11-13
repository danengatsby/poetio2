import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { openVideoPoster } from '../server/video-poster.mjs';
import { mediaFixture } from './media-fixture.mjs';

const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const isJpeg = bytes => bytes.length > 500 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

function library(name, type) {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-poster-'));
  const bytes = mediaFixture(name), id = crypto.randomUUID(), content_hash = hash(bytes);
  const file = { id, object_key: `videos/${id}/${content_hash}`, file_name: name, content_type: type, byte_size: bytes.length, content_hash, owner_email: 'pensio53@gmail.com', created_at: 1 };
  mkdirSync(join(directory, 'videos/videos', id), { recursive: true });
  writeFileSync(join(directory, 'videos', file.object_key), bytes);
  return { directory, file, bytes };
}

test('a still is rendered once from MP4 and WebM with bounded commands, then served from disk', async () => {
  for (const [name, type] of [['clip.mp4', 'video/mp4'], ['clip.webm', 'video/webm']]) {
    const { directory, file } = library(name, type);
    const calls = [];
    const poster = openVideoPoster(directory, { run: async (...args) => { calls.push(args); return execute(...args); } });
    try {
      const [first, concurrent] = await Promise.all([poster.render(file), poster.render(file)]);
      assert.ok(isJpeg(first), `${name} yields a JPEG`);
      assert.deepEqual(concurrent, first, 'Concurrent requests share one rendering');
      const count = calls.length;
      assert.ok(count >= 1 && count <= 2, 'One attempt, or a second at the opening frame for a very short clip');
      assert.deepEqual(await poster.render(file), first);
      assert.deepEqual(await openVideoPoster(directory, { run: async () => { throw new Error('must not render again'); } }).render(file), first);
      assert.equal(calls.length, count, 'A stored still is reused');
      assert.deepEqual(readdirSync(join(directory, 'video-posters/jpeg-v1', file.id)), [`${file.content_hash}.jpg`], 'No temporary file remains');
      for (const [program, args, options] of calls) {
        assert.equal(program, 'prlimit'); assert.ok(args.includes('--as=805306368')); assert.ok(args.includes('--cpu=20')); assert.ok(args.includes('--fsize=0'));
        assert.equal(args[args.indexOf('-protocol_whitelist') + 1], 'file'); assert.equal(args[args.indexOf('-f') + 1], type === 'video/mp4' ? 'mov' : 'matroska');
        assert.equal(args.at(-1), 'pipe:1'); assert.ok(options.timeout <= 30000); assert.equal(options.killSignal, 'SIGKILL'); assert.ok(options.maxBuffer <= 2 * 1024 * 1024);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

test('unexpected paths, types, sizes and decoder output never produce a still', async () => {
  const { directory, file } = library('clip.mp4', 'video/mp4');
  const refused = async () => { throw new Error('must not start a decoder'); };
  try {
    for (const changed of [{ object_key: `videos/${file.id}/../../secret` }, { object_key: `videos/${crypto.randomUUID()}/${file.content_hash}` }, { content_type: 'video/quicktime' }, { content_type: 'image/jpeg' }]) {
      await assert.rejects(openVideoPoster(directory, { run: refused }).render({ ...file, ...changed }));
    }
    await assert.rejects(openVideoPoster(directory, { run: refused }).render({ ...file, byte_size: file.byte_size + 1 }), /unavailable/);
    await assert.rejects(openVideoPoster(directory, { run: async () => ({ stdout: Buffer.from('not an image'), stderr: Buffer.alloc(0) }) }).render(file), /frame unavailable/);
    await assert.rejects(openVideoPoster(directory, { run: async () => { throw Object.assign(new Error('killed'), { killed: true }); } }).render(file));
    assert.deepEqual(readdirSync(directory), ['videos'], 'A failed rendering stores nothing');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

// The serving rules are TypeScript shared with the Worker build.
const output = mkdtempSync(join(tmpdir(), 'poetio-poster-ts-'));
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
for (const file of ['db/video-posters', 'db/video-files', 'db/audio', 'db/images', 'db/image-validation', 'db/media-validation', 'lib/access', 'lib/video-types', 'lib/poem-audio', 'lib/poem-images']) {
  mkdirSync(join(output, file.split('/')[0]), { recursive: true });
  const source = readFileSync(new URL(`../${file}.ts`, import.meta.url), 'utf8');
  writeFileSync(join(output, file + '.js'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
}
process.on('exit', () => rmSync(output, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { serveVideoPoster } = require(join(output, 'db/video-posters.js'));
const { serveVideoFile } = require(join(output, 'db/video-files.js'));
const { serveAudio } = require(join(output, 'db/audio.js'));

// The three queries these functions make, over plain in-memory rows.
function database({ files = [], audio = [], published = new Set() }) {
  return { prepare(query) { let values = []; return {
    bind(...bound) { values = bound; return this; },
    async first() {
      if (query.startsWith('SELECT * FROM video_files')) return files.find(row => row.id === values[0]) ?? null;
      if (query.startsWith('SELECT * FROM poem_audio')) return audio.find(row => row.id === values[0]) ?? null;
      if (query.startsWith('SELECT id FROM videos WHERE file_id') || query.startsWith('SELECT id FROM poems WHERE audio_ro_id')) return published.has(values[0]) ? { id: 'published' } : null;
      throw new Error('Unexpected query: ' + query);
    },
  }; } };
}
const owner = { 'oai-authenticated-user-email': 'pensio53@gmail.com' };
const still = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(600, 1)]);

test('a still is public only while its film is published, and is revalidated rather than re-sent', async () => {
  const { directory, file } = library('clip.mp4', 'video/mp4');
  rmSync(directory, { recursive: true, force: true });
  let rendered = 0;
  const renderer = { async render(row) { rendered++; assert.equal(row.id, file.id); return still; } };
  const published = new Set();
  const db = database({ files: [file], published });
  const read = (headers = {}, method = 'GET', id = file.id, engine = renderer) => serveVideoPoster(db, engine, new Request('https://poetio.test/api/video-posters/' + id, { headers, method }), id);

  assert.equal((await read()).status, 404, 'An uploaded but unpublished film has no public still');
  const preview = await read(owner);
  assert.equal(preview.status, 200); assert.equal(preview.headers.get('Cache-Control'), 'private, no-store'); await preview.arrayBuffer();
  published.add(file.id);
  const response = await read();
  assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-cache'); assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Content-Length'), String(still.length)); assert.deepEqual(Buffer.from(await response.arrayBuffer()), still);
  const etag = response.headers.get('ETag'); assert.equal(etag, `"${file.content_hash}-poster-v1"`);
  const head = await read({}, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, null); assert.equal(head.headers.get('Content-Length'), String(still.length));
  const before = rendered;
  for (const value of [etag, 'W/' + etag, '"other", ' + etag, '*']) assert.equal((await read({ 'If-None-Match': value })).status, 304);
  assert.equal(rendered, before, 'A cache hit does not render');
  assert.equal((await read({ 'If-None-Match': '"other"' })).status, 200);
  assert.equal((await serveVideoPoster(db, undefined, new Request('https://poetio.test/api/video-posters/' + file.id), file.id)).status, 404, 'A runtime without a renderer answers 404');
  assert.equal((await read({}, 'GET', file.id, { async render() { throw new Error('decoder failed'); } })).status, 404, 'A failed rendering is a 404, never a broken image');
  assert.equal((await read({}, 'GET', '../../etc/passwd')).status, 404);
  assert.equal((await read({}, 'GET', crypto.randomUUID())).status, 404);
  published.delete(file.id);
  assert.equal((await read({ 'If-None-Match': etag })).status, 404, 'Withdrawal closes access even for a cached still');
});

test('published recordings and films may be kept by the browser but are revalidated', async () => {
  const bytes = Buffer.alloc(256, 7), content_hash = hash(bytes);
  const film = { id: crypto.randomUUID(), content_type: 'video/mp4', byte_size: bytes.length, content_hash, owner_email: 'pensio53@gmail.com' };
  const recording = { id: crypto.randomUUID(), content_type: 'audio/mpeg', byte_size: bytes.length, content_hash, owner_email: 'pensio53@gmail.com' };
  film.object_key = `videos/${film.id}/${content_hash}`; recording.object_key = `poem-audio/${recording.id}/${content_hash}`;
  const published = new Set([film.id, recording.id]);
  const db = database({ files: [film], audio: [recording], published });
  let reads = 0;
  const bucket = { async get(key, options) { reads++; const range = options?.range; return { size: bytes.length, body: new Response(range ? bytes.subarray(range.offset, range.offset + range.length) : bytes).body }; } };
  for (const [serve, row, path] of [[serveVideoFile, film, '/api/video-files/'], [serveAudio, recording, '/api/audio/']]) {
    const read = (headers = {}, method = 'GET') => serve(db, bucket, new Request('https://poetio.test' + path + row.id, { headers, method }), row.id);
    const full = await read();
    assert.equal(full.status, 200); assert.equal(full.headers.get('Cache-Control'), 'private, no-cache'); assert.equal(full.headers.get('ETag'), `"${content_hash}"`);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    const preview = await read(owner); assert.equal(preview.headers.get('Cache-Control'), 'private, no-store'); await preview.arrayBuffer();
    const count = reads;
    for (const headers of [{ 'If-None-Match': `"${content_hash}"` }, { 'If-None-Match': `W/"${content_hash}"`, Range: 'bytes=0-9' }]) {
      const cached = await read(headers);
      assert.equal(cached.status, 304); assert.equal(cached.body, null); assert.equal(cached.headers.get('ETag'), `"${content_hash}"`); assert.equal(cached.headers.get('Cache-Control'), 'private, no-cache');
    }
    assert.equal((await read({ 'If-None-Match': `"${content_hash}"` }, 'HEAD')).status, 304);
    assert.equal(reads, count, 'A cache hit reads nothing from storage');
    const part = await read({ Range: 'bytes=10-19', 'If-Range': `"${content_hash}"` });
    assert.equal(part.status, 206); assert.equal(part.headers.get('Content-Range'), 'bytes 10-19/256'); assert.equal(part.headers.get('Cache-Control'), 'private, no-cache'); await part.arrayBuffer();
    const changed = await read({ 'If-None-Match': '"older-file"' }); assert.equal(changed.status, 200); await changed.arrayBuffer();
    published.delete(row.id);
    assert.equal((await read({ 'If-None-Match': `"${content_hash}"` })).status, 404, 'Withdrawal closes access even for a cached file');
  }
});
