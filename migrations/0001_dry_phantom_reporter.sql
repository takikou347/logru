CREATE TABLE `external_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`url_encrypted` text NOT NULL,
	`last_synced_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_calendars_user_idx` ON `external_calendars` (`user_id`);--> statement-breakpoint
CREATE TABLE `external_events` (
	`calendar_id` text NOT NULL,
	`uid` text NOT NULL,
	`occurrence` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`all_day` integer DEFAULT false NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`calendar_id`, `uid`, `occurrence`),
	FOREIGN KEY (`calendar_id`) REFERENCES `external_calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_events_calendar_starts_idx` ON `external_events` (`calendar_id`,`starts_at`);