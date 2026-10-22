# Drug type rewards (WGDD-427) E2E report

- environment: **local** (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)
- BASE_URL: http://localhost:3031/api
- commit: ea8f985
- run at: 2026-10-21T10:41:02.705Z
- สินค้าทดสอบ: @4095-02 (seed ประเภท E2E-DT-1792579262421 ลง DB แล้วลบเมื่อจบ)
- flag drug_type_reward: เดิม false → คืนค่าแล้ว
- ไม่ครอบคลุม: การรับข้อความ Kafka จริง (ดู unit test drug-type.service.spec.ts)
- result: **11/11 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | F0 ปิด flag drug_type_reward | 201 | PASS | เดิม=false |
| 2 | F1 flag ปิด: GET product + POST products → 403 | 403 | PASS | GET=403 POST=403 |
| 3 | F2 เปิด flag drug_type_reward | 201 | PASS |  |
| 4 | A1 ไม่มี token → ถูกปฏิเสธ | 401 | PASS |  |
| 5 | P1 หน้าสินค้า: ได้ประเภท + รายการแถม/พ่วง | 200 | PASS | type=E2E-DT-1792579262421 rewards=2 |
| 6 | P2 ตะกร้า: map เฉพาะสินค้าที่มีแถม/พ่วง | 201 | PASS | keys=@4095-02 |
| 7 | P3 สินค้าไม่มีประเภท → drug_type = null | 200 | PASS |  |
| 8 | V1 body ผิด (ไม่ใช่ array) → 400 | 400 | PASS |  |
| 9 | L1 ประเภทปิดใช้งาน → ไม่แสดง | 200 | PASS |  |
| 10 | Z1 คืนค่า flag drug_type_reward = false | 201 | PASS |  |
| 11 | Z2 ลบประเภททดสอบ + คืน drug_type_code ของสินค้า | 0 | PASS | E2E-DT-1792579262421 / @4095-02 |