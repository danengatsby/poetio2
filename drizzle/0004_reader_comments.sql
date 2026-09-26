CREATE TABLE `poem_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`poem_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`poem_id`) REFERENCES `poems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_poem_comments_poem_created` ON `poem_comments` (`poem_id`,`created_at`,`id`);