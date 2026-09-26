CREATE TABLE `content_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_content_drafts_created` ON `content_drafts` (`kind`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `content_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`revision` integer NOT NULL,
	`event` text NOT NULL,
	`title` text NOT NULL,
	`snapshot` text NOT NULL,
	`recorded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_content_history_entity` ON `content_history` (`kind`,`entity_id`,`id`);
--> statement-breakpoint
INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) SELECT 'poem', id, revision, 'initial', title, json_object('id', id, 'title', title, 'author', author, 'theme', theme, 'content', content, 'revision', revision, 'created_at', created_at, 'updated_at', updated_at, 'image_id', image_id, 'source_language', source_language, 'translated_title', translated_title, 'translated_theme', translated_theme, 'translated_content', translated_content, 'audio_ro_id', audio_ro_id, 'audio_en_id', audio_en_id), CAST(strftime('%s','now') AS INTEGER)*1000 FROM poems;

--> statement-breakpoint
CREATE TRIGGER history_poem_insert AFTER INSERT ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id), CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
CREATE TRIGGER history_poem_update AFTER UPDATE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id), CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
CREATE TRIGGER history_poem_delete AFTER DELETE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', OLD.id, OLD.revision, 'deleted', OLD.title, json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'theme', OLD.theme, 'content', OLD.content, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'image_id', OLD.image_id, 'source_language', OLD.source_language, 'translated_title', OLD.translated_title, 'translated_theme', OLD.translated_theme, 'translated_content', OLD.translated_content, 'audio_ro_id', OLD.audio_ro_id, 'audio_en_id', OLD.audio_en_id), CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) SELECT 'video', id, revision, 'initial', title, json_object('id', id, 'title', title, 'author', author, 'description', description, 'file_id', file_id, 'revision', revision, 'created_at', created_at, 'updated_at', updated_at), CAST(strftime('%s','now') AS INTEGER)*1000 FROM videos;

--> statement-breakpoint
CREATE TRIGGER history_video_insert AFTER INSERT ON videos BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('video', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at), CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
CREATE TRIGGER history_video_update AFTER UPDATE ON videos BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('video', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at), CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
CREATE TRIGGER history_video_delete AFTER DELETE ON videos BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('video', OLD.id, OLD.revision, 'deleted', OLD.title, json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'description', OLD.description, 'file_id', OLD.file_id, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
