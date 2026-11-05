INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
SELECT 'book', id, revision, 'initial', title,
  json_object('id', id, 'title', title, 'author', author, 'description', description, 'file_id', file_id, 'image_id', image_id, 'revision', revision, 'created_at', created_at, 'updated_at', updated_at),
  CAST(strftime('%s','now') AS INTEGER)*1000 FROM books;
--> statement-breakpoint
CREATE TRIGGER history_book_insert AFTER INSERT ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', NEW.id, NEW.revision, 'saved', NEW.title,
    json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'image_id', NEW.image_id, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_update AFTER UPDATE ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', NEW.id, NEW.revision, 'saved', NEW.title,
    json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'image_id', NEW.image_id, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_delete AFTER DELETE ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', OLD.id, OLD.revision, 'deleted', OLD.title,
    json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'description', OLD.description, 'file_id', OLD.file_id, 'image_id', OLD.image_id, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
