# E2E activity-tracking — local

- environment: **local**
- commit: Backend-Ecommerce `e3e381c` · sale-backend `16979f5`
- เวลา: 2026-10-24T04:12:17.653Z
- e-commerce: http://localhost:3051/api · sale-backend: http://localhost:3062/api/sale
- โปร: 41 · สินค้า E2E-P01 × 30 · ร้าน E2E-C01 · สั่งซื้อ: ใช่
- tag ข้อมูลทดสอบ: session_id ขึ้นต้น `E2E local 2026-10-24T04:12:17`
- ผล: **16/16**

| # | ขั้น | ผล | รายละเอียด |
|---|---|---|---|
| 1 | flag activity_tracking เปิดอยู่แล้ว | PASS | ไม่ต้องแตะ |
| 2 | ไม่มี token → ถูกปฏิเสธ | PASS | HTTP 401 |
| 3 | เกิน 50 รายการ → 400 | PASS | HTTP 400 |
| 4 | ส่งชุดอีเวนต์: รับ 3 ทิ้ง 3 (add_cart จาก client / ชื่อฟีเจอร์ผิด / โปรไม่มีจริง) | PASS | HTTP 200 {"enabled":true,"accepted":3,"dropped":3} |
| 5 | ใส่ตะกร้า 1 ชิ้น (ยังไม่ถึงขั้น) | PASS | HTTP 201 |
| 6 | ใส่ตะกร้าจนครบ 30 ชิ้น (ถึงขั้น) | PASS | HTTP 201 |
| 7 | สั่งซื้อ (sales ทำแทน emp_code) | PASS | HTTP 201 005-000003 |
| 8 | sale-backend summary เห็นทุกขั้น | PASS | มี impression,open,click,add_cart,order (ต้องการ impression,open,click,add_cart,order) |
| 9 | ร้านทดสอบอยู่ในรายชื่อร้าน ขั้นลึกสุดถูก | PASS | {"memCode":"E2E-C01","stage":"order","impressions":1,"opens":1,"clicks":1,"addCarts":2,"orders":1,"value":4650,"channels":["web"],"empCodes":["E2E-EMP"],"firstAt":"2026-10-24T04:12:17.685Z","lastAt":"2026-10-24T04:12:21.779Z"} |
| 10 | add_cart ครบ 2 ครั้ง รวมครั้งที่ยังไม่ถึงขั้น | PASS | addCarts=2 |
| 11 | channel = web (จาก User-Agent) | PASS | ["web"] |
| 12 | ยอดบาทของออเดอร์ > 0 | PASS | value=4650 |
| 13 | emp_code ของ sales ติดมากับออเดอร์ | PASS | ["E2E-EMP"] |
| 14 | summary แยก actorType=sales ของ order | PASS | [{"channel":"web","actorType":"sales","action":"order","events":1,"stores":1,"value":4650}] |
| 15 | ไม่มีสิทธิ์ SALE_ACTIVITY:READ → 403 | PASS | HTTP 403 |
| 16 | query ผิดรูปแบบ → 400 | PASS | HTTP 400 |
