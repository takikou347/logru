-- 家計簿に口座を足す。記録に種類(支出、収入、振替)と口座を足す。いまの行は type が expense、口座は空。0069
CREATE TABLE `kakeibo_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`created_by` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kakeibo_accounts_group_idx` ON `kakeibo_accounts` (`group_id`);--> statement-breakpoint
ALTER TABLE `kakeibo_expenses` ADD `type` text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE `kakeibo_expenses` ADD `account_id` text REFERENCES kakeibo_accounts(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `kakeibo_expenses` ADD `to_account_id` text REFERENCES kakeibo_accounts(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `kakeibo_expenses_account_idx` ON `kakeibo_expenses` (`account_id`);--> statement-breakpoint
CREATE INDEX `kakeibo_expenses_to_account_idx` ON `kakeibo_expenses` (`to_account_id`);
