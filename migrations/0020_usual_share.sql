ALTER TABLE `user_settings` ADD `usual_share_group_id` text REFERENCES groups(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `usual_share_asked_at` integer;
