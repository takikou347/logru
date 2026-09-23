CREATE TABLE `weather_daily` (
	`place_key` text NOT NULL,
	`date` text NOT NULL,
	`weather_code` real NOT NULL,
	`temp_max` real NOT NULL,
	`temp_min` real NOT NULL,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`place_key`, `date`)
);
--> statement-breakpoint
CREATE TABLE `weather_locations` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
