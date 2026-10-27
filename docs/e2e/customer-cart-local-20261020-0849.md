# E2E — ตะกร้าลูกค้าให้ระบบขาย (internal customer-cart)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `53e75f0` · **base:** http://127.0.0.1:3033
- ข้อมูลทดสอบ: สร้าง "E2E local" เองแล้วลบตอนจบ

## ผล 14/14

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี token / token ผิด → 403 · mem_code ยาวเกิน → 400 | 403 / 403 / 400 |
| PASS | ร้านทดสอบ: 2 บรรทัด ไม่รวมของแถม (is_reward / hotdeal_free) · เรียงใส่ล่าสุดก่อน | HTTP 200 · E2E-CP2,E2E-CP1 |
| PASS | หน่วย/จำนวน/เวลาใส่ ครบ | กล่อง × 2 (level 2) · 2026-10-15T09:00:00.000Z |
| PASS | ราคา: ระดับ B × ratio 10 = 60/กล่อง · ธง flash_sale | P1 60/120 · {"monthly":false,"flash_sale":true,"hot_deal":false} |
| PASS | ถึงขั้นโปรเดือน (30 ≥ 20 ชิ้น) → ราคา A × 10 = 90 · ธง monthly | P2 90/270 · {"monthly":true,"flash_sale":false,"hot_deal":false} |
| PASS | price_option ของร้าน = B | B |
| PASS | ร้านตะกร้าว่าง → lines = [] | HTTP 200 · 0 |
| PASS | consume: ไม่มี token 403 · ไม่มี order_ref 400 · qty ≤ 0 → 400 | 403 / 400 / 400 |
| PASS | ลดพอดี P1 1 กล่อง (2→1) · ส่งซ้ำ ref เดิม = replay ไม่ลดซ้ำ · ไม่แตะของแถม | HTTP 200 · [{"pro_code":"E2E-CP1","unit_level":2,"qty":1}] · หลังส่งซ้ำ replay=true P1=1 |
| PASS | ลดบางส่วนเป็นหน่วยเล็ก: P2 15 ชิ้น จาก 3 กล่อง (30) → เหลือ 2 กล่อง (เศษปัดขึ้น) | HTTP 200 · P2=2 · [{"pro_code":"E2E-CP2","unit_level":2,"qty":1}] |
| PASS | สั่งเกินของในตะกร้า: P1 5 กล่อง (มี 1) → ลบแถว · not_in_cart 40 ชิ้น | HTTP 200 · P1=undefined · [{"pro_code":"E2E-CP1","base_qty":40}] |
| PASS | คืน ref C → P1 กลับ 1 กล่อง (ใส่แถวใหม่) · ส่งซ้ำไม่คืนซ้ำ | HTTP 200 · P1=1 · replay=true → 1 |
| PASS | คืน ref A ขณะตะกร้ามีของอยู่แล้ว → บวกเพิ่ม (1→2) · ref ที่ไม่เคยลด = ไม่คืนอะไร | P1=2 · never=200 rows 0 |
| PASS | เก็บกวาด: ลบข้อมูล E2E local ที่สร้าง | ok |
