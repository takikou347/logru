ALTER TABLE `notifications` ADD `group_key` text;--> statement-breakpoint
CREATE INDEX `notifications_group_key_idx` ON `notifications` (`user_id`,`kind`,`group_key`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notification_prefs` text DEFAULT '{}' NOT NULL;