CREATE TABLE `about_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_about_comments_created` ON `about_comments` (`created_at`,`id`);