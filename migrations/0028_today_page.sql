-- 今日のページの並べ方と見せ方。0092、F-45
ALTER TABLE `user_settings` ADD `today_page` text DEFAULT '{"sortMode":"added","headlineExtension":null,"openOverrides":{}}' NOT NULL;