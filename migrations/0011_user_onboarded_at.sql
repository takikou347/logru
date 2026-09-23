ALTER TABLE `user_settings` ADD `onboarded_at` integer;--> statement-breakpoint
UPDATE `user_settings` SET `onboarded_at` = `updated_at`;
