ALTER TABLE books ADD COLUMN image_2_id text REFERENCES poem_images(id);
--> statement-breakpoint
ALTER TABLE books ADD COLUMN purchase_url_1 text;
--> statement-breakpoint
ALTER TABLE books ADD COLUMN purchase_url_2 text;
--> statement-breakpoint
CREATE INDEX idx_books_image_2_id ON books(image_2_id);
--> statement-breakpoint
DROP TRIGGER history_book_insert;
--> statement-breakpoint
DROP TRIGGER history_book_update;
--> statement-breakpoint
DROP TRIGGER history_book_delete;
--> statement-breakpoint
CREATE TRIGGER history_book_insert AFTER INSERT ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', NEW.id, NEW.revision, 'saved', NEW.title,
    json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'image_id', NEW.image_id, 'image_2_id', NEW.image_2_id, 'purchase_url_1', NEW.purchase_url_1, 'purchase_url_2', NEW.purchase_url_2, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_update AFTER UPDATE ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', NEW.id, NEW.revision, 'saved', NEW.title,
    json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'image_id', NEW.image_id, 'image_2_id', NEW.image_2_id, 'purchase_url_1', NEW.purchase_url_1, 'purchase_url_2', NEW.purchase_url_2, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_delete AFTER DELETE ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', OLD.id, OLD.revision, 'deleted', OLD.title,
    json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'description', OLD.description, 'file_id', OLD.file_id, 'image_id', OLD.image_id, 'image_2_id', OLD.image_2_id, 'purchase_url_1', OLD.purchase_url_1, 'purchase_url_2', OLD.purchase_url_2, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
INSERT INTO collection_meta (key, value) VALUES ('book_purchase_covers_v1', 'complete');
