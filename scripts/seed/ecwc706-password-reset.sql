-- ข้อมูลทดสอบของงานลืมรหัสผ่าน → พนักงานขายยืนยันตัวตน (ECWC-706)
--
-- ใช้กับ scripts/e2e/password-reset.e2e.ts และ Playwright e2e/password-reset.smoke.spec.ts
-- **รันกับ DB dev/local เท่านั้น** — สคริปต์รีเซ็ตรหัสผ่านบัญชีทดสอบและลบคำขอทดสอบเก่า
--
-- รัน:
--   mysql -h127.0.0.1 -P3311 -uroot -p --default-character-set=utf8mb4 ecommerce-db \
--     < scripts/seed/ecwc706-password-reset.sql
--
-- บัญชี (รหัสผ่านเริ่มต้น e2e-test-pass-2026 ทุกบัญชี)
--   e2e706_store   ร้าน E2E706   role User  ดูแลโดยเซลล์ E2E706S
--   e2e706_sale    เซลล์          role Sales emp_id_ref E2E706S (ดูแลร้านด้านบน)
--   e2e706_sale2   เซลล์อีกคน      role Sales emp_id_ref E2E706X (ไม่ได้ดูแล → ต้องโดน 403)
--
-- รันซ้ำได้ — คืนรหัสผ่านร้านทดสอบเป็นค่าเริ่มต้น และลบคำขอที่ผู้กรอกขึ้นต้น e2e

INSERT INTO `employee` (`emp_code`, `emp_nickname`, `emp_firstname`)
SELECT 'E2E706S', 'E2E local เซลล์ A', 'E2E local'
WHERE NOT EXISTS (SELECT 1 FROM `employee` WHERE `emp_code` = 'E2E706S');

INSERT INTO `employee` (`emp_code`, `emp_nickname`, `emp_firstname`)
SELECT 'E2E706X', 'E2E local เซลล์ B', 'E2E local'
WHERE NOT EXISTS (SELECT 1 FROM `employee` WHERE `emp_code` = 'E2E706X');

INSERT INTO `users` (`mem_code`, `mem_username`, `mem_password`, `mem_nameSite`, `mem_price`,
                     `permision_admin`, `role`, `emp_id_ref`, `mem_phone`, `mem_amphur`, `mem_province`,
                     `mem_license`, `latest_purchase`)
SELECT 'E2E706', 'e2e706_store',
       '$2b$10$8.S3oNaGAd63UOnXsJW7k.9qFV56kXVxxtFyhYmEnD2mLczgPhPcS',
       'E2E local ร้านยาทดสอบรีเซ็ตรหัส', 'C', 0, 'User', 'E2E706S', '0812344521',
       'หาดใหญ่', 'สงขลา', 'E2E-LIC-706', '2026-10-02'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `mem_code` = 'E2E706');

INSERT INTO `users` (`mem_code`, `mem_username`, `mem_password`, `mem_nameSite`, `mem_price`,
                     `permision_admin`, `role`, `emp_id_ref`)
SELECT 'E2E706-SALE', 'e2e706_sale',
       '$2b$10$8.S3oNaGAd63UOnXsJW7k.9qFV56kXVxxtFyhYmEnD2mLczgPhPcS',
       'E2E local เซลล์ A', 'C', 0, 'Sales', 'E2E706S'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `mem_code` = 'E2E706-SALE');

INSERT INTO `users` (`mem_code`, `mem_username`, `mem_password`, `mem_nameSite`, `mem_price`,
                     `permision_admin`, `role`, `emp_id_ref`)
SELECT 'E2E706-SALE2', 'e2e706_sale2',
       '$2b$10$8.S3oNaGAd63UOnXsJW7k.9qFV56kXVxxtFyhYmEnD2mLczgPhPcS',
       'E2E local เซลล์ B', 'C', 0, 'Sales', 'E2E706X'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `mem_code` = 'E2E706-SALE2');

-- เริ่มใหม่ทุกครั้ง: รหัสผ่าน + เซลล์ผู้ดูแลของร้านทดสอบกลับเป็นค่าเริ่มต้น + ล้างคำขอ/token ทดสอบเก่า
UPDATE `users`
SET `mem_password` = '$2b$10$8.S3oNaGAd63UOnXsJW7k.9qFV56kXVxxtFyhYmEnD2mLczgPhPcS',
    `emp_id_ref` = 'E2E706S'
WHERE `mem_code` = 'E2E706';

DELETE FROM `password_reset_request`
WHERE `input_account` LIKE 'e2e%' OR `mem_code` = 'E2E706';

DELETE FROM `reflesh-token` WHERE `mem_code` = 'E2E706';
