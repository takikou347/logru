-- 家計簿にグループの「よく使う払い方」の既定を足す。0087、F-329
CREATE TABLE `kakeibo_group_settings` (
	`group_id` text PRIMARY KEY NOT NULL,
	`default_account_id` text,
	`updated_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`default_account_id`) REFERENCES `kakeibo_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
