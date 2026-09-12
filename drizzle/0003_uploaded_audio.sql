CREATE TABLE `poem_audio` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`content_hash` text NOT NULL,
	`owner_email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `poems` ADD `audio_ro_id` text REFERENCES poem_audio(id);--> statement-breakpoint
ALTER TABLE `poems` ADD `audio_en_id` text REFERENCES poem_audio(id);--> statement-breakpoint
CREATE INDEX `idx_poems_audio_ro_id` ON `poems` (`audio_ro_id`);--> statement-breakpoint
CREATE INDEX `idx_poems_audio_en_id` ON `poems` (`audio_en_id`);