# Poetio

Poetry collection with an owner-only administration page at `/admin`.

The six original poems are seeded once into D1. Poems use prepared statements and revision checks, and edits preserve line breaks. Authentication is supplied by Sites and verified against the owner on the server.

The poem reader has Romanian and American English tabs. Saving a Romanian poem without a complete English version requests an American English translation of its title, theme, and verses, then saves both versions together. Changing the Romanian original refreshes the translation unless it was also revised manually. Generated text stays in the editor if a later save fails, so retries reuse the exact translation. Translation failures retain the draft and offer an explicit original-only save. English originals still accept manually entered Romanian translations. Images are shared by both versions and uploaded to R2.

Automatic translation requires the secret runtime variable `OPENAI_API_KEY` in Sites. `OPENAI_TRANSLATION_MODEL` optionally overrides the default `gpt-4.1-mini`. Configure runtime values with the Sites environment tool, then deploy a saved version to apply them. Never commit credentials or expose them to the browser. The admin page shows whether the runtime credential is configured; absence is not reported as successful activation.

The owner-only `/api/poems/translate` endpoint uses the [OpenAI Responses API with Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Requests are not stored by the Responses API (`store: false`); only the title, theme, and poem lines are submitted. Blank lines, line count, and indentation are validated before saving. Provider refusal, timeout, or invalid structure leaves the original untouched. Existing poems retain their already saved translations.

- `npm run build`: build the Worker and client assets.
- `npm run db:generate`: generate schema-only migrations.
- `node --test tests/poems.test.mjs`: verify persistence, authorization, validation, safe retries, and revision conflicts.
- `node --test tests/worker.test.mjs`: verify the built Worker, bilingual persistence, and image upload with local D1 and R2.

`.openai/hosting.json` retains the original Site identity and declares the logical `DB` and `BUCKET` bindings.
