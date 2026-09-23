-- ข้อมูลทดสอบของงานกระเช้า (ECWC-496 / 567)
--
-- เทสทั้ง backend e2e และ Playwright ต้องมีข้อมูลชุดนี้ ถ้าไม่มีจะ fail หรือ skip
-- เงียบๆ แบบดูเหมือนผ่าน ของเดิมสร้างด้วยมือในเครื่องคนเดียวเลยย้ายเครื่องไม่ได้
--
-- รัน:
--   docker exec -i ecommerce-db mysql -uroot -ppassword \
--     --default-character-set=utf8mb4 ecommerce_db < scripts/seed/ecwc496-test-data.sql
--
-- ต้องมี dump production โหลดไว้ก่อน เพราะอ้างถึงของที่มีอยู่แล้ว:
--   สินค้า 56012900 560106705 56010405 56011310 56011305 56012200-01
--          31080211 23030101 06210400 34090505 36020814
--   promo 189 (MedicPharmaDay) · hotdeal 13623
-- ถ้ารหัสไหนไม่มีใน dump ที่ใช้ ให้เปลี่ยนเป็นรหัสที่มีแล้วแก้ในไฟล์นี้
--
-- รันซ้ำได้ ไม่สร้างซ้ำ

-- ---------------------------------------------------------------- บัญชีทดสอบ
-- รหัสผ่าน e2e-test-pass-2026 (bcrypt) · mem_price C · แอดมิน
-- mem_route เป็น NULL โดยตั้งใจ — ออเดอร์ของร้านนี้จะไม่ไหลเข้า order picking
-- (print-order-online.php:572 รับแค่ L9 L11 L12 L17 L18 L20 L23) ดู ECWC-520
INSERT INTO `users` (`mem_code`, `mem_username`, `mem_password`, `mem_nameSite`, `mem_price`, `permision_admin`)
SELECT 'E2E-TEST', 'e2e_test_user',
       '$2b$10$8.S3oNaGAd63UOnXsJW7k.9qFV56kXVxxtFyhYmEnD2mLczgPhPcS',
       'E2E local test shop', 'C', 1
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `mem_code` = 'E2E-TEST');

-- ---------------------------------------------------------------- โปรเดโม 196
-- ขั้น 1 เกณฑ์ 500 บาท แถม 1 แผง · ขั้น 2 เกณฑ์ 2,000 บาท แถม 2 ขวด
-- ใช้โชว์ว่ายอดหลายเท่าของเกณฑ์ได้ของแถมหลายชุด (รีวิว ticket 1 และ 3)
-- แก้ end_date ถ้าเลยกำหนดแล้ว ไม่งั้นโปรจะ resolve ไม่เจอและเทสจะ skip
INSERT INTO `promotion` (`promo_id`, `promo_name`, `start_date`, `end_date`, `status`)
SELECT 196, 'E2E local — เดโมรีวิว ECWC-496', '2026-09-10 17:00:00', '2027-12-31 16:59:59', 1
WHERE NOT EXISTS (SELECT 1 FROM `promotion` WHERE `promo_id` = 196);

INSERT INTO `promotion_tier` (`tier_id`, `tier_name`, `min_amount`, `description`, `promo_id`, `all_products`, `is_unit`)
SELECT 568, 'E2E local ขั้น 1 — ซื้อครบ 500 บาท รับฟรี 1 แผง', 500.00,
       'ขั้นเล็ก ใช้โชว์ว่ายอดหลายเท่าได้ของแถมหลายชุด', 196, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM `promotion_tier` WHERE `tier_id` = 568);

INSERT INTO `promotion_tier` (`tier_id`, `tier_name`, `min_amount`, `description`, `promo_id`, `all_products`, `is_unit`)
SELECT 569, 'E2E local ขั้น 2 — ซื้อครบ 2,000 บาท รับฟรี 2 ขวด', 2000.00,
       'ขั้นใหญ่ ของแถม 1 ชุด = 2 ขวด (เคสของ ticket 3)', 196, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM `promotion_tier` WHERE `tier_id` = 569);

-- สินค้าที่นับเข้าเกณฑ์
-- 36020814 อยู่ในนี้เพราะเป็น "สินค้าต้นทาง" ของ hotdeal 13623
-- เทส hotdeal-gift-in-cart.smoke.spec.ts ต้องการให้สินค้าตัวนี้ร่วมโปรได้
-- เพื่อจำลองเคสที่ของต้นทางถูกย้ายเข้ากระเช้า แล้วของแถม hot deal กำพร้า (ticket 9)
-- ถ้าลบแถวนี้ เทสจะ skip เงียบๆ ดูเหมือนผ่าน
INSERT INTO `promotion_condition` (`product_code`, `tier_id`)
SELECT * FROM (
  SELECT '56012900' pc, 568 t UNION ALL SELECT '560106705', 568
  UNION ALL SELECT '56010405', 568 UNION ALL SELECT '36020814', 568
  UNION ALL SELECT '56012900', 569 UNION ALL SELECT '560106705', 569
  UNION ALL SELECT '56010405', 569
) want
WHERE NOT EXISTS (
  SELECT 1 FROM `promotion_condition` c
  WHERE c.`product_code` = want.pc AND c.`tier_id` = want.t
);

INSERT INTO `promotion_reward` (`qty`, `unit`, `product_gcode`, `tier_id`)
SELECT * FROM (
  SELECT 1 q, '1' u, '56012200-01' p, 568 t
  UNION ALL SELECT 2, '1', '56011310', 569
) want
WHERE NOT EXISTS (
  SELECT 1 FROM `promotion_reward` r WHERE r.`tier_id` = want.t
);

