import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const poemImages = sqliteTable('poem_images', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  contentHash: text('content_hash').notNull(),
  ownerEmail: text('owner_email').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const poemAudio = sqliteTable('poem_audio', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  contentHash: text('content_hash').notNull(),
  ownerEmail: text('owner_email').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const poems = sqliteTable('poems', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  theme: text('theme').notNull().default(''),
  content: text('content').notNull(),
  sourceLanguage: text('source_language').notNull().default('ro'),
  translatedTitle: text('translated_title'),
  translatedTheme: text('translated_theme'),
  translatedContent: text('translated_content'),
  translationProvenance: text('translation_provenance'),
  imageId: text('image_id').references(() => poemImages.id),
  audioRoId: text('audio_ro_id').references(() => poemAudio.id),
  audioEnId: text('audio_en_id').references(() => poemAudio.id),
  revision: integer('revision').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_poems_collection_order').on(table.createdAt, table.id), index('idx_poems_image_id').on(table.imageId), index('idx_poems_audio_ro_id').on(table.audioRoId), index('idx_poems_audio_en_id').on(table.audioEnId)]);

export const poemComments = sqliteTable('poem_comments', {
  id: text('id').primaryKey(),
  poemId: text('poem_id').notNull().references(() => poems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'hidden'] }).notNull().default('pending'),
  revision: integer('revision').notNull().default(1),
  moderatedAt: integer('moderated_at'),
}, (table) => [index('idx_poem_comments_status_created').on(table.status, table.createdAt, table.id), index('idx_poem_comments_poem_created').on(table.poemId, table.createdAt, table.id)]);

export const aboutComments = sqliteTable('about_comments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'hidden'] }).notNull().default('pending'),
  revision: integer('revision').notNull().default(1),
  moderatedAt: integer('moderated_at'),
}, (table) => [index('idx_about_comments_status_created').on(table.status, table.createdAt, table.id), index('idx_about_comments_created').on(table.createdAt, table.id)]);

export const collectionMeta = sqliteTable('collection_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});


export const videoFiles = sqliteTable('video_files', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  contentHash: text('content_hash').notNull(),
  ownerEmail: text('owner_email').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull().default(''),
  description: text('description').notNull().default(''),
  fileId: text('file_id').notNull().references(() => videoFiles.id),
  revision: integer('revision').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_videos_file_id').on(table.fileId)]);

export const videoComments = sqliteTable('video_comments', {
  id: text('id').primaryKey(),
  videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'hidden'] }).notNull().default('pending'),
  revision: integer('revision').notNull().default(1),
  moderatedAt: integer('moderated_at'),
}, (table) => [index('idx_video_comments_status_created').on(table.status, table.createdAt, table.id), index('idx_video_comments_video_created').on(table.videoId, table.createdAt, table.id)]);

export const bookFiles = sqliteTable('book_files', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  contentHash: text('content_hash').notNull(),
  ownerEmail: text('owner_email').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull().default(''),
  description: text('description').notNull().default(''),
  fileId: text('file_id').notNull().references(() => bookFiles.id),
  imageId: text('image_id').references(() => poemImages.id),
  image2Id: text('image_2_id').references(() => poemImages.id),
  purchaseUrl1: text('purchase_url_1'),
  purchaseUrl2: text('purchase_url_2'),
  revision: integer('revision').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_books_file_id').on(table.fileId), index('idx_books_image_id').on(table.imageId), index('idx_books_image_2_id').on(table.image2Id)]);

export const bookPageTexts = sqliteTable('book_page_texts', {
  fileId: text('file_id').notNull().references(() => bookFiles.id, { onDelete: 'cascade' }),
  page: integer('page').notNull(),
  content: text('content').notNull(),
  language: text('language').notNull().default('und'),
  revision: integer('revision').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.fileId, table.page] })]);

export const bookComments = sqliteTable('book_comments', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'hidden'] }).notNull().default('pending'),
  revision: integer('revision').notNull().default(1),
  moderatedAt: integer('moderated_at'),
}, (table) => [index('idx_book_comments_status_created').on(table.status, table.createdAt, table.id), index('idx_book_comments_book_created').on(table.bookId, table.createdAt, table.id)]);

// No foreign key to published records: history survives removal from a collection.
export const contentHistory = sqliteTable('content_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(),
  entityId: text('entity_id').notNull(),
  revision: integer('revision').notNull(),
  event: text('event').notNull(),
  title: text('title').notNull(),
  snapshot: text('snapshot').notNull(),
  recordedAt: integer('recorded_at').notNull(),
}, table => [index('idx_content_history_entity').on(table.kind, table.entityId, table.id)]);

export const contentDrafts = sqliteTable('content_drafts', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  entityId: text('entity_id').notNull(),
  title: text('title').notNull(),
  snapshot: text('snapshot').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('idx_content_drafts_created').on(table.kind, table.createdAt, table.id), index('idx_content_drafts_entity').on(table.kind, table.entityId, table.createdAt, table.id)]);

// Materialized projections; custom migration triggers maintain the FTS5 indexes.
export const searchFoldCharacters = sqliteTable('search_fold_characters', {
  letter: text('letter').primaryKey().notNull(),
  replacement: text('replacement').notNull(),
});

export const poemSearch = sqliteTable('poem_search', {
  poemId: text('poem_id').primaryKey().references(() => poems.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  author: text('author').notNull(),
  theme: text('theme').notNull(),
  content: text('content').notNull(),
  translatedTitle: text('translated_title').notNull(),
  translatedTheme: text('translated_theme').notNull(),
  translatedContent: text('translated_content').notNull(),
});

export const bookSearchPages = sqliteTable('book_search_pages', {
  fileId: text('file_id').notNull().references(() => bookFiles.id, { onDelete: 'cascade' }),
  page: integer('page').notNull(),
  content: text('content').notNull(),
  searchText: text('search_text').notNull(),
  source: text('source').notNull(),
  revision: integer('revision').notNull(),
}, table => [primaryKey({ columns: [table.fileId, table.page] })]);

export const bookSearchState = sqliteTable('book_search_state', {
  fileId: text('file_id').primaryKey().references(() => bookFiles.id, { onDelete: 'cascade' }),
  pages: integer('pages').notNull(),
  scanned: integer('scanned').notNull().default(0),
  status: text('status').notNull().default('preparing'),
  updatedAt: integer('updated_at').notNull(),
});
