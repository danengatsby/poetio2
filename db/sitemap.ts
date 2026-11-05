import { ensureInitialPoems, ensureLanguageVariants, type Database } from './poems';

export async function sitemapEntries(db: Database) {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  const { results } = await db.prepare(`SELECT '/poeme/' || id AS path, updated_at AS updated FROM poems
    UNION ALL SELECT '/video/' || id AS path, updated_at AS updated FROM videos
    UNION ALL SELECT '/carti/' || id AS path, updated_at AS updated FROM books`).all<{ path: string; updated: number }>();
  return [...['/', '/video', '/carti', '/autor'].map(path => ({ path, updated: 0 })), ...results];
}
