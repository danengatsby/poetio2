ALTER TABLE `poems` ADD `audio_fr_id` text REFERENCES poem_audio(id);--> statement-breakpoint
ALTER TABLE `poems` ADD `audio_de_id` text REFERENCES poem_audio(id);--> statement-breakpoint
ALTER TABLE `poems` ADD `audio_es_id` text REFERENCES poem_audio(id);--> statement-breakpoint
ALTER TABLE `poems` ADD `audio_it_id` text REFERENCES poem_audio(id);--> statement-breakpoint
CREATE INDEX `idx_poems_audio_fr_id` ON `poems` (`audio_fr_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_audio_de_id` ON `poems` (`audio_de_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_audio_es_id` ON `poems` (`audio_es_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_audio_it_id` ON `poems` (`audio_it_id`);
--> statement-breakpoint
DROP TRIGGER history_poem_insert;
--> statement-breakpoint
CREATE TRIGGER history_poem_insert AFTER INSERT ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id, 'audio_fr_id', NEW.audio_fr_id, 'audio_de_id', NEW.audio_de_id, 'audio_es_id', NEW.audio_es_id, 'audio_it_id', NEW.audio_it_id, 'translation_provenance', json(NEW.translation_provenance), 'fr_title', NEW.fr_title, 'fr_theme', NEW.fr_theme, 'fr_content', NEW.fr_content, 'fr_provenance', json(NEW.fr_provenance), 'de_title', NEW.de_title, 'de_theme', NEW.de_theme, 'de_content', NEW.de_content, 'de_provenance', json(NEW.de_provenance), 'es_title', NEW.es_title, 'es_theme', NEW.es_theme, 'es_content', NEW.es_content, 'es_provenance', json(NEW.es_provenance), 'it_title', NEW.it_title, 'it_theme', NEW.it_theme, 'it_content', NEW.it_content, 'it_provenance', json(NEW.it_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
DROP TRIGGER history_poem_update;
--> statement-breakpoint
CREATE TRIGGER history_poem_update AFTER UPDATE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id, 'audio_fr_id', NEW.audio_fr_id, 'audio_de_id', NEW.audio_de_id, 'audio_es_id', NEW.audio_es_id, 'audio_it_id', NEW.audio_it_id, 'translation_provenance', json(NEW.translation_provenance), 'fr_title', NEW.fr_title, 'fr_theme', NEW.fr_theme, 'fr_content', NEW.fr_content, 'fr_provenance', json(NEW.fr_provenance), 'de_title', NEW.de_title, 'de_theme', NEW.de_theme, 'de_content', NEW.de_content, 'de_provenance', json(NEW.de_provenance), 'es_title', NEW.es_title, 'es_theme', NEW.es_theme, 'es_content', NEW.es_content, 'es_provenance', json(NEW.es_provenance), 'it_title', NEW.it_title, 'it_theme', NEW.it_theme, 'it_content', NEW.it_content, 'it_provenance', json(NEW.it_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
DROP TRIGGER history_poem_delete;
--> statement-breakpoint
CREATE TRIGGER history_poem_delete AFTER DELETE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', OLD.id, OLD.revision, 'deleted', OLD.title, json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'theme', OLD.theme, 'content', OLD.content, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'image_id', OLD.image_id, 'source_language', OLD.source_language, 'translated_title', OLD.translated_title, 'translated_theme', OLD.translated_theme, 'translated_content', OLD.translated_content, 'audio_ro_id', OLD.audio_ro_id, 'audio_en_id', OLD.audio_en_id, 'audio_fr_id', OLD.audio_fr_id, 'audio_de_id', OLD.audio_de_id, 'audio_es_id', OLD.audio_es_id, 'audio_it_id', OLD.audio_it_id, 'translation_provenance', json(OLD.translation_provenance), 'fr_title', OLD.fr_title, 'fr_theme', OLD.fr_theme, 'fr_content', OLD.fr_content, 'fr_provenance', json(OLD.fr_provenance), 'de_title', OLD.de_title, 'de_theme', OLD.de_theme, 'de_content', OLD.de_content, 'de_provenance', json(OLD.de_provenance), 'es_title', OLD.es_title, 'es_theme', OLD.es_theme, 'es_content', OLD.es_content, 'es_provenance', json(OLD.es_provenance), 'it_title', OLD.it_title, 'it_theme', OLD.it_theme, 'it_content', OLD.it_content, 'it_provenance', json(OLD.it_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
