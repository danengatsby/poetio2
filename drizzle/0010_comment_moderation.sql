ALTER TABLE `about_comments` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `about_comments` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `about_comments` ADD `moderated_at` integer;--> statement-breakpoint
CREATE INDEX `idx_about_comments_status_created` ON `about_comments` (`status`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `book_comments` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `book_comments` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `book_comments` ADD `moderated_at` integer;--> statement-breakpoint
CREATE INDEX `idx_book_comments_status_created` ON `book_comments` (`status`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `poem_comments` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `poem_comments` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `poem_comments` ADD `moderated_at` integer;--> statement-breakpoint
CREATE INDEX `idx_poem_comments_status_created` ON `poem_comments` (`status`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `video_comments` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `video_comments` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `video_comments` ADD `moderated_at` integer;--> statement-breakpoint
CREATE INDEX `idx_video_comments_status_created` ON `video_comments` (`status`,`created_at`,`id`);
--> statement-breakpoint
-- Preserve visibility of comments published before moderation was introduced.
UPDATE poem_comments SET status = 'approved';
--> statement-breakpoint
UPDATE about_comments SET status = 'approved';
--> statement-breakpoint
UPDATE video_comments SET status = 'approved';
--> statement-breakpoint
UPDATE book_comments SET status = 'approved';
