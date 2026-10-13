# Sticker label (ECWC-697) E2E report

- environment: **local** (เครื่อง dev + DB ทดสอบ ไม่ใช่ deployed code)
- BASE_URL: http://localhost:3022/api
- commit: 3633d13
- run at: 2026-10-12T09:32:53.264Z
- ร้านทดสอบ: 00004 · admin: 0007
- ออเดอร์ทดสอบที่สร้าง: 005-101923
- ครอบคลุม: ECWC-698 ตัวเลือก/map รหัส · ECWC-699 custom_options ตะกร้า/snapshot · ECWC-702 คิวพิมพ์ + sticker_print_log · ECWC-704 PDF A4 (ดวง 80×50 มม.)
- result: **44/44 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | flag ปิด → config ต้อง 403 | 403 | PASS |  |
| 2 | admin เปิด flag sticker_label | 201 | PASS |  |
| 3 | config คืน 2 mode map รหัส -05/-07 + 2 ขนาดบรรจุ + 6 ภาษา | 200 | PASS | bw/แผ่น=1.9 bw/50แผ่น=95 |
| 4 | เพิ่มสติ๊กเกอร์ผ่าน add-cart ปกติ (ไม่มีรูปแบบ) → 400 | 400 | PASS |  |
| 5 | last-options ก่อนสั่งรอบนี้ → null หรือรูปแบบเดิม | 200 | PASS | มีออเดอร์เดิม: E2E local ร้านยาทดสอบ |
| 6 | validate: ไม่มีชื่อร้าน → 400 | 400 | PASS | ต้องระบุชื่อร้าน |
| 7 | validate: ชื่อร้าน 41 ตัวอักษร → 400 | 400 | PASS | shopName ยาวได้ไม่เกิน 40 ตัวอักษร |
| 8 | validate: ที่อยู่ 56 ตัวอักษร → 400 | 400 | PASS | address ยาวได้ไม่เกิน 55 ตัวอักษร |
| 9 | validate: บรรทัด 3 41 ตัวอักษร → 400 | 400 | PASS | line3 ยาวได้ไม่เกิน 40 ตัวอักษร |
| 10 | validate: mode สีไม่มี hex → 400 | 400 | PASS | mode สี ต้องระบุ color เป็น hex #RRGGBB |
| 11 | validate: mode สี hex ผิด → 400 | 400 | PASS | mode สี ต้องระบุ color เป็น hex #RRGGBB |
| 12 | validate: ภาษาไม่รองรับ → 400 | 400 | PASS | lang ต้องเป็น th\|en\|zh\|ru\|ar\|my |
| 13 | validate: packSize ไม่รองรับ → 400 | 400 | PASS | packSize ต้องเป็น 1\|50 |
| 14 | validate: packs = 0 → 400 | 400 | PASS | packs ต้องเป็นจำนวนเต็มบวก |
| 15 | validate: packs = "2a" → 400 | 400 | PASS | packs ต้องเป็นจำนวนเต็มบวก |
| 16 | หยิบขาวดำ ไทย 1 แผ่น × 2 (ส่ง color มาด้วยต้องถูกตัดทิ้ง) | 201 | PASS | spc_id=1322263 unit=ดวง amount=20.00 |
| 17 | หยิบรูปแบบเดิมอีก 1 → รวมเป็นแถวเดียว 3 แผ่น | 201 | PASS | rows=1 sheets=3 |
| 18 | หยิบรูปแบบต่าง (English) → แยกเป็นอีกแถวในสินค้าเดียวกัน | 201 | PASS | rows=2 |
| 19 | หยิบสี 50 แผ่น × 1 → รหัส -07 หน่วย ม500ดวง | 201 | PASS | unit=ม500ดวง sheets=50 |
| 20 | แก้จำนวนแถวไทยเป็น 5 แผ่น (แถวอื่นไม่เปลี่ยน) | 201 | PASS | th=5 en=1 |
| 21 | ตั้งแถว English = 0 → ลบเฉพาะแถวนั้น | 201 | PASS | rows=2 |
| 22 | แก้แถวที่ไม่มี/ไม่ใช่ของร้าน → 404 | 404 | PASS |  |
| 23 | GET ตะกร้าคืน custom_options + จำนวนแผ่น | 200 | PASS | rows=2 |
| 24 | สั่งซื้อจากตะกร้า | 201 | PASS | soh_running=005-101923 |
| 25 | ตะกร้าว่างหลังสั่ง | 200 | PASS |  |
| 26 | last-options คืนรูปแบบจากออเดอร์ล่าสุด (ไม่มี sheets/dots) | 200 | PASS | printMode=color lang=ar |
| 27 | ลูกค้าเรียก API admin → 403 | 403 | PASS |  |
| 28 | validate queue: status ผิด / page ผิด → 400 | 400 | PASS | status=400 page=400 |
| 29 | คิวรอพิมพ์มีทั้ง 2 งานจาก snapshot + สรุปแยกขาวดำ/สี | 200 | PASS | bw spo=1172034 color spo=1172035 summary bw=5 color=50 |
| 30 | รายการเครื่องพิมพ์จาก env | 200 | PASS | e2e-bw,e2e-color |
| 31 | พิมพ์งานสีด้วยเครื่องขาวดำ → 400 (ไม่บันทึก log) | 400 | PASS | เครื่อง E2E local ขาวดำ เป็นเครื่องขาวดำ พิมพ์งานสีไม่ได้: 1172035 |
| 32 | print_type / เครื่องพิมพ์ ไม่ถูกต้อง → 400 | 400 | PASS | 400/400/400 |
| 33 | preview PDF 1 หน้า A4 (ไม่บันทึก log) | 200 | PASS | pages=1 a4=true |
| 34 | ลูกค้าเรียก preview PDF → 403 | 403 | PASS |  |
| 35 | PDF งานสีกับเครื่องขาวดำ → 400 ไม่มี log | 400 | PASS |  |
| 36 | PDF พิมพ์ทดสอบ → 1 หน้า + id ของ log ใน header | 201 | PASS | pages=1 log=18 |
| 37 | พิมพ์ทดสอบ (test) → 1 แผ่น สถานะยังรอพิมพ์ | 201 | PASS | status=pending count=0 |
| 38 | พิมพ์จริง (print) → พิมพ์แล้ว, printed_by จาก token ไม่ใช่ body | 201 | PASS | printed_by=0007 sheets=5 |
| 39 | print ซ้ำงานที่พิมพ์แล้ว → 400 ให้ใช้ reprint | 400 | PASS | งานนี้พิมพ์แล้ว ให้ใช้พิมพ์ซ้ำ (reprint): 1172034 |
| 40 | reprint → จำนวนครั้ง 2 สถานะยังพิมพ์แล้ว | 201 | PASS | count=2 last=0007 |
| 41 | PDF งานสี 50 แผ่นด้วยเครื่องสี → 50 หน้า, คิวรอพิมพ์ไม่มีงานของออเดอร์นี้ | 201 | PASS | pdf pages=50 pending left=0 summary bw=0 color=0 |
| 42 | ประวัติการพิมพ์ของงานขาวดำ (ใหม่สุดก่อน) | 200 | PASS | reprint,print,test,test |
| 43 | ประวัติของ order line ที่ไม่ใช่สติ๊กเกอร์ → 404 | 404 | PASS |  |
| 44 | admin ปิด flag sticker_label คืน | 201 | PASS |  |