-- ------------------------------------------------- คอลเลกชันเดโม + การ์ดดีลพิเศษ
-- hotdeal 13623 คือดีลหมวด Buy More Get 1 (special_deal = 0)
-- ใช้ยืนยันว่าการ์ดพาไป /buy-more-get-1 ไม่ใช่ /hotdeal (รีวิว ticket 11)
INSERT INTO `special_collection` (`collection_id`, `name`, `description`, `status`, `audience_scope`, `sort_order`)
SELECT 4, 'E2E local — เดโมรีวิว ECWC-496', 'คอลเลกชันเดโมสำหรับไล่ดู ticket ที่รีวิวมา', 1, 'all', 0
WHERE NOT EXISTS (SELECT 1 FROM `special_collection` WHERE `collection_id` = 4);

INSERT INTO `special_collection_item` (`collection_id`, `ref_type`, `ref_id`, `sort_order`)
SELECT * FROM (
  SELECT 4 c, 'promotion' rt, '196' ri, 0 so
  UNION ALL SELECT 4, 'hotdeal', '13623', 1
) want
WHERE NOT EXISTS (
  SELECT 1 FROM `special_collection_item` i
  WHERE i.`collection_id` = want.c AND i.`ref_type` = want.rt AND i.`ref_id` = want.ri
);

-- ---------------------------------------------------------- กระเช้าสำเร็จรูปเดโม
-- ฟีเจอร์นี้ถูกพักไว้ (ECWC-571) แท็บแอดมินซ่อนหลัง flag bundle_set_admin
-- แต่ฝั่งลูกค้ายังเปิดอยู่ เทส set-basket.smoke.spec.ts จึงยังต้องใช้ชุดพวกนี้
-- SET-DEMO-03 คือชุดที่ใช้โชว์ปัญหาส่วนลดเฉลี่ย: ของปกติรวม 150 ขายชุด 139
INSERT INTO `bundle_set` (`set_code`, `set_name`, `description`, `price`, `status`, `sort_order`)
SELECT * FROM (
  SELECT 'SET-DEMO-01' sc, 'E2E local ชุดทดสอบอัตโนมัติ' sn, NULL d, 500.00 p, 1 st, 0 so
  UNION ALL SELECT 'SET-DEMO-02', 'E2E local ชุดตัวอย่างคิดราคา', NULL, 70.00, 1, 0
  UNION ALL SELECT 'SET-DEMO-03', 'E2E local — กระเช้าเยี่ยมไข้', 'เดโมให้เห็นปัญหาการเฉลี่ยราคา', 139.00, 1, 0
) want
WHERE NOT EXISTS (SELECT 1 FROM `bundle_set` b WHERE b.`set_code` = want.sc);

INSERT INTO `bundle_set_item` (`set_code`, `pro_code`, `unit_level`, `qty`, `is_gift`, `sort_order`)
SELECT * FROM (
  SELECT 'SET-DEMO-01' sc, '56012900' pc, 1 ul, 2 q, 0 g, 0 so
  UNION ALL SELECT 'SET-DEMO-01', '56011305', 1, 1, 1, 1
  UNION ALL SELECT 'SET-DEMO-02', '56012900',  1, 3, 0, 0
  UNION ALL SELECT 'SET-DEMO-02', '560106705', 1, 2, 0, 1
  UNION ALL SELECT 'SET-DEMO-03', '31080211',  1, 3, 0, 0
  UNION ALL SELECT 'SET-DEMO-03', '23030101',  1, 2, 0, 1
  UNION ALL SELECT 'SET-DEMO-03', '06210400',  1, 1, 0, 2
  UNION ALL SELECT 'SET-DEMO-03', '34090505',  1, 1, 1, 3
) want
WHERE NOT EXISTS (
  SELECT 1 FROM `bundle_set_item` i
  WHERE i.`set_code` = want.sc AND i.`pro_code` = want.pc AND i.`unit_level` = want.ul
);

-- ---------------------------------------------------------------------- ตรวจผล
SELECT 'user'        AS fixture, COUNT(*) AS found, 1 AS expected FROM `users` WHERE `mem_code` = 'E2E-TEST'
UNION ALL SELECT 'promo 196',     COUNT(*), 1 FROM `promotion` WHERE `promo_id` = 196 AND `status` = 1
UNION ALL SELECT 'tiers',         COUNT(*), 2 FROM `promotion_tier` WHERE `promo_id` = 196
UNION ALL SELECT 'conditions',    COUNT(*), 7 FROM `promotion_condition` WHERE `tier_id` IN (568, 569)
UNION ALL SELECT 'hotdeal cond',  COUNT(*), 1 FROM `promotion_condition` WHERE `tier_id` = 568 AND `product_code` = '36020814'
UNION ALL SELECT 'rewards',       COUNT(*), 2 FROM `promotion_reward` WHERE `tier_id` IN (568, 569)
UNION ALL SELECT 'collection 4',  COUNT(*), 1 FROM `special_collection` WHERE `collection_id` = 4
UNION ALL SELECT 'coll items',    COUNT(*), 2 FROM `special_collection_item` WHERE `collection_id` = 4
UNION ALL SELECT 'demo sets',     COUNT(*), 3 FROM `bundle_set` WHERE `set_code` LIKE 'SET-DEMO-%' AND `deleted_at` IS NULL
UNION ALL SELECT 'set items',     COUNT(*), 8 FROM `bundle_set_item` WHERE `set_code` LIKE 'SET-DEMO-%';
