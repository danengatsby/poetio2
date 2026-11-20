CREATE TABLE poem_search_pending (
  poem_id TEXT PRIMARY KEY NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
  token TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER poem_search_pending_insert AFTER INSERT ON poems BEGIN
  INSERT INTO poem_search_pending(poem_id, token) VALUES (NEW.id, hex(randomblob(16)))
  ON CONFLICT(poem_id) DO UPDATE SET token=excluded.token;
END;
--> statement-breakpoint
CREATE TRIGGER poem_search_pending_update AFTER UPDATE OF title, author, theme, content, translated_title, translated_theme, translated_content ON poems BEGIN
  INSERT INTO poem_search_pending(poem_id, token) VALUES (NEW.id, hex(randomblob(16)))
  ON CONFLICT(poem_id) DO UPDATE SET token=excluded.token;
END;
--> statement-breakpoint
INSERT INTO poem_search_pending(poem_id, token) SELECT id, hex(randomblob(16)) FROM poems;
