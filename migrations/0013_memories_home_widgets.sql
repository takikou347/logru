-- 思い出の近道のウィジェット(memories.shortcut)を、同じ位置の「ひとコマ」と「記録する」に置き換える。#78、0037
-- 並びは JSON の配列。置き換える 1 件を、memories.koma と memories.record の 2 件にする。ほかの件はそのまま残す。
UPDATE `home_layouts`
SET `widgets` = (
	SELECT json_group_array(json(`w`.`entry`))
	FROM (
		SELECT `e`.`key` * 2 AS `pos`, `e`.`value` AS `entry`
		FROM json_each(`home_layouts`.`widgets`) AS `e`
		WHERE json_extract(`e`.`value`, '$.key') IS NOT 'memories.shortcut'
		UNION ALL
		SELECT `e`.`key` * 2, json_object('key', 'memories.koma')
		FROM json_each(`home_layouts`.`widgets`) AS `e`
		WHERE json_extract(`e`.`value`, '$.key') = 'memories.shortcut'
		UNION ALL
		SELECT `e`.`key` * 2 + 1, json_object('key', 'memories.record')
		FROM json_each(`home_layouts`.`widgets`) AS `e`
		WHERE json_extract(`e`.`value`, '$.key') = 'memories.shortcut'
		ORDER BY `pos`
	) AS `w`
)
WHERE EXISTS (
	SELECT 1 FROM json_each(`home_layouts`.`widgets`) AS `e`
	WHERE json_extract(`e`.`value`, '$.key') = 'memories.shortcut'
);
