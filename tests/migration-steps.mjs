// The per-migration scripts these tests used are gone; scripts/migrate.mjs applies
// the same SQL. Each helper migrates up to one migration and reports whether it
// applied it now (true) or found it already applied (false), as the old scripts did.
import { migrate } from '../scripts/migrate.mjs';

const step = target => async file => (await migrate(file, { target })).applied.includes(target);

export const migrateAudioDatabase = step('0003_uploaded_audio');
export const migrateCommentsDatabase = step('0004_reader_comments');
export const migrateAboutCommentsDatabase = step('0005_about_comments');
export const migrateVideoDatabase = step('0006_video_collection');
export const migrateVideoCommentsDatabase = step('0007_video_comments');
export const migrateBookDatabase = step('0008_book_collection');
export const migrateBookCommentsDatabase = step('0009_book_comments');
export const migrateCommentModeration = step('0010_comment_moderation');
export const migrateEditorial = step('0011_editorial_recovery');
export const migrateBookText = step('0012_book_page_texts');
export const migrateBookEditorial = step('0013_book_editorial_recovery');
export const migratePoemCollection = step('0014_poem_collection_order');
export const migrateTranslationProvenance = step('0015_translation_provenance');
export const migrateBookTextRecovery = step('0016_book_text_recovery');
export const migrateSearch = step('0017_search_indexes');
export const migrateSearchNormalization = step('0018_search_normalization');
export const migrateBookCovers = step('0019_book_purchase_covers');
export const migratePoemSearchNfc = step('0020_poem_search_nfc');
