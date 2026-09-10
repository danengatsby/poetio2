import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';

test('built Worker protects administration and persists API changes into the rendered collection', { timeout: 45000 }, async () => {
  let translationCalls = 0;
  let failTranslation = false;
  const mf = new Miniflare({
    modules: true,
    scriptPath: new URL('../dist/server/index.js', import.meta.url).pathname,
    modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
    compatibilityDate: '2026-05-22',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    r2Buckets: ['BUCKET'],
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
  });
  const base = 'https://stillword.test';
  const owner = { 'oai-authenticated-user-email': 'pensio53@gmail.com' };
  const mutation = { ...owner, 'Content-Type': 'application/json', Origin: base };
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
      const sql = readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8');
      await db.batch(sql.split('--> statement-breakpoint').map(statement => db.prepare(statement.trim())));
    }
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
    const input = { id: '13941a33-ff28-4359-8951-3958514a2bd7', title: 'Poem de verificare', author: 'Autor de test', theme: 'Verificare', content: 'Versul întâi\nVersul al doilea\n\nStrofa a doua.', image_id: imageId, source_language: 'ro', translated_title: 'Verification Poem', translated_theme: 'Testing', translated_content: 'First line\nSecond line\n\nThe second stanza.' };
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
    const attachedImage = await mf.dispatchFetch(base + '/api/images/' + imageId);
    assert.equal(attachedImage.status, 200);
    const home = await mf.dispatchFetch(base + '/');
    const homeHtml = await home.text();
    assert.match(homeHtml, /Poem de verificare/);
    assert.ok(homeHtml.includes('/api/images/' + imageId));
    assert.match(homeHtml, /class="card-cover"/);
    assert.match(homeHtml, /Verification Poem/);
    const updated = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify({ ...input, title: 'Poem revizuit', revision: 1 }) });
    assert.equal(updated.status, 200);
    const updatedPoem = (await updated.json()).poem;
    assert.equal(updatedPoem.translated_content, input.translated_content);
    assert.equal(updatedPoem.revision, 2);
    assert.equal(updatedPoem.image_id, imageId);
    const staleDelete = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'DELETE', headers: mutation, body: JSON.stringify({ revision: 1 }) });
    assert.equal(staleDelete.status, 409);
    const missingImage = await mf.dispatchFetch(base + '/api/poems/' + input.id, { method: 'PUT', headers: mutation, body: JSON.stringify({ ...input, image_id: '5da5f55b-045e-4214-b562-607177b4b781', revision: 2 }) });
    assert.equal(missingImage.status, 400);
    const oldClient = { ...input, title: 'Poem dintr-o filă veche', revision: 2 };
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
    const finalList = await mf.dispatchFetch(base + '/api/poems', { headers: owner });
    assert.equal((await finalList.json()).poems.length, 6);
  } finally { await mf.dispose(); }
});
