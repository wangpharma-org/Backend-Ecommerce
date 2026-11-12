# E2E — สถานะออเดอร์แบบเว็บร้านค้าเดิม (ลูกค้า + ระบบขาย)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `8574c24` · **base:** http://127.0.0.1:3021
- ข้อมูลทดสอบ "E2E local" สร้างและลบในสคริปต์

## ผล 2/7

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี token → 403 (internal ตาราง / ลูกค้า / batch) | 403 / 401 / 403 |
| FAIL | ช่วงค่าเริ่ม: ครบ 7 บิล สถานะ/ป้ายตรงตาราง legacy · ไม่มีบิลเก่า 60 วัน / บิลร้านอื่น | HTTP 200 · 1 บิล · ผิด: E2E-SO-PICK,E2E-SO-CHK,E2E-SO-BLK,E2E-SO-RDY,E2E-SO-DLV,E2E-SO-DONE · ช่วง 2026-10-13→2026-11-12 |
| PASS | เรียงใหม่→เก่า | E2E-SO-OPEN |
| FAIL | รายการ: RT = ขาดชั่วคราว · ตรวจนับขาด = short · เลขที่ใบกำกับ · บิลที่ยังไม่ถึงคลังใช้รายการตอนสั่ง | RDY: P2 rt=undefined P3 short=undefined ขาด undefined บิล undefined · DONE undefined · OPEN 2 รายการ 260 |
| FAIL | ช่วงย้อนหลัง → เฉพาะบิลเก่า · เกิน 92 วัน → truncated | - · truncated=true (2026-08-12) |
| FAIL | ลูกค้า: ได้ชุดเดียวกับ internal · ร้านอื่น login ไม่เห็นบิลร้านนี้ | ร้าน E2E-OS1: 200 1 บิล · ร้าน E2E-OS2: - |
| FAIL | batch หลายร้าน: สถานะ/ป้ายถูกต่อใบต่อร้าน (เลขบิลที่ไม่ใช่ของร้าน = ยังไม่ถึงคลัง) | HTTP 201 · E2E-OS1/E2E-SO-BLK=opened E2E-OS1/E2E-SO-DONE=opened E2E-OS2/E2E-SO2-PICK=opened E2E-OS2/E2E-SO-DONE=opened |
