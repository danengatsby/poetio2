CREATE TABLE `poem_images` (
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
ALTER TABLE `poems` ADD `image_id` text REFERENCES poem_images(id);--> statement-breakpoint
CREATE INDEX `idx_poems_image_id` ON `poems` (`image_id`);