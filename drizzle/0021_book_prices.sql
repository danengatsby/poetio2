ALTER TABLE `books` ADD `price_1` text;--> statement-breakpoint
ALTER TABLE `books` ADD `price_2` text;
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
    json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'image_id', NEW.image_id, 'image_2_id', NEW.image_2_id, 'purchase_url_1', NEW.purchase_url_1, 'purchase_url_2', NEW.purchase_url_2, 'price_1', NEW.price_1, 'price_2', NEW.price_2, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_update AFTER UPDATE ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', NEW.id, NEW.revision, 'saved', NEW.title,
    json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'image_id', NEW.image_id, 'image_2_id', NEW.image_2_id, 'purchase_url_1', NEW.purchase_url_1, 'purchase_url_2', NEW.purchase_url_2, 'price_1', NEW.price_1, 'price_2', NEW.price_2, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER history_book_delete AFTER DELETE ON books BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at)
  VALUES ('book', OLD.id, OLD.revision, 'deleted', OLD.title,
    json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'description', OLD.description, 'file_id', OLD.file_id, 'image_id', OLD.image_id, 'image_2_id', OLD.image_2_id, 'purchase_url_1', OLD.purchase_url_1, 'purchase_url_2', OLD.purchase_url_2, 'price_1', OLD.price_1, 'price_2', OLD.price_2, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at),
    CAST(strftime('%s','now') AS INTEGER)*1000);
END;
