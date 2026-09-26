CREATE TABLE `video_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_comments_video_created` ON `video_comments` (`video_id`,`created_at`,`id`);