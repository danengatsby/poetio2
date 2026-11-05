// Tiny original PDFs used to exercise Poppler, including a damaged later page.
export function bookFixture({ brokenSecondPage = false, count = 2, stream = 'BT /F1 24 Tf 40 300 Td (Poetio reader test) Tj ET' } = {}) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [3 0 R 6 0 R] /Count ${count} >>`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents ${brokenSecondPage ? 7 : 5} 0 R >>`,
  ];
  if (brokenSecondPage) objects.push('<< /Length 8 /Filter /FlateDecode >>\nstream\nnot-zlib\nendstream');
  const children = [3, 6];
  for (let i = 2; i < count; i++) {
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
    children.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${children.map(id => `${id} 0 R`).join(' ')}] /Count ${children.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [];
  objects.forEach((value, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${value}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export async function finishedBookValidation(renderer, file) {
  const deadline = Date.now() + 15000;
  for (;;) {
    const state = await renderer.validation(file);
    if (state.status !== 'checking') return state;
    if (Date.now() > deadline) throw new Error('PDF validation did not finish in the test');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
