-- 家計簿に立て替えと精算、期間の予算を足す。0072
-- kakeibo_expenses に paid_by(払った人)、split_mode(割り方)を足す。共有のグループの支出で、
-- 共有口座で払っていないときだけ入る。いまの行はどちらも空のまま
ALTER TABLE `kakeibo_expenses` ADD `paid_by` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `kakeibo_expenses` ADD `split_mode` text;--> statement-breakpoint
CREATE TABLE `kakeibo_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`user_id` text,
	`amount` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `kakeibo_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kakeibo_splits_expense_idx` ON `kakeibo_splits` (`expense_id`);--> statement-breakpoint
CREATE TABLE `kakeibo_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`created_by` text,
	`from_user` text,
	`to_user` text,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`from_account_id` text,
	`to_account_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`from_user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`from_account_id`) REFERENCES `kakeibo_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_account_id`) REFERENCES `kakeibo_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kakeibo_settlements_group_idx` ON `kakeibo_settlements` (`group_id`);--> statement-breakpoint
CREATE TABLE `kakeibo_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`created_by` text,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kakeibo_budgets_group_idx` ON `kakeibo_budgets` (`group_id`);
