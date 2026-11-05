ALTER TABLE poems ADD COLUMN translation_provenance text;
--> statement-breakpoint
DROP TRIGGER history_poem_insert;
--> statement-breakpoint
CREATE TRIGGER history_poem_insert AFTER INSERT ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id, 'translation_provenance', json(NEW.translation_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
DROP TRIGGER history_poem_update;
--> statement-breakpoint
CREATE TRIGGER history_poem_update AFTER UPDATE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id, 'translation_provenance', json(NEW.translation_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
DROP TRIGGER history_poem_delete;
--> statement-breakpoint
CREATE TRIGGER history_poem_delete AFTER DELETE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', OLD.id, OLD.revision, 'deleted', OLD.title, json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'theme', OLD.theme, 'content', OLD.content, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'image_id', OLD.image_id, 'source_language', OLD.source_language, 'translated_title', OLD.translated_title, 'translated_theme', OLD.translated_theme, 'translated_content', OLD.translated_content, 'audio_ro_id', OLD.audio_ro_id, 'audio_en_id', OLD.audio_en_id, 'translation_provenance', json(OLD.translation_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
