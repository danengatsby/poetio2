CREATE TABLE `book_search_pages` (
	`file_id` text NOT NULL,
	`page` integer NOT NULL,
	`content` text NOT NULL,
	`search_text` text NOT NULL,
	`source` text NOT NULL,
	`revision` integer NOT NULL,
	PRIMARY KEY(`file_id`, `page`),
	FOREIGN KEY (`file_id`) REFERENCES `book_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_search_state` (
	`file_id` text PRIMARY KEY NOT NULL,
	`pages` integer NOT NULL,
	`scanned` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'preparing' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `book_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poem_search` (
	`poem_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`theme` text NOT NULL,
	`content` text NOT NULL,
	`translated_title` text NOT NULL,
	`translated_theme` text NOT NULL,
	`translated_content` text NOT NULL,
	FOREIGN KEY (`poem_id`) REFERENCES `poems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE VIRTUAL TABLE poem_search_fts USING fts5(title, author, theme, content, translated_title, translated_theme, translated_content, content='poem_search', content_rowid='rowid', tokenize='trigram case_sensitive 1');
--> statement-breakpoint
CREATE TRIGGER poem_search_fts_insert AFTER INSERT ON poem_search BEGIN
  INSERT INTO poem_search_fts(rowid, title, author, theme, content, translated_title, translated_theme, translated_content) VALUES (NEW.rowid, NEW.title, NEW.author, NEW.theme, NEW.content, NEW.translated_title, NEW.translated_theme, NEW.translated_content);
END;
--> statement-breakpoint
CREATE TRIGGER poem_search_fts_delete AFTER DELETE ON poem_search BEGIN
  INSERT INTO poem_search_fts(poem_search_fts, rowid, title, author, theme, content, translated_title, translated_theme, translated_content) VALUES ('delete', OLD.rowid, OLD.title, OLD.author, OLD.theme, OLD.content, OLD.translated_title, OLD.translated_theme, OLD.translated_content);
END;
--> statement-breakpoint
CREATE TRIGGER poem_search_fts_update AFTER UPDATE ON poem_search BEGIN
  INSERT INTO poem_search_fts(poem_search_fts, rowid, title, author, theme, content, translated_title, translated_theme, translated_content) VALUES ('delete', OLD.rowid, OLD.title, OLD.author, OLD.theme, OLD.content, OLD.translated_title, OLD.translated_theme, OLD.translated_content);
  INSERT INTO poem_search_fts(rowid, title, author, theme, content, translated_title, translated_theme, translated_content) VALUES (NEW.rowid, NEW.title, NEW.author, NEW.theme, NEW.content, NEW.translated_title, NEW.translated_theme, NEW.translated_content);
END;
--> statement-breakpoint
CREATE TRIGGER poem_search_insert AFTER INSERT ON poems BEGIN
  INSERT INTO poem_search (poem_id, title, author, theme, content, translated_title, translated_theme, translated_content) VALUES (NEW.id, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.title, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.author, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.theme, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.translated_title, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.translated_theme, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.translated_content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't')) ON CONFLICT(poem_id) DO UPDATE SET title = excluded.title, author = excluded.author, theme = excluded.theme, content = excluded.content, translated_title = excluded.translated_title, translated_theme = excluded.translated_theme, translated_content = excluded.translated_content;
END;
--> statement-breakpoint
CREATE TRIGGER poem_search_update AFTER UPDATE OF title, author, theme, content, translated_title, translated_theme, translated_content ON poems BEGIN
  INSERT INTO poem_search (poem_id, title, author, theme, content, translated_title, translated_theme, translated_content) VALUES (NEW.id, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.title, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.author, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.theme, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.translated_title, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.translated_theme, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.translated_content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't')) ON CONFLICT(poem_id) DO UPDATE SET title = excluded.title, author = excluded.author, theme = excluded.theme, content = excluded.content, translated_title = excluded.translated_title, translated_theme = excluded.translated_theme, translated_content = excluded.translated_content;
END;
--> statement-breakpoint
INSERT INTO poem_search (poem_id, title, author, theme, content, translated_title, translated_theme, translated_content) SELECT id, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(title, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(author, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(theme, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(translated_title, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(translated_theme, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(translated_content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't') FROM poems;
--> statement-breakpoint
CREATE VIRTUAL TABLE book_search_fts USING fts5(search_text, content='book_search_pages', content_rowid='rowid', tokenize='trigram case_sensitive 1');
--> statement-breakpoint
CREATE TRIGGER book_search_pages_fts_insert AFTER INSERT ON book_search_pages BEGIN
  INSERT INTO book_search_fts(rowid, search_text) VALUES (NEW.rowid, NEW.search_text);
END;
--> statement-breakpoint
CREATE TRIGGER book_search_pages_fts_delete AFTER DELETE ON book_search_pages BEGIN
  INSERT INTO book_search_fts(book_search_fts, rowid, search_text) VALUES ('delete', OLD.rowid, OLD.search_text);
END;
--> statement-breakpoint
CREATE TRIGGER book_search_pages_fts_update AFTER UPDATE ON book_search_pages BEGIN
  INSERT INTO book_search_fts(book_search_fts, rowid, search_text) VALUES ('delete', OLD.rowid, OLD.search_text);
  INSERT INTO book_search_fts(rowid, search_text) VALUES (NEW.rowid, NEW.search_text);
END;
--> statement-breakpoint
CREATE TRIGGER book_search_text_insert AFTER INSERT ON book_page_texts BEGIN
  INSERT INTO book_search_pages (file_id, page, content, search_text, source, revision) VALUES (NEW.file_id, NEW.page, NEW.content, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), 'edited', NEW.revision) ON CONFLICT(file_id, page) DO UPDATE SET content=excluded.content, search_text=excluded.search_text, source='edited', revision=excluded.revision;
END;
--> statement-breakpoint
CREATE TRIGGER book_search_text_update AFTER UPDATE ON book_page_texts BEGIN
  INSERT INTO book_search_pages (file_id, page, content, search_text, source, revision) VALUES (NEW.file_id, NEW.page, NEW.content, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(NEW.content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), 'edited', NEW.revision) ON CONFLICT(file_id, page) DO UPDATE SET content=excluded.content, search_text=excluded.search_text, source='edited', revision=excluded.revision;
END;
--> statement-breakpoint
CREATE TRIGGER book_search_text_delete AFTER DELETE ON book_page_texts BEGIN
  DELETE FROM book_search_pages WHERE file_id=OLD.file_id AND page=OLD.page;
  UPDATE book_search_state SET scanned=min(scanned, OLD.page-1), status='preparing' WHERE file_id=OLD.file_id;
END;
--> statement-breakpoint
INSERT INTO book_search_pages (file_id, page, content, search_text, source, revision) SELECT file_id, page, content, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(coalesce(content, '')), 'Ă', 'a'), 'ă', 'a'), 'Â', 'a'), 'â', 'a'), 'Î', 'i'), 'î', 'i'), 'Ș', 's'), 'ș', 's'), 'Ş', 's'), 'ş', 's'), 'Ț', 't'), 'ț', 't'), 'Ţ', 't'), 'ţ', 't'), 'edited', revision FROM book_page_texts;
