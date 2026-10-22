# Store visibility consent (ECWC-600/617) E2E report

- environment: **local** (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)
- BASE_URL: http://localhost:3025/api
- commit: e902625
- run at: 2026-10-14T11:00:28.514Z
- mem_code ทดสอบ: E2E-SV-1791975627894-A, E2E-SV-1791975627894-B (log ค้างใน DB ตามหลัก append-only)
- flag store_name_consent: เดิม true → คืนค่าแล้ว
- ไม่ครอบคลุม: ชื่อร้าน/พิกัดใน order-status และ delivery/latest-store (ต้องมี logistics-backend จริง)
- result: **18/18 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | F0 ปิด flag store_name_consent | 201 | PASS | เดิม=true |
| 2 | F1 flag ปิด: GET → enabled=false, ไม่ถาม, ไม่แสดงชื่อ | 200 | PASS | status=NOT_ASKED show=false ask=false asked=0 enabled=false |
| 3 | F2 flag ปิด: PUT / POST asked → 403 | 403 | PASS | PUT=403 asked=403 |
| 4 | F3 เปิด flag store_name_consent | 201 | PASS |  |
| 5 | A1 ไม่มี token → ถูกปฏิเสธ | 401 | PASS |  |
| 6 | S1 ร้านใหม่: NOT_ASKED, ควรถาม, มีข้อความ consent จาก server | 200 | PASS | status=NOT_ASKED show=false ask=true asked=0 enabled=true consent.v=2 |
| 7 | S2 ปัดทิ้ง 3 ครั้ง → asked_count=3 แล้วหยุดถาม | 201 | PASS | counts=1,2,3 status=NOT_ASKED show=false ask=false asked=3 enabled=true |
| 8 | S3 ปัดครั้งที่ 4 → ไม่นับเพิ่ม (เพดาน 3) | 201 | PASS | status=NOT_ASKED show=false ask=false asked=3 enabled=true |
| 9 | S4 ครบเพดานแล้วยังเปิดเองจากหน้าตั้งค่าได้ → GRANTED | 200 | PASS | status=GRANTED show=true ask=false asked=3 enabled=true |
| 10 | S5 กดเปิดซ้ำ → ค่าเดิม (ไม่เขียน log ซ้ำ) | 200 | PASS | status=GRANTED show=true ask=false asked=3 enabled=true |
| 11 | S6 เปิดแล้วปิด (ถอน) จากแอป → DECLINED, ไม่แสดงชื่อ, ไม่ถามอีก | 200 | PASS | status=DECLINED show=false ask=false asked=3 enabled=true |
| 12 | S7 ร้าน B กด "ไม่เปิด" ตั้งแต่แรก → DECLINED และปัดทิ้งไม่นับ | 200 | PASS | status=DECLINED show=false ask=false asked=0 enabled=true · asked→0 |
| 13 | V1 show_store_name ไม่ใช่ boolean / ไม่ส่ง → 400 | 400 | PASS | "true"=400 {}=400 1=400 |
| 14 | V2 channel นอก WEB/APP → 400 | 400 | PASS | PUT=400 asked=400 |
| 15 | A2 ส่ง mem_code ของร้านอื่นใน body → ถูกตัดทิ้ง แก้ได้แค่ร้านตัวเอง | 200 | PASS | B=GRANTED A ยังเป็น DECLINED |
| 16 | L1 log ร้าน A ครบทุกการกด เพิ่มอย่างเดียว (ASKED×3, GRANTED, WITHDRAWN) | 0 | PASS | actions=ASKED,ASKED,ASKED,GRANTED,WITHDRAWN channel(last)=APP |
| 17 | L2 log ร้าน B: DECLINED → GRANTED → WITHDRAWN | 0 | PASS | actions=DECLINED,GRANTED,WITHDRAWN |
| 18 | Z คืนค่า flag store_name_consent = true | 201 | PASS |  |