CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`created_by` text,
	`title` text NOT NULL,
	`place` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`time_zone` text NOT NULL,
	`cover_photo_id` text,
	`koma_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `memories_group_starts_idx` ON `memories` (`group_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `memory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_by` text,
	`title` text NOT NULL,
	`place` text,
	`day_index` integer,
	`assignee_id` text,
	`due_on` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`done_at` integer,
	`done_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`done_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `memory_items_memory_idx` ON `memory_items` (`memory_id`);--> statement-breakpoint
CREATE TABLE `memory_likes` (
	`record_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`record_id`, `user_id`),
	FOREIGN KEY (`record_id`) REFERENCES `memory_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `memory_photo_trash` (
	`key` text PRIMARY KEY NOT NULL,
	`deleted_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`record_id` text,
	`created_by` text,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`taken_at` integer,
	`tiny` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`record_id`) REFERENCES `memory_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `memory_photos_record_idx` ON `memory_photos` (`record_id`);--> statement-breakpoint
CREATE INDEX `memory_photos_group_idx` ON `memory_photos` (`group_id`);--> statement-breakpoint
CREATE TABLE `memory_records` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`created_by` text,
	`kind` text DEFAULT 'note' NOT NULL,
	`body` text,
	`occurred_at` integer NOT NULL,
	`koma_slot` integer,
	`item_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`item_id`) REFERENCES `memory_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `memory_records_group_occurred_idx` ON `memory_records` (`group_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `memory_records_koma_uniq` ON `memory_records` (`created_by`,`koma_slot`);--> statement-breakpoint
-- 写真の行が消えたら、R2 の鍵を消す待ちに積む。記録、思い出のグループ、アカウントのどれを消しても、外部キーで写真の行が消え、ここを通る。0021
CREATE TRIGGER `memory_photos_to_trash` AFTER DELETE ON `memory_photos`
BEGIN
	INSERT OR IGNORE INTO `memory_photo_trash` (`key`) VALUES ('m/' || OLD.`id` || '.jpg');
	INSERT OR IGNORE INTO `memory_photo_trash` (`key`) VALUES ('m/' || OLD.`id` || '_t.jpg');
END;
