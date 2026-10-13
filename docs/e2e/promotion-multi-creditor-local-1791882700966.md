# Promotion multi-creditor (ECWC-685) E2E report

- environment: **local** (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)
- BASE_URL: http://localhost:3022/api
- commit: 7d22e7b
- run at: 2026-10-13T09:11:40.965Z
- creditors: 059, 079 · products: A=11011212 B=06100220
- promo_id ที่สร้าง (ลบแล้ว): 234, 235
- result: **18/18 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | P0 ระบบไม่ได้ล็อกประเภทกิจกรรมเป็น Wang Day | 200 | PASS | locked_type=null |
| 2 | C1 product/creditor รับหลายรหัส = ผลรวมของแต่ละรหัส | 201 | PASS | 059=2 079=7 รวม=9 |
| 3 | C2 product/creditor รับ JSON string ได้ | 201 | PASS | 9 รายการ |
| 4 | C3 product/creditor ไม่ส่งรหัส → 400 | 400 | PASS | creditor_code is required |
| 5 | A1 สร้าง Company Day 2 บริษัท (JSON string) | 201 | PASS | promo_id=234 |
| 6 | A2 รหัสเจ้าหนี้ที่ไม่มีจริง → 400 บอกรหัส | 400 | PASS | ไม่พบรหัสเจ้าหนี้: E2E-NOPE-1791882700184 |
| 7 | A3 detail คืนบริษัทครบ + บริษัทหลักคือตัวแรก | 200 | PASS | creditor=059 creditors=059,079 |
| 8 | A4 list คืน creditors ของโปรที่สร้าง | 200 | PASS | creditors=2 |
| 9 | B0 เพิ่ม Tier 1 + Tier 2 | 201 | PASS | tier1=672 tier2=673 |
| 10 | B1 เพิ่มสินค้าเข้าร่วมรายการ 11011212 ใน Tier 1 | 201 | PASS | "" |
| 11 | B2 11011212 เป็นของแถม tier เดียวกัน → 400 | 400 | PASS | สินค้า 11011212 เป็นสินค้าเข้าร่วมรายการใน E2E local Tier 1 ของโปรนี้อยู่แล้ว ไม่สามารถเลือกเป็นของแถมได้ |
| 12 | B3 11011212 เป็นของแถมข้าม tier (Tier 2) → 400 | 400 | PASS | สินค้า 11011212 เป็นสินค้าเข้าร่วมรายการใน E2E local Tier 1 ของโปรนี้อยู่แล้ว ไม่สามารถเลือกเป็นของแถมได้ |
| 13 | B4 เพิ่มของแถม 06100220 ใน Tier 2 | 201 | PASS | "" |
| 14 | B5 06100220 เป็นสินค้าเข้าร่วมรายการข้าม tier (Tier 1) → 400 | 400 | PASS | สินค้า 06100220 เป็นของแถมใน E2E local Tier 2 ของโปรนี้อยู่แล้ว ไม่สามารถเลือกเป็นสินค้าเข้าร่วมรายการได้ |
| 15 | B6 tiers/:id คืน other_tier_usage ของ tier อื่นเท่านั้น | 200 | PASS | rewards=06100220 conditions=- |
| 16 | B7 tier_id ไม่ใช่ตัวเลข → 400 (ไม่ใช่ SQL error 500) | 400 | PASS | tiers=400 condition/list=400 reward/list=400 |
| 17 | D1 duplicate โปรหลายบริษัท → บริษัทติดไปครบ | 201 | PASS | new promo_id=235 creditors=2 |
| 18 | Z cleanup: ลบ (soft delete) โปรทดสอบทั้งหมด | 201 | PASS | deleted promo_id=234,235 |