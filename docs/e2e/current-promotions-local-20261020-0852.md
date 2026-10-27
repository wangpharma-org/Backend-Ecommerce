# E2E — GET /ecom/internal/current-promotions (แถบโปรบนหัวระบบขาย)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `53e75f0` · **base:** http://127.0.0.1:3032/api
- โหมด: ใส่ข้อมูลทดสอบ "E2E local แถบโปร …" (รหัส E2ES-) แล้วลบเมื่อจบ

## ผล 10/10

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี token / token ผิด → 403 | 403 / 403 |
| PASS | 200 · มีทุกส่วนของแถบโปร · ไม่มีส่วนของรายร้าน (member/specialCollections/wangRebate) | HTTP 200 · ขาด - · ของรายร้าน - |
| PASS | Company Day: ขั้นเรียงตามยอด · ขั้น 1 มีสินค้า 14 ตัว ส่งตัวอย่าง 12 ตัวแรกตามรหัส พร้อมชื่อ · ของแถม | ขั้น 3000/6000 · นับ 14 · ตัวอย่าง 12 (E2ES-P01…E2ES-P12) · แถม E2ES-G1×2 |
| PASS | Wang Day: type=wang ทุกสินค้า → conditionCount null และไม่มีสินค้าตัวอย่าง | allProducts=true · ตัวอย่าง 0 |
| PASS | โปรที่ปิด (status=0) ไม่ถูกส่งมา | ไม่มี |
| PASS | Hot Deal ทั้งหมดของร้านทั่วไป: มีดีล H1 (ชื่อสินค้า · ซื้อ 10 แถม H2 1) · ไม่มีดีลสินค้าเฉพาะ L16 · hotDealTotal ≥ จำนวนที่ส่ง ≤ 60 | ของทดสอบ E2ES-H1 E2E local แถบโปร สินค้า Hot Deal · ส่ง 4 / ทั้งหมด 4 |
| PASS | Flash Sale วันนี้: live พร้อมสินค้า F1 จำกัด 5 (สินค้าทุกตัว ไม่กรองตามร้าน) | 2026-10-20 00:00-23:59 live=true · E2ES-F1×5 |
| PASS | Bundle Set ที่เปิด: ราคา 990 · 2 รายการ (มีของแถม) | E2E local แถบโปร ชุดหน้าฝน 990 · 2 รายการ |
| PASS | /customer-promotions เดิมยังตอบเหมือนเดิม (Hot Deal ของสินค้าที่ส่ง · matchedProCodes · ไม่มี sampleProducts) | HTTP 200 · hot 1 · matched E2ES-P01 |
| PASS | เก็บกวาด: ลบข้อมูลทดสอบหมด | เหลือ 0 |
