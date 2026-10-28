# E2E — พนักงานขายขออนุญาตเข้าดูแลตะกร้าลูกค้า

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `fd73b6f` · **base:** http://127.0.0.1:3131
- ข้อมูลทดสอบ E2E-SCS1..3 (สร้าง/ลบเอง)

## ผล 11/11

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี internal token → 403 · ลูกค้าไม่มี JWT → 401 | 403 / 401 |
| PASS | ยังไม่เคยอนุญาต → awaiting_consent · ลูกค้าเห็นคำขอพร้อมชื่อ/ชื่อเล่น | awaiting_consent · request {"id":12,"sales_name":"E2E นุช","sales_nick":"นุช","requested_seconds_ago":0} |
| PASS | internal บอกเจ้าของรอบ (emp_code) · ฝั่งลูกค้าไม่มีรหัสพนักงาน | internal E2E-0743 · ลูกค้า ไม่เห็น |
| PASS | ลูกค้าอนุญาต → active · ลูกค้าเห็นแถบดูแล + รายการ · ตอบซ้ำ 409 | session 01be7f99 · sale เห็น active/web · อายุ 90 วัน · ซ้ำ 409 |
| PASS | touch อัปเดตรายการ · end saved → ลูกค้าเห็น "สั่งให้แล้ว" · end ซ้ำไม่เปลี่ยน | lines 2 · saved/saved · saved true |
| PASS | ใบใหม่ของร้านเดิมใน 90 วัน → active ทันที ไม่ถามซ้ำ | active |
| PASS | เปิดใบอื่นของร้านเดิม → รอบเก่าจบแบบ replaced | replaced |
| PASS | ลูกค้าไม่อนุญาต → denied · เซลส์กดยืนยันทางโทรศัพท์ → active (phone, บันทึกผู้กด) | denied → active · phone/E2E-0743 |
| PASS | ลูกค้าถอนความยินยอม → รอบที่ดูแลอยู่เป็น denied · ใบต่อไปต้องถามใหม่ | denied · ใบใหม่ awaiting_consent |
| PASS | ไม่มีความเคลื่อนไหว 30 นาที → จบเอง (คำขอหายจากลูกค้า) · ความยินยอมเกิน 90 วัน → ถามใหม่ | idle · ร้าน1 ใบใหม่ awaiting_consent |
| PASS | ตอบคำขอของร้านอื่น → 404 · ทิ้งใบร่าง → discarded + คำขอหมดอายุ · reason ผิด 400 | 404 · discarded · คำขอ expired · 400 |
