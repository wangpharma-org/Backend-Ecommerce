# E2E — สิทธิ์ดูคำสั่งจอง/สถานะของร้าน (order-list ownership)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `3dca434` · **base:** http://127.0.0.1:3038
- ข้อมูลทดสอบ: ร้าน/บิลขึ้นต้น `E2E-ID` สร้างตอนเริ่ม ลบเมื่อจบ · token ลงนามด้วย secret ของ backend ทดสอบ

## ผล 11/11

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี token → 401 (v2/order-list) |  |
| PASS | v2/order-list: ร้านตัวเอง 200 · ร้านอื่น 403 · ตัวพิมพ์เล็กของร้านตัวเองยังได้ | 200 / 403 / 200 |
| PASS | v2/order-list: admin (permission) และ role Admin ดูร้านอื่นได้ 200 | 200 / 200 |
| PASS | v2/order-list: เซลล์ ร้านในความดูแล 200 · ร้านนอกความดูแล 403 | 200 / 403 |
| PASS | all-order-member (แอป): ร้านตัวเอง 200 · ร้านอื่น 403 | 200 / 403 |
| PASS | some-order: บิลตัวเอง ไม่ 403 · บิลร้านอื่น 403 | 200 / 403 |
| PASS | v2/order-detail: บิลร้านอื่น 403 · บิลตัวเอง ไม่ 403 · admin ไม่ 403 | 403 / 404 / 404 |
| PASS | legacy/order-list: ไม่มี token 401 · ร้านตัวเอง 200 · ร้านอื่น 403 | 401 / 200 / 403 |
| PASS | legacy/order-detail: ไม่มี token 401 · บิลร้านอื่น 403 · ใส่ mem_code ร้านอื่นเอง 403 | 401 / 403 / 403 |
| PASS | v2/order-status ของบิลร้านอื่น ไม่คืนข้อมูล (เดิมกรองด้วย token อยู่แล้ว: 404) | 404 |
| PASS | internal token ยังใช้ได้ (ecom/internal/product-coin) 200 | 200 |
