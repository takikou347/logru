CREATE TABLE `event_attendees` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`response` text DEFAULT 'pending' NOT NULL,
	`responded_at` integer,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_attendees_user_idx` ON `event_attendees` (`user_id`);--> statement-breakpoint
INSERT INTO `event_attendees` (`event_id`, `user_id`, `response`, `responded_at`) SELECT `id`, `created_by`, 'accepted', `created_at` FROM `events` WHERE `created_by` IS NOT NULL;
