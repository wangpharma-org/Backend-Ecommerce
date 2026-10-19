# Member login block (SSN0-273) E2E report

- environment: **local** (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)
- BASE_URL: http://localhost:3023/api
- commit: 083418c
- run at: 2026-10-19T05:24:42.908Z
- mem_code ทดสอบ: E2E-LB-1792387481436 (ลบแล้วเมื่อจบ)
- ไม่ครอบคลุม: LINE login / LINE link login (ต้องมี notification-service จริง)
- result: **28/28 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | F1 flag ปิด: GET สถานะ enabled=false | 200 | PASS | enabled=false |
| 2 | F2 flag ปิด: block → 403 FEATURE_DISABLED | 403 | PASS | {"statusCode":403,"error":"Forbidden","code":"FEATURE_DISABLED","message":"ฟีเจอร์ระงับการเข้าใช้งาน E-commerce ยังไม่เปิด"} |
| 3 | F3 เปิด flag | 201 | PASS |  |
| 4 | G1 ไม่มี x-internal-token → 403 | 403 | PASS |  |
| 5 | G2 x-internal-token ผิด → 403 | 403 | PASS |  |
| 6 | G3 token ลูกค้า (Bearer) เรียก internal route ไม่ได้ → 403 | 403 | PASS |  |
| 7 | A1 login ด้วยรหัสผ่าน → 200 | 201 | PASS |  |
| 8 | A2 สร้าง session | 201 | PASS |  |
| 9 | A3 token ใช้ API ที่ต้อง login ได้ (GET store-visibility) | 200 | PASS |  |
| 10 | V1 block ไม่มีเหตุผล → 400 | 400 | PASS | ["ต้องระบุเหตุผลการระงับ"] |
| 11 | V2 block ไม่มีผู้ทำรายการ → 400 | 400 | PASS |  |
| 12 | V3 เหตุผลยาวเกิน 500 → 400 | 400 | PASS |  |
| 13 | V4 ร้านที่ไม่มีบัญชี → 404 | 404 | PASS | "ไม่พบบัญชี E-commerce ของร้าน E2E-LB-1792387481436-X" |
| 14 | V5 GET ร้านที่ไม่มีบัญชี → has_account=false | 200 | PASS |  |
| 15 | V6 รหัสร้านยาวเกิน 30 → 400 | 400 | PASS |  |
| 16 | B1 block → 200 changed=true พร้อมผู้ทำรายการ + log | 200 | PASS | reason=[TEST] ค้างชำระเกินกำหนด by=E2E001 |
| 17 | B2 token เดิมถูกเตะทันที → 403 LOGIN_BLOCKED | 403 | PASS | "บัญชีร้านนี้ถูกระงับการเข้าใช้งาน ([TEST] ค้างชำระเกินกำหนด) กรุณาติดต่อพนักงานขาย" |
| 18 | B3 refresh token เดิม → 403 LOGIN_BLOCKED | 403 | PASS |  |
| 19 | B4 DB: refresh token ของร้านถูกลบ + session ถูกปิดหมด | 0 | PASS | refresh=0 activeSessions=0 |
| 20 | B5 login ใหม่ (รหัสถูก) → 403 LOGIN_BLOCKED พร้อมเหตุผล | 403 | PASS | "บัญชีร้านนี้ถูกระงับการเข้าใช้งาน ([TEST] ค้างชำระเกินกำหนด) กรุณาติดต่อพนักงานขาย" |
| 21 | B6 login รหัสผิด → 401 (ไม่บอกสถานะระงับ) | 401 | PASS |  |
| 22 | B7 block ซ้ำ → changed=false ไม่มี log เพิ่ม | 200 | PASS | logs=1 |
| 23 | U1 unblock → 200 changed=true ล้างเหตุผล | 200 | PASS | logs=UNBLOCK,BLOCK |
| 24 | U2 login ได้ตามปกติ | 201 | PASS |  |
| 25 | U3 token ใหม่ใช้ API ได้ | 200 | PASS |  |
| 26 | U4 ประวัติ: UNBLOCK, BLOCK (ใหม่สุดก่อน) พร้อมผู้ทำรายการ | 200 | PASS | UNBLOCK:[TEST] ชำระแล้ว \| BLOCK:[TEST] ค้างชำระเกินกำหนด |
| 27 | Z1 คืนค่า flag member_login_block = false | 201 | PASS |  |
| 28 | Z2 ลบข้อมูลทดสอบของ E2E-LB-1792387481436 | 0 | PASS |  |