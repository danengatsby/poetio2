import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { openBookRenderer } from '../server/book-renderer.mjs';
import sharp from 'sharp';
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
  assert.deepEqual(await readFile(join(directory,'book-pages','v2',id,hash,'1.jpg')),first);
  assert.deepEqual(await openBookRenderer(directory).page(file,1),first,'Cache survives renderer restart');
  assert((await renderer.page(file,2)).length>0);
  for(const page of [0,-1,1.5,3])assert.equal(await renderer.page(file,page),null);
  await assert.rejects(renderer.info({...file,object_key:'../../etc/passwd'}),/Invalid book path/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
