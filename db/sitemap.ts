import { ensureInitialPoems, ensureLanguageVariants, type Database } from './poems';
import { present } from './poem-collection';
import { EXTRA_LANGUAGES, isExtraLanguage, type SiteLanguage } from '../lib/poem-types';
import { SITE_LANGUAGES } from '../lib/site-language';

/** A public page; `languages` lists its language versions, or is null for a page with one address (books). */
export type SitemapEntry = { path: string; updated: number; languages: readonly SiteLanguage[] | null };

export async function sitemapEntries(db: Database): Promise<SitemapEntry[]> {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  // Which versions exist is decided inside SQLite, so poem texts never leave it here.
  const poems = await db
    .prepare(
      `SELECT id, updated_at AS updated, source_language, ${present('translated')} AS has_translated,
    ${EXTRA_LANGUAGES.map(language => `${present(language)} AS has_${language}`).join(', ')}
    FROM poems`,
    )
    .all<{ id: string; updated: number; source_language: string } & Record<`has_${string}`, number>>();
  const others = await db
    .prepare(
      `SELECT '/video/' || id AS path, updated_at AS updated, 1 AS translated_interface FROM videos
    UNION ALL SELECT '/carti/' || id AS path, updated_at AS updated, 0 AS translated_interface FROM books`,
    )
    .all<{ path: string; updated: number; translated_interface: number }>();
  return [
    ...['/', '/video', '/carti', '/autor'].map(path => ({ path, updated: 0, languages: SITE_LANGUAGES })),
    ...poems.results.map(poem => ({
      path: '/poeme/' + poem.id,
      updated: poem.updated,
      languages: SITE_LANGUAGES.filter(language =>
        isExtraLanguage(language)
          ? Boolean(poem[`has_${language}`])
          : language === poem.source_language || Boolean(poem.has_translated),
      ),
    })),
    // Video pages exist in every interface language; a book keeps one address (see its page's metadata).
    ...others.results.map(({ path, updated, translated_interface }) => ({
      path,
      updated,
      languages: translated_interface ? SITE_LANGUAGES : null,
    })),
  ];
}
