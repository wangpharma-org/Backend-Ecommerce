# E2E activity-tracking — local

- environment: **local**
- commit: Backend-Ecommerce `62bee05` · sale-backend `b2db9c4`
- เวลา: 2026-11-10T17:02:34.495Z
- e-commerce: http://localhost:3071/api · sale-backend: http://localhost:3074/api/sale · e-commerce (broker ไม่ตอบ): http://localhost:3072/api
- โปร: 41 · สินค้า E2E-P01 × 30 · ร้าน E2E-C01 · สั่งซื้อ: ใช่
- tag ข้อมูลทดสอบ: session_id ขึ้นต้น `E2E local 2026-11-10T17:02:34`
- ผล: **23/23**

| # | ขั้น | ผล | รายละเอียด |
|---|---|---|---|
| 1 | flag activity_tracking เปิดอยู่แล้ว | PASS | ไม่ต้องแตะ |
| 2 | เตรียมโปรทดสอบ soft delete | PASS | ลบทั้งโปร #43 · ลบขั้น #44 · ควบคุม #45 |
| 3 | ไม่มี token → ถูกปฏิเสธ | PASS | HTTP 401 |
| 4 | เกิน 50 รายการ → 400 | PASS | HTTP 400 |
| 5 | ส่งชุดอีเวนต์: รับ 3 ทิ้ง 3 (add_cart จาก client / ชื่อฟีเจอร์ผิด / โปรไม่มีจริง) | PASS | HTTP 200 {"enabled":true,"accepted":3,"dropped":3} |
| 6 | ใส่ตะกร้า 1 ชิ้น (ยังไม่ถึงขั้น) | PASS | HTTP 201 |
| 7 | ใส่ตะกร้าจนครบ 30 ชิ้น (ถึงขั้น) | PASS | HTTP 201 |
| 8 | สั่งซื้อ (sales ทำแทน emp_code) | PASS | HTTP 201 005-000008 |
| 9 | sale-backend summary เห็นทุกขั้น | PASS | มี impression,open,click,add_cart,order (ต้องการ impression,open,click,add_cart,order) |
| 10 | ร้านทดสอบอยู่ในรายชื่อร้าน ขั้นลึกสุดถูก | PASS | {"memCode":"E2E-C01","stage":"order","impressions":1,"opens":1,"clicks":1,"addCarts":2,"orders":1,"value":4650,"channels":["web"],"empCodes":["E2E-EMP"],"firstAt":"2026-11-10T17:02:34.571Z","lastAt":"2026-11-10T17:02:38.890Z"} |
| 11 | add_cart ครบ 2 ครั้ง รวมครั้งที่ยังไม่ถึงขั้น | PASS | addCarts=2 |
| 12 | channel = web (จาก User-Agent) | PASS | ["web"] |
| 13 | ยอดบาทของออเดอร์ > 0 | PASS | value=4650 |
| 14 | emp_code ของ sales ติดมากับออเดอร์ | PASS | ["E2E-EMP"] |
| 15 | summary แยก actorType=sales ของ order | PASS | [{"channel":"web","actorType":"sales","action":"order","events":1,"stores":1,"value":4650}] |
| 16 | โปรควบคุม (ไม่ถูกลบ) ถูกนับ add_cart — server เห็นโปรทดสอบจริง | PASS | addCarts=2 |
| 17 | โปรที่ถูก soft delete ไม่ถูกนับ add_cart | PASS | ไม่มีอีเวนต์ |
| 18 | โปรที่ขั้นถูก soft delete ไม่ถูกนับ add_cart | PASS | ไม่มีอีเวนต์ |
| 19 | ไม่มีสิทธิ์ SALE_ACTIVITY:READ → 403 | PASS | HTTP 403 |
| 20 | query ผิดรูปแบบ → 400 | PASS | HTTP 400 |
| 21 | broker ไม่ตอบ: POST 50 รายการ 3 ครั้ง ตอบภายใน 2000ms ทุกครั้ง | PASS | HTTP 200 16ms accepted=50 · HTTP 200 9ms accepted=50 · HTTP 200 5ms accepted=50 |
| 22 | broker ไม่ตอบ: หลังพลาด 3 ชุดติดกัน พักส่ง (accepted=0) และยังตอบเร็ว | PASS | HTTP 200 6ms {"enabled":true,"accepted":0,"dropped":50} |
| 23 | ลบโปรทดสอบ soft delete | PASS | ลบโปรทดสอบ 43,44,45 แล้ว |
## เทียบกับโค้ดก่อนแก้ (adf9ca4, local เดียวกัน)

- โปร soft delete: สคริปต์ชุดนี้กับโค้ดเดิม → **FAIL** ทั้ง 2 เคส — โปรที่ถูกลบ (#46) และโปรที่ขั้นถูกลบ (#47) ถูกนับ add_cart ครั้งละ 2 รายการ
- broker ไม่ตอบ (TCP รับแต่ไม่ตอบ, 127.0.0.1:19349): POST /ecom/activity 50 รายการ โค้ดเดิมใช้ **46.6 / 45.6 / 44.3 วินาที** ต่อ request (ทุกครั้ง) · โค้ดใหม่ **5–16 ms** และหลังพลาด 3 ชุดติดกันพักส่ง 60 วินาที (log: `activity emit failed 3 times in a row — pausing 60s`)

## หมายเหตุ

- environment **local** = ผ่านก่อน merge เท่านั้น ยังต้องรันซ้ำกับ deployed หลัง deploy
- ฐานทดสอบที่ใช้เป็นสำเนาชั่วคราว (`ecommerce_e2e_ecom349` บน devstack MySQL, `sale_ecom349_e2e` บน preview-local-sale-mysql) ลบทิ้งหลังรันแล้ว · Kafka = devstack :9092 topic `activity_event`
- sale-backend ที่ใช้ = branch dev `b2db9c4` (มี #133 แล้ว)
