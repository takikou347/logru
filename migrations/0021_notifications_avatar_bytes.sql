-- お知らせの掃除を created_at だけで探す索引と、アバターの大きさの列。足すだけ。0066、#162
ALTER TABLE `user_settings` ADD `avatar_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);
