# E2E feature-flag-admin (ECWC-749) — local

- environment: **local**
- commit: `8574c24`
- เวลา: 2026-11-11T22:35:36.493Z
- BASE_URL: http://localhost:3021/api
- flag ทดสอบ: `e2e-local-ecwc749` (จบที่ปิด)
- ผล: **19 ผ่าน / 0 ไม่ผ่าน / 0 ข้าม**

| # | ขั้น | ผล | ที่เห็น |
|---|---|---|---|
| 1 | อ่าน flag ตัวเดียวแบบไม่ล็อกอิน ยังได้ (หน้าเว็บลูกค้าใช้) | ผ่าน | HTTP 200 → true |
| 2 | Admin ตั้ง flag ทดสอบเป็นเปิดก่อนเริ่ม | ผ่าน | HTTP 201 |
| 3 | ไม่มี token → 401 | ผ่าน | HTTP 401 |
| 4 | token ร้านค้าเปลี่ยน flag → 403 | ผ่าน | HTTP 403 |
| 5 | flag ไม่เปลี่ยนหลังร้านค้าลอง | ผ่าน | ค่า true |
| 6 | token ร้านค้าแตะ flag "all" → 403 | ผ่าน | HTTP 403 |
| 7 | token ร้านค้าดูรายการ flag → 403 | ผ่าน | HTTP 403 |
| 8 | token ร้านค้าดูประวัติ flag → 403 | ผ่าน | HTTP 403 |
| 9 | Sales ที่มีแค่ permission (ไม่มีเมนู feature-flag) → 403 | ผ่าน | HTTP 403 |
| 10 | token ขอบเขตจำกัด (review) แม้ role Admin → 403 | ผ่าน | HTTP 403 |
| 11 | บัญชีที่ได้เมนู feature-flag เปลี่ยนได้ | ผ่าน | HTTP 201 ค่าใหม่ false |
| 12 | Admin เปลี่ยนได้ (ปิด → เปิด) | ผ่าน | HTTP 201/201 |
| 13 | body ผิดรูป (status เป็นข้อความ / ไม่มี flag / flag ยาวเกิน) → 400 | ผ่าน | HTTP 400/400/400 |
| 14 | Admin ดูรายการ flag ได้ และมี flag ทดสอบ | ผ่าน | HTTP 200 |
| 15 | ประวัติ: รายการล่าสุดคือ Admin เปลี่ยน false → true | ผ่าน | HTTP 200 ล่าสุด {"id":13,"feature_key":"e2e-local-ecwc749","old_value":false,"new_value":true,"actor_mem_code":"E2E-A01","actor_username":"e2e-admin","actor_role":"Admin","created_at":"2026-11-11T22:35:37.157Z"} |
| 16 | ประวัติครบ 4 รายการของรอบนี้ และไม่มีรายการจากร้านค้า/บัญชีที่ถูกปฏิเสธ | ผ่าน | ได้ 4 รายการ: E2E-A01:false→true, E2E-A01:false→false, E2E-S02:true→false, E2E-A01:true→true |
| 17 | ประวัติบันทึกคนที่ได้เมนู feature-flag ด้วย | ผ่าน |  |
| 18 | limit ผิด → 400 | ผ่าน | HTTP 400 |
| 19 | จบ: ตั้ง flag ทดสอบเป็นปิด | ผ่าน | HTTP 201 |
