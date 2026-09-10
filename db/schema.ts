import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
  imageId: text('image_id').references(() => poemImages.id),
  revision: integer('revision').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_poems_image_id').on(table.imageId)]);

export const collectionMeta = sqliteTable('collection_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
