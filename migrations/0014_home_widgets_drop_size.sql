-- home_layouts.widgets の各要素から、大きさ(size)の項目を消す。ほかの項目と並びは変えない。0037
UPDATE `home_layouts`
SET `widgets` = (
	SELECT json_group_array(json(`v`))
	FROM (
		SELECT json_remove(`e`.`value`, '$.size') AS `v`
		FROM json_each(`home_layouts`.`widgets`) AS `e`
		ORDER BY `e`.`key`
	)
)
WHERE EXISTS (
	SELECT 1 FROM json_each(`home_layouts`.`widgets`) AS `e`
	WHERE json_extract(`e`.`value`, '$.size') IS NOT NULL
);
