-- Reclassify an existing trial catalog without deleting products, inventory, or orders.
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO category(name, sort_order, enabled)
SELECT '酒水饮料', 10, TRUE
WHERE NOT EXISTS (SELECT 1 FROM category WHERE name = '酒水饮料');

INSERT INTO category(name, sort_order, enabled)
SELECT '休闲零食', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM category WHERE name = '休闲零食');

INSERT INTO category(name, sort_order, enabled)
SELECT '水果生鲜', 30, TRUE
WHERE NOT EXISTS (SELECT 1 FROM category WHERE name = '水果生鲜');

INSERT INTO category(name, sort_order, enabled)
SELECT '洗涤清洁', 40, TRUE
WHERE NOT EXISTS (SELECT 1 FROM category WHERE name = '洗涤清洁');

INSERT INTO category(name, sort_order, enabled)
SELECT '卫生用品', 50, TRUE
WHERE NOT EXISTS (SELECT 1 FROM category WHERE name = '卫生用品');

INSERT INTO category(name, sort_order, enabled)
SELECT '米面粮油', 60, TRUE
WHERE NOT EXISTS (SELECT 1 FROM category WHERE name = '米面粮油');

UPDATE category
SET sort_order = CASE name
        WHEN '酒水饮料' THEN 10
        WHEN '休闲零食' THEN 20
        WHEN '水果生鲜' THEN 30
        WHEN '洗涤清洁' THEN 40
        WHEN '卫生用品' THEN 50
        WHEN '米面粮油' THEN 60
    END,
    enabled = TRUE
WHERE name IN ('酒水饮料', '休闲零食', '水果生鲜', '洗涤清洁', '卫生用品', '米面粮油');

SET @category_drink = (SELECT id FROM category WHERE name = '酒水饮料');
SET @category_snack = (SELECT id FROM category WHERE name = '休闲零食');
SET @category_fresh = (SELECT id FROM category WHERE name = '水果生鲜');
SET @category_cleaning = (SELECT id FROM category WHERE name = '洗涤清洁');
SET @category_hygiene = (SELECT id FROM category WHERE name = '卫生用品');
SET @category_grain = (SELECT id FROM category WHERE name = '米面粮油');

UPDATE product
SET category_id = @category_drink
WHERE name IN (
    '纯牛奶 250ml',
    '酸奶 200g',
    '矿泉水 550ml',
    '无糖乌龙茶 500ml',
    '橙汁 1L',
    '可乐 500ml',
    '豆奶 250ml',
    '椰汁 245ml',
    '苏打水 330ml',
    '咖啡饮料 280ml'
);

UPDATE product
SET category_id = @category_snack
WHERE name IN (
    '原味薯片 70g',
    '海苔 16g',
    '苏打饼干 100g',
    '巧克力 40g',
    '混合坚果 25g',
    '牛肉干 50g',
    '果冻 200g',
    '蛋黄派 6枚',
    '辣味豆干 80g',
    '话梅 100g'
);

UPDATE product SET category_id = @category_fresh WHERE name = '鸡蛋 10枚';
UPDATE product SET category_id = @category_cleaning WHERE name IN ('洗衣液 2kg', '洗洁精 1kg', '垃圾袋 45只');
UPDATE product SET category_id = @category_hygiene WHERE name IN ('抽纸 3包', '一次性纸杯 50只');
UPDATE product SET category_id = @category_grain WHERE name IN ('东北大米 5kg', '花生油 5L', '小麦粉 2.5kg', '挂面 1kg');

DELETE FROM category
WHERE name IN ('乳品饮料', '粮油日用')
  AND NOT EXISTS (
      SELECT 1
      FROM product
      WHERE product.category_id = category.id
  );

COMMIT;

SELECT category.name, COUNT(product.id) AS product_count
FROM category
LEFT JOIN product ON product.category_id = category.id
WHERE category.name IN ('酒水饮料', '休闲零食', '水果生鲜', '洗涤清洁', '卫生用品', '米面粮油')
GROUP BY category.id, category.name, category.sort_order
ORDER BY category.sort_order;
