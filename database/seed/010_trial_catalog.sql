-- Run once after Flyway migration on a disposable or freshly initialized trial database.
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO category(name, sort_order, enabled) VALUES ('乳品饮料', 10, TRUE);
SET @category_drink = LAST_INSERT_ID();
INSERT INTO category(name, sort_order, enabled) VALUES ('休闲零食', 20, TRUE);
SET @category_snack = LAST_INSERT_ID();
INSERT INTO category(name, sort_order, enabled) VALUES ('粮油日用', 30, TRUE);
SET @category_daily = LAST_INSERT_ID();

INSERT INTO product(
    category_id, name, price_cent, unit, cover_image_url, description, on_shelf
) VALUES
(@category_drink, '纯牛奶 250ml', 320, '盒', NULL, '常温纯牛奶', TRUE),
(@category_drink, '酸奶 200g', 450, '杯', NULL, '低温酸奶', TRUE),
(@category_drink, '矿泉水 550ml', 200, '瓶', NULL, '饮用天然水', TRUE),
(@category_drink, '无糖乌龙茶 500ml', 500, '瓶', NULL, '无糖茶饮', TRUE),
(@category_drink, '橙汁 1L', 1290, '瓶', NULL, '果汁饮料', TRUE),
(@category_drink, '可乐 500ml', 350, '瓶', NULL, '碳酸饮料', TRUE),
(@category_drink, '豆奶 250ml', 280, '盒', NULL, '植物蛋白饮料', TRUE),
(@category_drink, '椰汁 245ml', 420, '罐', NULL, '椰子汁饮料', TRUE),
(@category_drink, '苏打水 330ml', 390, '罐', NULL, '无糖苏打水', TRUE),
(@category_drink, '咖啡饮料 280ml', 690, '瓶', NULL, '即饮咖啡', TRUE),
(@category_snack, '原味薯片 70g', 650, '袋', NULL, '膨化食品', TRUE),
(@category_snack, '海苔 16g', 590, '袋', NULL, '即食海苔', TRUE),
(@category_snack, '苏打饼干 100g', 550, '袋', NULL, '咸味饼干', TRUE),
(@category_snack, '巧克力 40g', 780, '块', NULL, '牛奶巧克力', TRUE),
(@category_snack, '混合坚果 25g', 690, '袋', NULL, '每日坚果', TRUE),
(@category_snack, '牛肉干 50g', 1590, '袋', NULL, '风干牛肉', TRUE),
(@category_snack, '果冻 200g', 490, '袋', NULL, '水果味果冻', TRUE),
(@category_snack, '蛋黄派 6枚', 990, '盒', NULL, '夹心蛋糕', TRUE),
(@category_snack, '辣味豆干 80g', 450, '袋', NULL, '即食豆制品', TRUE),
(@category_snack, '话梅 100g', 720, '袋', NULL, '果脯蜜饯', TRUE),
(@category_daily, '东北大米 5kg', 3990, '袋', NULL, '粳米', TRUE),
(@category_daily, '花生油 5L', 10900, '桶', NULL, '压榨花生油', TRUE),
(@category_daily, '小麦粉 2.5kg', 2590, '袋', NULL, '家庭通用面粉', TRUE),
(@category_daily, '挂面 1kg', 1290, '袋', NULL, '原味挂面', TRUE),
(@category_daily, '鸡蛋 10枚', 1290, '盒', NULL, '鲜鸡蛋', TRUE),
(@category_daily, '抽纸 3包', 1590, '提', NULL, '三层抽取式面巾纸', TRUE),
(@category_daily, '洗衣液 2kg', 3290, '瓶', NULL, '洁净护理洗衣液', TRUE),
(@category_daily, '洗洁精 1kg', 1290, '瓶', NULL, '餐具洗涤剂', TRUE),
(@category_daily, '垃圾袋 45只', 990, '卷', NULL, '中号垃圾袋', TRUE),
(@category_daily, '一次性纸杯 50只', 1390, '包', NULL, '家用纸杯', TRUE);

SET @first_product = LAST_INSERT_ID();
INSERT INTO online_inventory(product_id, available_quantity, version)
SELECT id, 30 + MOD(id - @first_product, 6) * 10, 0
  FROM product
 WHERE id BETWEEN @first_product AND @first_product + 29;

COMMIT;

SELECT COUNT(*) AS seeded_products
  FROM product
 WHERE id BETWEEN @first_product AND @first_product + 29;
