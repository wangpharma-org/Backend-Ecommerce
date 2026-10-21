# E2E — สถานะออเดอร์แบบเว็บร้านค้าเดิม (ลูกค้า + ระบบขาย)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `01eb9cb` · **base:** http://127.0.0.1:3037 · คลัง/ขนส่งจำลอง http://127.0.0.1:5741
- ข้อมูลทดสอบ "E2E local" สร้างและลบในสคริปต์

## ผล 8/8

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี token → 403 (internal ตาราง / ลูกค้า / batch) | 403 / 401 / 403 |
| PASS | ช่วงค่าเริ่ม: ครบ 7 บิล สถานะ/ป้ายตรงตาราง legacy · ไม่มีบิลเก่า 60 วัน / บิลร้านอื่น | HTTP 200 · 7 บิล · ผิด: - · ช่วง 2026-09-18→2026-10-18 |
| PASS | เรียงใหม่→เก่า | E2E-SO-OPEN → E2E-SO-PICK → E2E-SO-CHK → E2E-SO-BLK → E2E-SO-RDY → E2E-SO-DLV → E2E-SO-DONE |
| PASS | รายการ: RT = ขาดชั่วคราว · ตรวจนับขาด = short · เลขที่ใบกำกับ · บิลที่ยังไม่ถึงคลังใช้รายการตอนสั่ง | RDY: P2 rt=true P3 short=true ขาด 1 บิล E2E-IV-0005 · DONE E2E-IV-0007 · OPEN 2 รายการ 260 |
| PASS | ช่วงย้อนหลัง → เฉพาะบิลเก่า · เกิน 92 วัน → truncated | E2E-SO-OLD · truncated=true (2026-07-18) |
| PASS | ลูกค้า: ได้ชุดเดียวกับ internal · ร้านอื่น login ไม่เห็นบิลร้านนี้ | ร้าน E2E-OS1: 200 7 บิล · ร้าน E2E-OS2: E2E-SO2-PICK |
| PASS | batch หลายร้าน: สถานะ/ป้ายถูกต่อใบต่อร้าน (เลขบิลที่ไม่ใช่ของร้าน = ยังไม่ถึงคลัง) | HTTP 201 · E2E-OS1/E2E-SO-BLK=blocked E2E-OS1/E2E-SO-DONE=done E2E-OS2/E2E-SO2-PICK=picking E2E-OS2/E2E-SO-DONE=opened |
| PASS | คลังล่ม → ไม่ 500 · partial=true · บิลจาก ecommerce ยังแสดง | HTTP 200 · partial=true · 1 บิล |
