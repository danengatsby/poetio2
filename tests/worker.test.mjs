import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import sharp from 'sharp';
import { wavFixture } from './audio-fixture.mjs';
import { mediaFixture } from './media-fixture.mjs';
import { createHash } from 'node:crypto';
import { bookFixture } from './book-fixture.mjs';

test('built Worker protects administration and persists API changes into the rendered collection', { timeout: 45000 }, async () => {
  let translationCalls = 0;
  let failTranslation = false;
  const serverDirectory = new URL('../dist/server/', import.meta.url);
  const modules = ['index.js', ...readdirSync(serverDirectory, { recursive: true }).filter(file => file.endsWith('.js') && file !== 'index.js')];
  const mf = new Miniflare(convertV4MiniflareOptions({
    modulesRoot: serverDirectory.pathname,
    modules: modules.map(file => ({ type: 'ESModule', path: new URL(file, serverDirectory).pathname })),
    compatibilityDate: '2026-05-22',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    r2Buckets: ['BUCKET'],
    images: { binding: 'IMAGES' },
    bindings: { OPENAI_API_KEY: 'test-worker-key' },
    outboundService: async request => {
      assert.equal(request.url, 'https://api.openai.com/v1/responses');
      assert.equal(request.headers.get('authorization'), 'Bearer test-worker-key');
      translationCalls++;
      if (failTranslation) return Response.json({ error: 'rate limited' }, { status: 429 });
      const payload = await request.json();
      assert.equal(payload.store, false);
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ title: 'Verification Poem', theme: 'Testing', lines: ['First line', 'Second line', '', 'The second stanza.'] }) }] }] });
    },
  }));
  const base = 'https://stillword.test';
  const owner = { 'oai-authenticated-user-email': 'pensio53@gmail.com' };
  const mutation = { ...owner, 'Content-Type': 'application/json', Origin: base };
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
      const sql = readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8');
      await db.batch(sql.split('--> statement-breakpoint').map(statement => db.prepare(statement.trim())));
    }
    assert.equal((await mf.dispatchFetch(base + '/api/admin/operations')).status, 401);
    assert.equal((await mf.dispatchFetch(base + '/api/admin/operations', { headers: { 'oai-authenticated-user-email': 'outsider@example.test' } })).status, 403);
    const operations = await mf.dispatchFetch(base + '/api/admin/operations', { headers: owner });
    assert.equal(operations.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await operations.json(), { available: false });
    const pdfId = crypto.randomUUID();
    const bookDraftUrl = base + '/api/admin/recovery/book/drafts';
    const bookDraft = { id: crypto.randomUUID(), snapshot: { id: crypto.randomUUID(), title: 'Schiță privată de carte', author: '', description: 'În lucru', file_id: '', image_id: null, revision: 1, isNew: true, pendingBookFile: true } };
    assert.equal((await mf.dispatchFetch(bookDraftUrl)).status, 401);
    for (const [h, expected] of [[{ ...mutation, 'oai-authenticated-user-email': '' }, 401], [{ ...mutation, 'oai-authenticated-user-email': 'visitor@example.com' }, 403], [{ ...mutation, Origin: 'https://elsewhere.test' }, 403]]) assert.equal((await mf.dispatchFetch(bookDraftUrl, { method: 'POST', headers: h, body: JSON.stringify(bookDraft) })).status, expected);
    const savedDraft = await mf.dispatchFetch(bookDraftUrl, { method: 'POST', headers: mutation, body: JSON.stringify(bookDraft) });
    assert.equal(savedDraft.status, 201);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM books').first()).n, 0);
    const recoveredBook = await (await mf.dispatchFetch(bookDraftUrl + '/' + bookDraft.id, { headers: owner })).json();
    assert.equal(recoveredBook.snapshot.description, 'În lucru'); assert.equal(recoveredBook.snapshot.pendingBookFile, true);
    assert.equal((await mf.dispatchFetch(bookDraftUrl + '/' + bookDraft.id)).status, 401);
    for (const [requestHeaders, expected] of [[{}, 401], [{ ...mutation, 'oai-authenticated-user-email': 'visitor@example.com' }, 403], [{ ...mutation, Origin: 'https://elsewhere.test' }, 403]]) {
      const rejected = await mf.dispatchFetch(base + `/api/admin/book-text/${pdfId}/1`, { method: 'PUT', headers: requestHeaders, body: '{}' });
      assert.equal(rejected.status, expected);
      for (const method of ['POST','DELETE']) assert.equal((await mf.dispatchFetch(base + `/api/admin/book-text/${pdfId}/1/recovery`, { method, headers: requestHeaders, body: '{}' })).status, expected);
    }
    assert.equal((await mf.dispatchFetch(base + `/api/book-text/${pdfId}/1`)).status, 404);
    const validationUrl = base + `/api/book-files/${pdfId}/validation`;
    for (const [headers, status] of [[{ ...mutation, 'oai-authenticated-user-email': '' }, 401], [{ ...mutation, 'oai-authenticated-user-email': 'visitor@example.com' }, 403], [{ ...mutation, Origin: 'https://other.test' }, 403]]) {
      const denied = await mf.dispatchFetch(validationUrl, { method: 'POST', headers, body: '{}' });
      assert.equal(denied.status, status);
    }
    const pdfUpload = await mf.dispatchFetch(base + '/api/book-files', { method: 'POST', headers: { ...owner, Origin: base, 'Content-Type': 'application/pdf', 'X-Upload-Id': pdfId }, body: bookFixture() });
    assert.equal(pdfUpload.status, 503, 'A Worker without a PDF validator must fail closed');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM book_files').first()).n, 0);
    assert.equal((await (await mf.getR2Bucket('BUCKET')).list({ prefix: 'books/' })).objects.length, 0);
    await db.prepare('INSERT INTO book_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(pdfId, 'legacy', 'legacy.pdf', 'application/pdf', 8, 'hash', owner['oai-authenticated-user-email'], 1).run();
    await db.prepare('INSERT INTO book_page_texts VALUES (?,1,?,\'ro\',1,1)').bind(pdfId,'Corectură verificată').run();
    const textHistoryUrl=base+`/api/admin/book-text/${pdfId}/1/recovery?source=history`;
    assert.equal((await mf.dispatchFetch(textHistoryUrl)).status,401);
    assert.equal((await mf.dispatchFetch(textHistoryUrl,{headers:{'oai-authenticated-user-email':'other@example.test'}})).status,403);
    const textHistory=await mf.dispatchFetch(textHistoryUrl,{headers:owner});assert.equal(textHistory.headers.get('Cache-Control'),'private, no-store');
    const textVersions=await textHistory.json();assert.equal(textVersions.entries.length,1);
    const recoveredText=await (await mf.dispatchFetch(textHistoryUrl+'&id='+textVersions.entries[0].id,{headers:owner})).json();
    assert.equal(recoveredText.snapshot.text,'Corectură verificată');
    assert.equal((await mf.dispatchFetch(base+`/api/admin/book-text/${pdfId}/2/recovery?source=history&id=${textVersions.entries[0].id}`,{headers:owner})).status,404);
    const uncheckedBook = { id: crypto.randomUUID(), title: 'Unverified legacy PDF', author: '', description: '', file_id: pdfId };
    const blockedBook = await mf.dispatchFetch(base + '/api/books', { method: 'POST', headers: mutation, body: JSON.stringify(uncheckedBook) });
    assert.equal(blockedBook.status, 503);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM books').first()).n, 0);
    await db.prepare('DELETE FROM book_files WHERE id = ?').bind(pdfId).run();
    const forbidden = await mf.dispatchFetch(base + '/api/poems', { method: 'POST', headers: { ...mutation, 'oai-authenticated-user-email': 'visitor@example.com' }, body: '{}' });
    assert.equal(forbidden.status, 403);
    const anonymous = await mf.dispatchFetch(base + '/admin');
    const anonymousHtml = await anonymous.text();
    assert.match(anonymousHtml, /Autentificare cu ChatGPT/);
    assert.doesNotMatch(anonymousHtml, /The blue hour/);
    const admin = await mf.dispatchFetch(base + '/admin', { headers: owner });
    const adminHtml = await admin.text();
    assert.equal(admin.status, 200);
    assert.match(adminHtml, /Poemele tale/);
    assert.match(adminHtml, /The blue hour/);
    assert.equal(admin.headers.get('cache-control'), 'private, no-store');
    assert.match(adminHtml, /Imaginea poemului/);
    assert.match(adminHtml, /Limba textului original/);
    assert.match(adminHtml, /O marți obișnuită/);
    assert.match(adminHtml, /Textul traducerii/);
    assert.doesNotMatch(adminHtml, /test-worker-key/);
    assert.match(adminHtml, /Înregistrările poemului/);
    for (const path of ['/api/admin/poems', '/api/poems/original-1']) {
      assert.equal((await mf.dispatchFetch(base + path)).status, 401);
      assert.equal((await mf.dispatchFetch(base + path, { headers: { 'oai-authenticated-user-email': 'outsider@example.test' } })).status, 403);
    }
    const pageResponse = await mf.dispatchFetch(base + '/api/admin/poems?q=blue', { headers: owner });
    assert.equal(pageResponse.status, 200); assert.equal(pageResponse.headers.get('Cache-Control'), 'private, no-store');
    const page = await pageResponse.json(); assert(page.poems.length > 0 && page.poems.length <= 20);
    assert(!('content' in page.poems[0]) && !('translated_content' in page.poems[0]));
    const selected = await mf.dispatchFetch(base + '/api/poems/' + page.poems[0].id, { headers: owner });
    assert.equal(selected.status, 200); assert.equal(selected.headers.get('Cache-Control'), 'private, no-store');
    assert((await selected.json()).poem.content.length > 0);
    assert.equal((await mf.dispatchFetch(base + '/api/poems/00000000-0000-4000-8000-000000000000', { headers: owner })).status, 404);
    const audioId = 'bf1a4071-8aa4-4e52-8bf2-690d49d72683';
    const audioBytes = wavFixture();
    const audioHeaders = { ...owner, Origin: base, 'Content-Type': 'audio/wav', 'X-Upload-Id': audioId };
    for (const headers of [{ ...audioHeaders, 'oai-authenticated-user-email': '' }, { ...audioHeaders, Origin: 'https://other.test' }]) {
      const rejected = await mf.dispatchFetch(base + '/api/audio', { method: 'POST', headers, body: audioBytes });
      assert.ok([401, 403].includes(rejected.status));
    }
    const audioUpload = await mf.dispatchFetch(base + '/api/audio', { method: 'POST', headers: audioHeaders, body: audioBytes });
    assert.equal(audioUpload.status, 503, 'A Worker without a media decoder cannot accept audio');
    const bucket = await mf.getR2Bucket('BUCKET');
    assert.equal((await bucket.list({ prefix: 'poem-audio/' })).objects.length, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poem_audio').first()).n, 0);
    // A legacy private upload remains previewable, but cannot be published when
    // this runtime has no decoding binding. It is not a bypass in application code.
    const audioHash = createHash('sha256').update(audioBytes).digest('hex'), audioKey = `poem-audio/${audioId}/${audioHash}`;
    await bucket.put(audioKey, audioBytes);
    await db.prepare('INSERT INTO poem_audio VALUES (?,?,?,?,?,?,?,?)').bind(audioId,audioKey,'legacy.wav','audio/wav',audioBytes.length,audioHash,owner['oai-authenticated-user-email'],1).run();
    const blockedAudio = await mf.dispatchFetch(base + '/api/poems', { method:'POST',headers:mutation,body:JSON.stringify({id:crypto.randomUUID(),title:'Blocked audio',author:'Author',theme:'',content:'Original',audio_ro_id:audioId}) });
    assert.equal(blockedAudio.status, 503);
    const videoId = crypto.randomUUID(), videoBytes = mediaFixture('clip.mp4');
    const videoUpload = await mf.dispatchFetch(base + '/api/video-files', {method:'POST',headers:{...owner,Origin:base,'Content-Type':'video/mp4','X-Upload-Id':videoId},body:videoBytes});
    assert.equal(videoUpload.status, 503);
    assert.equal((await bucket.list({prefix:'videos/'})).objects.length, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM video_files').first()).n, 0);
    const videoHash=createHash('sha256').update(videoBytes).digest('hex');
    await db.prepare('INSERT INTO video_files VALUES(?,?,?,?,?,?,?,?)').bind(videoId,`videos/${videoId}/${videoHash}`,'legacy.mp4','video/mp4',videoBytes.length,videoHash,owner['oai-authenticated-user-email'],1).run();
    const blockedVideo=await mf.dispatchFetch(base+'/api/videos',{method:'POST',headers:mutation,body:JSON.stringify({id:crypto.randomUUID(),title:'Blocked video',author:'',description:'',file_id:videoId})});
    assert.equal(blockedVideo.status,503);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM videos').first()).n,0);
    assert.equal((await mf.dispatchFetch(base + '/api/audio/' + audioId)).status, 404);
    const previewAudio = await mf.dispatchFetch(base + '/api/audio/' + audioId, { headers: owner });
    assert.equal(previewAudio.status, 200); assert.deepEqual(Buffer.from(await previewAudio.arrayBuffer()), audioBytes);
    const imageBytes = readFileSync(new URL('../public/assets/blue-hour.webp', import.meta.url));
    const imageId = '78337a23-f6e1-4bd3-8c51-4e4f041c497d';
    const imageHeaders = { ...owner, Origin: base, 'Content-Type': 'image/webp', 'X-Upload-Id': imageId, 'X-File-Name': encodeURIComponent('Lumină de seară.webp') };
    const unauthorizedUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: { ...imageHeaders, 'oai-authenticated-user-email': 'visitor@example.com' }, body: imageBytes });
    assert.equal(unauthorizedUpload.status, 403);
    const crossSiteUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: { ...imageHeaders, Origin: 'https://other.example' }, body: imageBytes });
    assert.equal(crossSiteUpload.status, 403);
    const invalidUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: { ...imageHeaders, 'Content-Type': 'image/png' }, body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' });
    assert.equal(invalidUpload.status, 415);
    const tooLargeUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: imageHeaders, body: new Uint8Array(5 * 1024 * 1024 + 1) });
    assert.equal(tooLargeUpload.status, 413);
    const forgedJpeg = Buffer.alloc(24); forgedJpeg.set([0xff, 0xd8, 0xff]);
    const forgedUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: { ...imageHeaders, 'Content-Type': 'image/jpeg' }, body: forgedJpeg });
    assert.equal(forgedUpload.status, 415);
    const png = await sharp(imageBytes).resize(64).png().toBuffer();
    const truncatedUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: { ...imageHeaders, 'Content-Type': 'image/png' }, body: png.subarray(0, Math.floor(png.length * 0.8)) });
    assert.equal(truncatedUpload.status, 415, await truncatedUpload.text());
    const largePng = await sharp({ create: { width: 8001, height: 5000, channels: 3, background: '#123456' } }).png().toBuffer();
    const pixelLimitUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: { ...imageHeaders, 'Content-Type': 'image/png' }, body: largePng });
    assert.equal(pixelLimitUpload.status, 413);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poem_images').first()).n, 0);
    assert.equal((await (await mf.getR2Bucket('BUCKET')).list({ prefix: 'poem-images/' })).objects.length, 0);
    const upload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: imageHeaders, body: imageBytes });
    const uploadBody = await upload.json();
    assert.equal(upload.status, 201, JSON.stringify(uploadBody));
    assert.equal(uploadBody.image.id, imageId);
    assert.equal(uploadBody.image.file_name, 'Lumină de seară.webp');
    const retryUpload = await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: imageHeaders, body: imageBytes });
    assert.equal((await retryUpload.json()).image.id, imageId);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poem_images').first()).n, 1);
    const privateDraftImage = await mf.dispatchFetch(base + '/api/images/' + imageId);
    assert.equal(privateDraftImage.status, 404, 'Unattached uploads must not be public');
    const ownerImage = await mf.dispatchFetch(base + '/api/images/' + imageId, { headers: owner });
    assert.equal(ownerImage.status, 200);
    assert.equal(ownerImage.headers.get('content-type'), 'image/webp');
    assert.deepEqual(Buffer.from(await ownerImage.arrayBuffer()), imageBytes);
    const input = { id: '13941a33-ff28-4359-8951-3958514a2bd7', title: 'Poem de verificare', author: 'Autor de test', theme: 'Verificare', content: 'Versul întâi\nVersul al doilea\n\nStrofa a doua.', image_id: imageId, audio_ro_id: null, source_language: 'ro', translated_title: 'Verification Poem', translated_theme: 'Testing', translated_content: 'First line\nSecond line\n\nThe second stanza.' };
    const forbiddenTranslation = await mf.dispatchFetch(base + '/api/poems/translate', { method: 'POST', headers: { ...mutation, 'oai-authenticated-user-email': 'visitor@example.com' }, body: JSON.stringify(input) });
    assert.equal(forbiddenTranslation.status, 403);
    const crossSiteTranslation = await mf.dispatchFetch(base + '/api/poems/translate', { method: 'POST', headers: { ...mutation, Origin: 'https://other.example' }, body: JSON.stringify(input) });
    assert.equal(crossSiteTranslation.status, 403);
    const emptyTranslation = await mf.dispatchFetch(base + '/api/poems/translate', { method: 'POST', headers: mutation, body: JSON.stringify({ ...input, content: '' }) });
    assert.equal(emptyTranslation.status, 400);
    assert.equal(translationCalls, 0);
    const translated = await mf.dispatchFetch(base + '/api/poems/translate', { method: 'POST', headers: mutation, body: JSON.stringify(input) });
    const translatedBody = await translated.json();
    assert.equal(translated.status, 200, JSON.stringify(translatedBody));
    assert.equal(translatedBody.translation.translated_content, input.translated_content);
    assert.equal(translated.headers.get('cache-control'), 'private, no-store');
    assert.equal(translationCalls, 1);
    Object.assign(input, translatedBody.translation);
    failTranslation = true;
    const failedTranslation = await mf.dispatchFetch(base + '/api/poems/translate', { method: 'POST', headers: mutation, body: JSON.stringify(input) });
    assert.equal(failedTranslation.status, 503);
    assert.match((await failedTranslation.json()).error, /Textul rămâne în formular/);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poems').first()).n, 6, 'Translation does not create partial poems');
    const created = await mf.dispatchFetch(base + '/api/poems', { method: 'POST', headers: mutation, body: JSON.stringify(input) });
    const createdBody = await created.json();
    assert.equal(created.status, 201, JSON.stringify(createdBody));
    assert.equal(createdBody.poem.content, input.content);
    assert.equal(createdBody.poem.image_id, imageId);
    assert.equal(createdBody.poem.source_language, 'ro');
    assert.equal(createdBody.poem.translated_content, input.translated_content);
    assert.equal(createdBody.poem.audio_ro_id, null);
    // Public serving of already published legacy media is unchanged. Mutations
    // must still verify it, including clients that omit the audio fields.
    await db.prepare('UPDATE poems SET audio_ro_id=? WHERE id=?').bind(audioId,input.id).run();
    const legacyEdit={...input,revision:1}; delete legacyEdit.audio_ro_id;
    assert.equal((await mf.dispatchFetch(base+'/api/poems/'+input.id,{method:'PUT',headers:mutation,body:JSON.stringify(legacyEdit)})).status,503);
    const publicAudio = await mf.dispatchFetch(base + '/api/audio/' + audioId, { headers: { Range: 'bytes=44-299' } });
    assert.equal(publicAudio.status, 206);
    assert.equal(publicAudio.headers.get('Content-Range'), `bytes 44-299/${audioBytes.length}`);
    assert.deepEqual(Buffer.from(await publicAudio.arrayBuffer()), audioBytes.subarray(44, 300));
    const headAudio = await mf.dispatchFetch(base + '/api/audio/' + audioId, { method: 'HEAD' });
    assert.equal(headAudio.status, 200); assert.equal(headAudio.headers.get('Content-Length'), String(audioBytes.length));
    await db.prepare('UPDATE poems SET audio_ro_id=NULL WHERE id=?').bind(input.id).run();
    const attachedImage = await mf.dispatchFetch(base + '/api/images/' + imageId);
    assert.equal(attachedImage.status, 200);
    const home = await mf.dispatchFetch(base + '/');
    const homeHtml = await home.text();
    assert.match(homeHtml, /Poem de verificare/);
    assert.ok(homeHtml.includes('/api/images/' + imageId));
    assert.match(homeHtml, /class="card-cover"/);
    assert.doesNotMatch(homeHtml, /Verification Poem/, 'Only the selected language is sent in collection cards');
    const englishHome = await (await mf.dispatchFetch(base + '/?lang=en-US&q=Verification')).text();
    assert.match(englishHome, /Verification Poem/);
    assert.match(englishHome, /data-poem-id=/);
    // One resolution must reach the root layout, public header and metadata,
    // even when the request cookie disagrees or a caller supplies our header.
    for (const [query, headers, language, title] of [
      ['?lang=en-US', { Cookie: 'poetio-language=ro' }, 'en-US', 'Verification Poem'],
      ['?lang=ro', { Cookie: 'poetio-language=en-US' }, 'ro', 'Poem de verificare'],
      ['', { Cookie: 'poetio-language=en-US' }, 'en-US', 'Verification Poem'],
      ['?lang=de', { Cookie: 'poetio-language=en-US' }, 'en-US', 'Verification Poem'],
      ['?lang=en-US&lang=ro', {}, 'en-US', 'Verification Poem'],
      ['', { 'x-poetio-language': 'en-US' }, 'ro', 'Poem de verificare'],
    ]) {
      const response = await mf.dispatchFetch(base + '/poeme/' + input.id + query, { headers: { 'User-Agent': 'Poetio language test', ...headers } });
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, new RegExp(`<html[^>]* lang="${language}"`));
      assert.match(html, new RegExp(`<header[^>]* lang="${language}"`));
      assert.match(html, new RegExp(`<main[^>]* lang="${language}"`));
      const head = html.slice(0, html.indexOf('</head>'));
      assert.ok(head.includes(title));
      assert.match(head, new RegExp(`property="og:locale" content="${language === 'ro' ? 'ro_RO' : 'en_US'}"`));
      assert.ok(![...response.headers.keys()].some(name => name.startsWith('x-middleware-request-')), 'Request overrides are not exposed in the response');
    }
    const staleTranslation = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify({ ...input, title: 'Poem revizuit', revision: 1 }) });
    assert.equal(staleTranslation.status, 409, 'The API rejects an automatic translation tied to the previous title');
    const updated = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify({ ...input, author: 'Autor revizuit', revision: 1 }) });
    assert.equal(updated.status, 200);
    const updatedPoem = (await updated.json()).poem;
    assert.equal(updatedPoem.translated_content, input.translated_content);
    assert.equal(updatedPoem.revision, 2);
    assert.equal(updatedPoem.image_id, imageId);
    const staleDelete = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'DELETE', headers: mutation, body: JSON.stringify({ revision: 1 }) });
    assert.equal(staleDelete.status, 409);
    const missingImage = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify({ ...input, image_id: '5da5f55b-045e-4214-b562-607177b4b781', revision: 2 }) });
    assert.equal(missingImage.status, 400);
    const oldClient = { ...input, author: 'Autor dintr-o filă veche', revision: 2 };
    delete oldClient.image_id;
    const oldClientUpdate = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify(oldClient) });
    assert.equal((await oldClientUpdate.json()).poem.image_id, imageId, 'Older forms must not remove an image');
    const secondImageId = '793f38fa-a99f-4f3a-945e-1943f950ab93';
    await mf.dispatchFetch(base + '/api/images', { method: 'POST', headers: { ...imageHeaders, 'X-Upload-Id': secondImageId }, body: imageBytes });
    const replacement = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify({ ...input, image_id: secondImageId, revision: 3 }) });
    assert.equal((await replacement.json()).poem.image_id, secondImageId);
    assert.equal((await mf.dispatchFetch(base + '/api/images/' + imageId)).status, 404, 'Replaced images are private again');
    const reset = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify({ ...input, image_id: null, revision: 4 }) });
    assert.equal((await reset.json()).poem.image_id, null);
    assert.equal((await mf.dispatchFetch(base + '/api/images/' + secondImageId)).status, 404);
    const deleted = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'DELETE', headers: mutation, body: JSON.stringify({ revision: 5 }) });
    assert.equal(deleted.status, 200);
    assert.equal((await mf.dispatchFetch(base + '/api/audio/' + audioId)).status, 404);
    const finalList = await mf.dispatchFetch(base + '/api/poems', { headers: owner });
    assert.equal((await finalList.json()).poems.length, 6);
    const collectionIds = Array.from({ length: 25 }, (_, i) => `12345678-0000-4000-8000-${String(i).padStart(12, '0')}`);
    await db.batch(collectionIds.map((id, i) => db.prepare(`INSERT INTO poems(id,title,author,theme,content,source_language,translated_title,translated_content,revision,created_at,updated_at)
      VALUES(?,?,?,'Lumină',?,'ro',?,?,1,?,?)`).bind(id, `Colecție ${i}`, 'Autor', 'x'.repeat(29960) + ` ȘȚÂÎĂ FINAL_COLLECTION_${i}`, `Collection ${i}`, 'y'.repeat(29960) + ` worker English needle ${i}`, Date.now() + i, Date.now() + i)));
    const bounded = await (await mf.dispatchFetch(base + '/')).text();
    assert.equal((bounded.match(/ data-poem-id="/g) ?? []).length, 12);
    assert.ok(Buffer.byteLength(bounded) < 100000);
    assert.doesNotMatch(bounded, /FINAL_COLLECTION_|worker English needle/);
    const matched = await (await mf.dispatchFetch(base + '/?q=staia&theme=LUMINA&translation=with&page=3')).text();
    assert.equal((matched.match(/ data-poem-id="/g) ?? []).length, 1);
    assert.match(matched, /Colecție 24/);
    const translatedMatch = await (await mf.dispatchFetch(base + '/?q=worker%20English%20needle%2024&lang=en-US')).text();
    assert.match(translatedMatch, /Collection 24/);
  } finally { await mf.dispose(); }
});
