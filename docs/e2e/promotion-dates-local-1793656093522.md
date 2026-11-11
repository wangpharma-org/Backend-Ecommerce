# Promotion date range E2E report

- environment: **local** (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)
- BASE_URL: http://localhost:3921/api
- commit: 354fa65
- run at: 2026-11-02T21:48:13.521Z
- วันที่ทดสอบ (เวลาไทย): 2027-01-02, 2027-01-03, 2027-01-05
- promo_id ที่สร้าง (ลบแล้ว): 1, 2, 3, 4
- DB ทดสอบ: MySQL 8 ใน Docker (synchronize) + seed `promotion_type_policy` id=1 และตาราง `promotion_creditor` ตาม migration · Kafka ใน Docker
- result: **12/12 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | P0 ระบบไม่ได้ล็อกประเภทกิจกรรมเป็น Company Day | 200 | PASS | locked_type=null |
| 2 | A1 add วันเดียว 2027-01-02–2027-01-02 → 00:00:00–23:59:59 เวลาไทย | 201 | PASS | promo_id=1 start=2027-01-01T17:00:00.000Z end=2027-01-02T16:59:59.000Z |
| 3 | A2 /detail แสดงวันเดียวกันทั้งสองฝั่ง | 200 | PASS | 2027-01-02→2027-01-02 |
| 4 | A3 add ด้วย ISO มี Z (เที่ยงคืนไทย) → ไม่เพี้ยนเป็นวันก่อนหน้า | 201 | PASS | promo_id=2 start=2027-01-01T17:00:00.000Z end=2027-01-02T16:59:59.000Z |
| 5 | A4 add 4 วัน 2027-01-02–2027-01-05 | 201 | PASS | promo_id=3 start=2027-01-01T17:00:00.000Z end=2027-01-05T16:59:59.000Z |
| 6 | A5 add วันสิ้นสุดก่อนวันเริ่ม → 400 | 400 | PASS | วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม |
| 7 | A6 add วันที่ผิดรูปแบบ → 400 (ไม่ใช่ 500) | 400 | PASS | วันที่โปรโมชั่นไม่ถูกต้อง |
| 8 | D1 duplicate เป็นวันเดียว 2027-01-03–2027-01-03 | 201 | PASS | new promo_id=4 2027-01-03→2027-01-03 |
| 9 | D2 duplicate วันสิ้นสุดก่อนวันเริ่ม → 400 | 400 | PASS | วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม |
| 10 | U1 update-dates โปร 4 วัน → วันเดียว 2027-01-03 | 201 | PASS | 2027-01-03→2027-01-03 |
| 11 | U2 update-dates วันสิ้นสุดก่อนวันเริ่ม → 400 | 400 | PASS | วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม |
| 12 | Z cleanup: ลบ (soft delete) โปรทดสอบทั้งหมด | 201 | PASS | deleted promo_id=1,2,3,4 |