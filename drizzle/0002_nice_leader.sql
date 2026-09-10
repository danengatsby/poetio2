ALTER TABLE `poems` ADD `source_language` text DEFAULT 'ro' NOT NULL;--> statement-breakpoint
ALTER TABLE `poems` ADD `translated_title` text;--> statement-breakpoint
ALTER TABLE `poems` ADD `translated_theme` text;--> statement-breakpoint
ALTER TABLE `poems` ADD `translated_content` text;