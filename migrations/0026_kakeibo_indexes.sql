-- 家計簿の読みを速くする索引を足す。#199
-- kakeibo_expenses(created_by, date): /api/kakeibo/usage が created_by と date の範囲で絞る
-- kakeibo_splits(user_id): sharedBurdenThisMonth が user_id で絞る
CREATE INDEX `kakeibo_expenses_created_by_date_idx` ON `kakeibo_expenses` (`created_by`,`date`);--> statement-breakpoint
CREATE INDEX `kakeibo_splits_user_idx` ON `kakeibo_splits` (`user_id`);
