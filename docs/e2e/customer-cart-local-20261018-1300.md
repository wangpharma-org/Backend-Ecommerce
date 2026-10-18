# E2E — ตะกร้าลูกค้าให้ระบบขาย (internal customer-cart)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `01eb9cb` · **base:** http://127.0.0.1:3033
- ข้อมูลทดสอบ: สร้าง "E2E local" เองแล้วลบตอนจบ

## ผล 8/8

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี token / token ผิด → 403 · mem_code ยาวเกิน → 400 | 403 / 403 / 400 |
| PASS | ร้านทดสอบ: 2 บรรทัด ไม่รวมของแถม (is_reward / hotdeal_free) · เรียงใส่ล่าสุดก่อน | HTTP 200 · E2E-CP2,E2E-CP1 |
| PASS | หน่วย/จำนวน/เวลาใส่ ครบ | กล่อง × 2 (level 2) · 2026-10-15T09:00:00.000Z |
| PASS | ราคา: ระดับ B × ratio 10 = 60/กล่อง · ธง flash_sale | P1 60/120 · {"monthly":false,"flash_sale":true,"hot_deal":false} |
| PASS | ถึงขั้นโปรเดือน (30 ≥ 20 ชิ้น) → ราคา A × 10 = 90 · ธง monthly | P2 90/270 · {"monthly":true,"flash_sale":false,"hot_deal":false} |
| PASS | price_option ของร้าน = B | B |
| PASS | ร้านตะกร้าว่าง → lines = [] | HTTP 200 · 0 |
| PASS | เก็บกวาด: ลบข้อมูล E2E local ที่สร้าง | ok |
