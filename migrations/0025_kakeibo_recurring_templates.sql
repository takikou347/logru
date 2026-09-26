-- 家計簿に定期の記録とよく使う記録を足す。0072
CREATE TABLE `kakeibo_recurrings` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`created_by` text,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`category` text NOT NULL,
	`account_id` text,
	`to_account_id` text,
	`memo` text,
	`day_of_month` integer NOT NULL,
	`start_month` text NOT NULL,
	`end_month` text,
	`last_month` text,
	`paused_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`account_id`) REFERENCES `kakeibo_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_account_id`) REFERENCES `kakeibo_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kakeibo_recurrings_group_idx` ON `kakeibo_recurrings` (`group_id`);--> statement-breakpoint
CREATE TABLE `kakeibo_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`category` text,
	`account_id` text,
	`to_account_id` text,
	`memo` text,
	`amount` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`account_id`) REFERENCES `kakeibo_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_account_id`) REFERENCES `kakeibo_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kakeibo_templates_user_idx` ON `kakeibo_templates` (`user_id`);
