CREATE TABLE `thought_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_thought_id` integer NOT NULL,
	`to_thought_id` integer NOT NULL,
	`kind` text DEFAULT 'related' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`from_thought_id`) REFERENCES `thoughts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_thought_id`) REFERENCES `thoughts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `thoughts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`body` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`todo_status` text DEFAULT 'none' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
