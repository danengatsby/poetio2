CREATE INDEX idx_content_drafts_entity ON content_drafts (kind, entity_id, created_at, id);
--> statement-breakpoint
INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
SELECT 'book-text', file_id || ':' || page, revision, 'initial', 'Pagina ' || page,
json_object('fileId', file_id, 'page', page, 'text', content, 'language', language, 'revision', revision),
CAST(strftime('%s','now') AS INTEGER)*1000 FROM book_page_texts;
--> statement-breakpoint
CREATE TRIGGER history_book_text_insert AFTER INSERT ON book_page_texts BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book-text', NEW.file_id || ':' || NEW.page, NEW.revision, 'saved', 'Pagina ' || NEW.page,
    json_object('fileId', NEW.file_id, 'page', NEW.page, 'text', NEW.content, 'language', NEW.language, 'revision', NEW.revision),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_text_update AFTER UPDATE ON book_page_texts BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book-text', NEW.file_id || ':' || NEW.page, NEW.revision, 'saved', 'Pagina ' || NEW.page,
    json_object('fileId', NEW.file_id, 'page', NEW.page, 'text', NEW.content, 'language', NEW.language, 'revision', NEW.revision),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_text_delete AFTER DELETE ON book_page_texts BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book-text', OLD.file_id || ':' || OLD.page, OLD.revision, 'deleted', 'Pagina ' || OLD.page,
    json_object('fileId', OLD.file_id, 'page', OLD.page, 'text', OLD.content, 'language', OLD.language, 'revision', OLD.revision),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
