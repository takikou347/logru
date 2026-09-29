-- 毎年の繰り返しの種別(誕生日・記念日)。既定は誕生日。0097
ALTER TABLE `events` ADD `anniversary_kind` text DEFAULT 'birthday' NOT NULL;
