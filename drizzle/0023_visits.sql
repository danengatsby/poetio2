CREATE TABLE `visits` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`session_id` text NOT NULL,
	`visitor` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`path` text NOT NULL,
	`referrer` text DEFAULT '' NOT NULL,
	`language` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`device` text DEFAULT '' NOT NULL,
	`browser` text DEFAULT '' NOT NULL,
	`os` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_created_at` ON `visits` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_visits_visitor` ON `visits` (`visitor`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_visits_ip` ON `visits` (`ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_visits_session` ON `visits` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_visits_identified` ON `visits` (`created_at`) WHERE "visits"."ip" IS NOT NULL;