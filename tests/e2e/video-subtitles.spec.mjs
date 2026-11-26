import { test, expect } from './test.mjs';
import { OWNER_EMAIL } from './fixture.mjs';
import { readFileSync } from 'node:fs';

test('an editor publishes, revises and removes subtitles on two films', async ({ page, request, baseURL }) => {
  const owner = { 'oai-authenticated-user-email': OWNER_EMAIL, Origin: baseURL };
  const file = crypto.randomUUID();
  const upload = await request.post('/api/video-files', {
    headers: { ...owner, 'Content-Type': 'video/mp4', 'X-File-Name': 'clip.mp4', 'X-Upload-Id': file },
    data: readFileSync(new URL('../fixtures/media/clip.mp4', import.meta.url)),
  });
  expect(upload.status()).toBe(201);
  for (const lang of ['ro', 'it']) {
    const id = crypto.randomUUID(),
      title = 'Film test ' + lang;
    const data = {
      id,
      title,
      author: 'Editor',
      description: '',
      file_id: file,
      subtitle_language: lang,
      subtitle_text: 'WEBVTT\n\n00:00.000 --> 00:01.000\nVers',
    };
    await expect.poll(async () => (await request.post('/api/videos', { headers: owner, data })).status()).toBe(201);
    await page.goto('/video/' + id);
    await expect(page.locator('track')).toHaveAttribute('srclang', lang);
    await page.goto('/video');
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.locator('dialog track, [role=dialog] track')).toHaveAttribute(
      'src',
      '/api/videos/' + id + '/subtitles',
    );
    await page.setExtraHTTPHeaders({ 'oai-authenticated-user-email': OWNER_EMAIL });
    await page.goto('/admin/video');
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await page.getByLabel('Subtitrare WebVTT').fill(data.subtitle_text.replace('Vers', 'Vers revizuit'));
    await page.getByRole('button', { name: 'Previzualizare ca cititor' }).click();
    await expect(page.getByRole('dialog').locator('track')).toHaveAttribute('src', /^blob:/);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Înapoi la editor/ })
      .click();
    await page.getByRole('button', { name: 'Salvează video' }).click();
    await expect
      .poll(async () => (await request.get('/api/videos/' + id + '/subtitles')).text())
      .toContain('Vers revizuit');
    await page.getByLabel('Subtitrare WebVTT').fill('');
    await page.getByRole('button', { name: 'Salvează video' }).click();
    await expect.poll(async () => (await request.get('/api/videos/' + id + '/subtitles')).status()).toBe(404);
    expect((await request.delete('/api/videos/' + id, { headers: owner, data: { revision: 3 } })).ok()).toBe(true);
  }
});
