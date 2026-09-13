CREATE TABLE `memory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`namespace` text DEFAULT 'project' NOT NULL,
	`tier` text NOT NULL,
	`category` text NOT NULL,
	`body` text NOT NULL,
	`importance` integer DEFAULT 5 NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_accessed_at` integer,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
