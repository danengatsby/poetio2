import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { openBookRenderer } from '../server/book-renderer.mjs';
import sharp from 'sharp';
import { bookFixture, finishedBookValidation } from './book-fixture.mjs';
function fixture() {
  const stream='BT /F1 24 Tf 40 300 Td (Poetio reader test) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'];
  let pdf='%PDF-1.4\n'; const offsets=[0];
  objects.forEach((value,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${value}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test('book rendering produces cached page images without watermarks, validates page ranges and rejects unsafe paths',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'poetio-reader-test-'));
 try {
  const bytes=fixture(),id=randomUUID(),hash=createHash('sha256').update(bytes).digest('hex');
  const file={id,content_hash:hash,object_key:`books/${id}/${hash}`};
  await mkdir(join(directory,'books','books',id),{recursive:true});await writeFile(join(directory,'books',file.object_key),bytes);
  const renderer=openBookRenderer(directory);assert.deepEqual(await renderer.info(file),{pages:2});
  const [first,duplicate]=await Promise.all([renderer.page(file,1),renderer.page(file,1)]);assert.deepEqual(first,duplicate);
  const meta=await sharp(first).metadata();assert.equal(meta.format,'jpeg');assert.equal(Math.max(meta.width,meta.height),1800);
  // The lower part of this fixture is white and must stay free of added marks.
  const pixels=await sharp(first).extract({left:0,top:Math.floor(meta.height*.65),width:meta.width,height:Math.floor(meta.height*.3)}).raw().toBuffer();
  let colored=0;for(let i=0;i<pixels.length;i+=3)if(pixels[i+2]-pixels[i]>3)colored++;
  assert.equal(colored,0,'Rendered pages must not contain an added watermark');
  assert.deepEqual(await readFile(join(directory,'book-pages','v3',id,hash,'1.jpg')),first);
  assert.deepEqual(await openBookRenderer(directory).page(file,1),first,'Cache survives renderer restart');
  assert((await renderer.page(file,2)).length>0);
  for(const page of [0,-1,1.5,3])assert.equal(await renderer.page(file,page),null);
  await assert.rejects(renderer.info({...file,object_key:'../../etc/passwd'}),/Invalid book path/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('PDF preflight rejects truncated, encrypted and oversized-page documents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-pdf-check-'));
  try {
    const renderer = openBookRenderer(directory);
    assert.deepEqual(await renderer.checkUpload(bookFixture()), { pages: 2 });
    for (const bytes of [Buffer.from('%PDF-1.4'), bookFixture().subarray(0, -6)]) {
      await assert.rejects(renderer.checkUpload(bytes), { code: 'invalid' });
    }
    await assert.rejects(renderer.checkUpload(await readFile(new URL('./fixtures/password-protected.pdf', import.meta.url))), { code: 'encrypted' });
    await assert.rejects(renderer.checkUpload(bookFixture({ count: 2001 })), { code: 'limits' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('full validation finds a broken later page, survives restart and rejects modified originals', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-pdf-pages-'));
  const store = async bytes => {
    const id = randomUUID(), hash = createHash('sha256').update(bytes).digest('hex');
    const file = { id, content_hash: hash, byte_size: bytes.length, object_key: `books/${id}/${hash}` };
    await mkdir(join(directory, 'books', 'books', id), { recursive: true });
    await writeFile(join(directory, 'books', file.object_key), bytes);
    return file;
  };
  try {
    const renderer = openBookRenderer(directory), bytes = bookFixture({ brokenSecondPage: true });
    assert.deepEqual(await renderer.checkUpload(bytes), { pages: 2 }, 'Preflight alone cannot validate later pages');
    const broken = await store(bytes);
    assert.equal((await renderer.validation(broken)).status, 'checking');
    const rejected = await finishedBookValidation(renderer, broken);
    assert.deepEqual(rejected, { status: 'error', code: 'invalid', pages: 2, checkedPages: 1 });
    assert.deepEqual(await openBookRenderer(directory).validation(broken), rejected, 'Invalid result survives process restart');

    const valid = await store(bookFixture());
    assert.deepEqual(await finishedBookValidation(renderer, valid), { status: 'ready', pages: 2, checkedPages: 2 });
    assert.deepEqual(await openBookRenderer(directory).validation(valid), { status: 'ready', pages: 2, checkedPages: 2 });
    const cache = join(directory, 'book-pages', 'v3', valid.id, valid.content_hash);
    // Simulate a crash while a job was checking. The immutable rendered pages
    // can be reused, but a partial marker must not authorize publication.
    const marker = JSON.parse(await readFile(join(cache, 'validation.json'), 'utf8'));
    marker.result = { status: 'checking', pages: 2, checkedPages: 1 };
    await writeFile(join(cache, 'validation.json'), JSON.stringify(marker));
    const restarted = openBookRenderer(directory);
    assert.equal((await restarted.validation(valid)).status, 'checking');
    assert.equal((await finishedBookValidation(restarted, valid)).status, 'ready');
    await writeFile(join(directory, 'books', valid.object_key), Buffer.from('%PDF-1.4'));
    assert.equal((await restarted.validation(valid)).status, 'checking');
    assert.equal((await finishedBookValidation(restarted, valid)).status, 'error', 'A stale ready marker does not hide changed source bytes');
    await assert.rejects(renderer.validation({ ...valid, object_key: '../../outside' }), /Invalid book path/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('temporary renderer unavailability remains private and can be retried after recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-pdf-retry-'));
  const originalPath = process.env.PATH;
  const bytes = bookFixture(), id = randomUUID(), hash = createHash('sha256').update(bytes).digest('hex');
  const file = { id, content_hash: hash, byte_size: bytes.length, object_key: `books/${id}/${hash}` };
  try {
    await mkdir(join(directory, 'books', 'books', id), { recursive: true });
    await writeFile(join(directory, 'books', file.object_key), bytes);
    const renderer = openBookRenderer(directory);
    process.env.PATH = directory; // Deliberately hide Poppler/prlimit in this test process.
    await assert.rejects(renderer.checkUpload(bytes), { code: 'unavailable' });
    const failed = await finishedBookValidation(renderer, file);
    assert.equal(failed.status, 'error'); assert.equal(failed.code, 'unavailable');
    if (originalPath === undefined) delete process.env.PATH; else process.env.PATH = originalPath;
    assert.deepEqual(await renderer.validation(file), failed, 'Polling does not restart a failing job on every request');
    assert.equal((await renderer.validation(file, true)).status, 'checking');
    assert.equal((await finishedBookValidation(renderer, file)).status, 'ready');
  } finally {
    if (originalPath === undefined) delete process.env.PATH; else process.env.PATH = originalPath;
    await rm(directory, { recursive: true, force: true });
  }
});
