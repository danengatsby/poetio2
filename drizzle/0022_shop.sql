CREATE TABLE `book_shop` (
	`book_id` text PRIMARY KEY NOT NULL,
	`stock` integer,
	`language` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "book_shop_stock_not_negative" CHECK("book_shop"."stock" IS NULL OR "book_shop"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`order_id` text NOT NULL,
	`book_id` text NOT NULL,
	`cover` integer NOT NULL,
	`title` text NOT NULL,
	`unit_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`order_id`, `book_id`, `cover`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`access_key` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`county` text NOT NULL,
	`postal_code` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`payment_method` text NOT NULL,
	`currency` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
