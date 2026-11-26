import { test, expect } from './test.mjs';
import { fixturePoems, OWNER_EMAIL } from './fixture.mjs';
import { wavFixture } from '../audio-fixture.mjs';

test('the editor previews and publishes a separate recording for each extra language', async ({
  page,
  browser,
  baseURL,
}) => {
  const languages = [
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['es', 'Español'],
    ['it', 'Italiano'],
  ];
  await page.setExtraHTTPHeaders({ 'oai-authenticated-user-email': OWNER_EMAIL });
  const openEditor = async () => {
    await page.goto('/admin');
    await page.getByRole('button', { name: new RegExp(fixturePoems[0].title) }).click();
  };
  const save = async () => {
    const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('/api/poems/'));
    await page.getByRole('button', { name: 'Salvează modificările' }).click();
    const response = await saved;
    expect(response.status()).toBe(200);
    return (await response.json()).poem;
  };
  await openEditor();
  await expect(page.locator('.audio-editor input[type=file]')).toHaveCount(6);
  for (const [index, [lang]] of languages.entries()) {
    await page
      .locator('#audio_' + lang + '_id')
      .setInputFiles({ name: lang + '.wav', mimeType: 'audio/wav', buffer: wavFixture(8000, 220 + 50 * index) });
  }
  await page.getByRole('button', { name: 'Previzualizare ca cititor' }).click();
  const preview = page.getByRole('dialog');
  for (const [, name] of languages) {
    await preview.getByRole('radio', { name }).click();
    await expect(preview.locator('audio')).toHaveAttribute('src', /^blob:/);
  }
  await preview.getByRole('button', { name: 'Înapoi la editor' }).click();
  const poem = await save();
  expect(poem.translated_title).toBe(fixturePoems[0].translated_title);
  expect(poem.translated_content).toBe(fixturePoems[0].translated_content);
  expect(poem.translation_provenance).toBeNull();
  const reader = await browser.newPage({ baseURL });
  try {
    const ids = new Set();
    for (const [lang] of languages) {
      const id = poem['audio_' + lang + '_id'];
      ids.add(id);
      expect(id).toBeTruthy();
      await reader.goto('/?poem=' + poem.id + '&lang=' + lang);
      await expect(reader.locator('#selected-poem audio')).toHaveAttribute('src', '/api/audio/' + id);
      await reader.goto('/poeme/' + poem.id + '?lang=' + lang);
      await expect(reader.locator('.poem-reading audio')).toHaveAttribute('src', '/api/audio/' + id);
      expect((await reader.request.get('/api/audio/' + id, { headers: { Range: 'bytes=0-43' } })).status()).toBe(206);
    }
    expect(ids.size).toBe(4);
    await openEditor();
    await page
      .locator('.audio-upload-field')
      .filter({ has: page.locator('#audio_fr_id') })
      .getByRole('button', { name: 'Elimină înregistrarea' })
      .click();
    const updated = await save();
    expect(updated.audio_fr_id).toBeNull();
    expect(updated.audio_ro_id).toBe(poem.audio_ro_id);
    for (const [lang] of languages.slice(1))
      expect(updated['audio_' + lang + '_id']).toBe(poem['audio_' + lang + '_id']);
    expect((await reader.request.get('/api/audio/' + poem.audio_fr_id)).status()).toBe(404);
    await reader.goto('/poeme/' + poem.id + '?lang=fr');
    await expect(reader.locator('.poem-reading audio')).toHaveAttribute('src', '/api/audio/' + poem.audio_ro_id);
  } finally {
    await reader.close();
  }
});
