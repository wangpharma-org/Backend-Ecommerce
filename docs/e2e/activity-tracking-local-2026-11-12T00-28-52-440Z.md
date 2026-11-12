# E2E activity-tracking — local

- environment: **local**
- commit: Backend-Ecommerce `290d87a` · sale-backend `ไม่ระบุ`
- เวลา: 2026-11-12T00:28:35.102Z
- e-commerce: http://localhost:3026/api · sale-backend: http://localhost:3401/api/sale · e-commerce (broker ไม่ตอบ): http://localhost:3027/api
- โปร: 218 · สินค้า 15060604 × 30 · ร้าน E2E-SV-SHOP-A · สั่งซื้อ: ใช่
- tag ข้อมูลทดสอบ: session_id ขึ้นต้น `E2E local 2026-11-12T00:28:34`
- ผล: **24/24**

| # | ขั้น | ผล | รายละเอียด |
|---|---|---|---|
| 1 | เปิด flag activity_tracking | PASS | HTTP 201 |
| 2 | เตรียมโปรทดสอบ soft delete | PASS | ลบทั้งโปร #267 · ลบขั้น #268 · ควบคุม #269 |
| 3 | ไม่มี token → ถูกปฏิเสธ | PASS | HTTP 401 |
| 4 | เกิน 50 รายการ → 400 | PASS | HTTP 400 |
| 5 | ส่งชุดอีเวนต์: รับ 3 ทิ้ง 3 (add_cart จาก client / ชื่อฟีเจอร์ผิด / โปรไม่มีจริง) | PASS | HTTP 200 {"enabled":true,"accepted":3,"dropped":3} |
| 6 | ใส่ตะกร้า 1 ชิ้น (ยังไม่ถึงขั้น) | PASS | HTTP 201 |
| 7 | ใส่ตะกร้าจนครบ 30 ชิ้น (ถึงขั้น) | PASS | HTTP 201 |
| 8 | สั่งซื้อ (sales ทำแทน emp_code) | PASS | HTTP 201 005-102010 |
| 9 | sale-backend summary เห็นทุกขั้น | PASS | มี impression,open,click,add_cart,order (ต้องการ impression,open,click,add_cart,order) |
| 10 | ร้านทดสอบอยู่ในรายชื่อร้าน ขั้นลึกสุดถูก | PASS | {"memCode":"E2E-SV-SHOP-A","stage":"order","impressions":1,"opens":1,"clicks":1,"addCarts":2,"orders":1,"value":806,"channels":["web"],"empCodes":["E2E-EMP"],"firstAt":"2026-11-12T00:28:36.400Z","lastAt":"2026-11-12T00:28:43.809Z"} |
| 11 | add_cart ครบ 2 ครั้ง รวมครั้งที่ยังไม่ถึงขั้น | PASS | addCarts=2 |
| 12 | channel = web (จาก User-Agent) | PASS | ["web"] |
| 13 | ยอดบาทของออเดอร์ > 0 | PASS | value=806 |
| 14 | emp_code ของ sales ติดมากับออเดอร์ | PASS | ["E2E-EMP"] |
| 15 | summary แยก actorType=sales ของ order | PASS | [{"channel":"web","actorType":"sales","action":"order","events":1,"stores":1,"value":806}] |
| 16 | โปรควบคุม (ไม่ถูกลบ) ถูกนับ add_cart — server เห็นโปรทดสอบจริง | PASS | addCarts=2 |
| 17 | โปรที่ถูก soft delete ไม่ถูกนับ add_cart | PASS | ไม่มีอีเวนต์ |
| 18 | โปรที่ขั้นถูก soft delete ไม่ถูกนับ add_cart | PASS | ไม่มีอีเวนต์ |
| 19 | ไม่มีสิทธิ์ SALE_ACTIVITY:READ → 403 | PASS | HTTP 403 |
| 20 | query ผิดรูปแบบ → 400 | PASS | HTTP 400 |
| 21 | broker ไม่ตอบ: POST 50 รายการ 3 ครั้ง ตอบภายใน 2000ms ทุกครั้ง | PASS | HTTP 200 53ms accepted=50 · HTTP 200 27ms accepted=50 · HTTP 200 13ms accepted=50 |
| 22 | broker ไม่ตอบ: หลังพลาด 3 ชุดติดกัน พักส่ง (accepted=0) และยังตอบเร็ว | PASS | HTTP 200 15ms {"enabled":true,"accepted":0,"dropped":50} |
| 23 | ลบโปรทดสอบ soft delete | PASS | ลบโปรทดสอบ 267,268,269 แล้ว |
| 24 | คืนค่า flag activity_tracking = ปิด | PASS | HTTP 201 |
