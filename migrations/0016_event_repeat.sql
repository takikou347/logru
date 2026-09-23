CREATE TABLE `event_occurrence_edits` (
	`event_id` text NOT NULL,
	`occurrence_at` integer NOT NULL,
	`cancelled` integer DEFAULT false NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`all_day` integer,
	`title` text,
	`memo` text,
	PRIMARY KEY(`event_id`, `occurrence_at`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_occurrence_edits_event_idx` ON `event_occurrence_edits` (`event_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `repeat_freq` text;--> statement-breakpoint
ALTER TABLE `events` ADD `repeat_days_of_week` text;--> statement-breakpoint
ALTER TABLE `events` ADD `repeat_until` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `repeat_count` integer;