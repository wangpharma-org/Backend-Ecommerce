# Bill PDF download (ECWC-767) E2E report

- environment: **local** (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)
- BASE_URL: http://localhost:3021/api
- commit: 7c32d67
- run at: 2026-11-13T15:16:34.436Z
- ร้าน/บิลทดสอบ: 04331 / 0350-443568
- อ่านอย่างเดียว ไม่สร้าง/แก้ข้อมูล
- result: **6/6 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | T1 ตาราง 6 เดือน: ไม่ถูกตัดช่วง + บิลที่ออกแล้วมีเลขบิล | 200 | PASS | date_from=2026-05-13 orders=133 0350-443568=5216-08825 |
| 2 | T2 การ์ด order-list: ทุกใบมี bill_invoice_no (string|null) | 200 | PASS | cards=10 withBill=1 |
| 3 | P1 ดาวน์โหลด PDF ร้านตัวเอง → application/pdf | 200 | PASS | application/pdf attachment; filename="5216-08825.pdf" 113508 bytes |
| 4 | P2 token ร้านอื่นขอบิลร้านนี้ → 403 | 403 | PASS |  |
| 5 | P3 ใบสั่งจองที่ยังไม่มีบิล → 404 ยังไม่มีบิล | 404 | PASS | ยังไม่มีบิล |
| 6 | P4 ไม่มี token → 401 | 401 | PASS |  |