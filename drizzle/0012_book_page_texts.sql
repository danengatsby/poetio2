CREATE TABLE `book_page_texts` (
	`file_id` text NOT NULL,
	`page` integer NOT NULL,
	`content` text NOT NULL,
	`language` text DEFAULT 'und' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`file_id`, `page`),
	FOREIGN KEY (`file_id`) REFERENCES `book_files`(`id`) ON UPDATE no action ON DELETE cascade
);
