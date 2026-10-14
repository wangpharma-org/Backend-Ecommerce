# Sticker label (ECWC-697) E2E report

- environment: **docker-local** (deployed code)
- BASE_URL: http://localhost:3022/api
- commit: 68cd92e
- run at: 2026-10-14T05:46:19.863Z
- ร้านทดสอบ: 00004 · admin: 0007
- ออเดอร์ทดสอบที่สร้าง: 005-101964
- ครอบคลุม: ECWC-698 ตัวเลือก/map รหัส · ECWC-699 custom_options ตะกร้า/snapshot · ECWC-702 คิวพิมพ์ + sticker_print_log · ECWC-704 PDF A4 (ดวง 80×50 มม.)
- result: **58/58 passed**

| # | step | status | ok | detail |
|---|------|--------|----|--------|
| 1 | flag ปิด → config ต้อง 403 | 403 | PASS |  |
| 2 | admin เปิด flag sticker_label | 201 | PASS |  |
| 3 | config คืน 2 mode map รหัส -05/-07 + 2 ขนาดบรรจุ + 6 ภาษา | 200 | PASS | bw/แผ่น=1.9 bw/50แผ่น=95 |
| 4 | เพิ่มสติ๊กเกอร์ผ่าน add-cart ปกติ (ไม่มีรูปแบบ) → 400 | 400 | PASS |  |
| 5 | last-options ก่อนสั่งรอบนี้ → null หรือรูปแบบเดิม | 200 | PASS | มีออเดอร์เดิม: E2E docker-local ร้านยาทดสอบ |
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
| 16 | validate: 2 ภาษาแต่ภาษาหลักไม่ใช่ไทย → 400 | 400 | PASS | ฉลาก 2 ภาษาต้องเป็นภาษาไทย + อีก 1 ภาษา |
| 17 | validate: 2 ภาษาแต่ภาษาที่ 2 เป็นไทย → 400 | 400 | PASS | ฉลาก 2 ภาษาต้องเป็นภาษาไทย + อีก 1 ภาษา |
| 18 | validate: ฟอนต์ที่ไม่รองรับ → 400 | 400 | PASS | font ต้องเป็น sarabun\|prompt\|kanit\|mitr\|trirong\|charm |
| 19 | หยิบขาวดำ ไทย 1 แผ่น × 2 (ส่ง color มาด้วยต้องถูกตัดทิ้ง) | 201 | PASS | spc_id=1322425 unit=ดวง amount=20.00 |
| 20 | หยิบรูปแบบเดิมอีก 1 → รวมเป็นแถวเดียว 3 แผ่น | 201 | PASS | rows=1 sheets=3 |
| 21 | หยิบรูปแบบต่าง (English) → แยกเป็นอีกแถวในสินค้าเดียวกัน | 201 | PASS | rows=2 |
| 22 | หยิบสี 50 แผ่น × 1 → รหัส -07 หน่วย ม500ดวง | 201 | PASS | unit=ม500ดวง sheets=50 |
| 23 | แก้จำนวนแถวไทยเป็น 5 แผ่น (แถวอื่นไม่เปลี่ยน) | 201 | PASS | th=5 en=1 |
| 24 | ตั้งแถว English = 0 → ลบเฉพาะแถวนั้น | 201 | PASS | rows=2 |
| 25 | รูปแบบเดิมแต่ฟอนต์ Kanit → แยกแถวใหม่ เก็บ font · sarabun = แถวเดิม | 201 | PASS | kanit spc=1322428 th sheets=6 |
| 26 | แก้แถวที่ไม่มี/ไม่ใช่ของร้าน → 404 | 404 | PASS |  |
| 27 | GET ตะกร้าคืน custom_options + จำนวนแผ่น | 200 | PASS | rows=2 |
| 28 | สั่งซื้อจากตะกร้า | 201 | PASS | soh_running=005-101964 |
| 29 | ตะกร้าว่างหลังสั่ง | 200 | PASS |  |
| 30 | last-options คืนรูปแบบจากออเดอร์ล่าสุด (ไม่มี sheets/dots) | 200 | PASS | printMode=color lang=ar |
| 31 | last-options?pro_code=-05 คืนรูปแบบขาวดำล่าสุด (สั่งซ้ำแบบเดิม) | 200 | PASS | printMode=bw shop=E2E docker-local ร้านยาทดสอบ |
| 32 | last-options?pro_code=ไม่ใช่สติ๊กเกอร์ → 400 | 400 | PASS |  |
| 33 | ประวัติออเดอร์: รูปแบบสติ๊กเกอร์ของออเดอร์นี้ (ECWC-701) | 200 | PASS | rows=2 ร้านอื่นเห็น=0 |
| 34 | ฉลาก 2 ภาษา ไทย+จีน → แยกแถวจากไทยล้วน เก็บ lang2 แล้วลบออก | 201 | PASS | rows=2 lang2=zh |
| 35 | ลูกค้าเรียก API admin → 403 | 403 | PASS |  |
| 36 | validate queue: status ผิด / page ผิด → 400 | 400 | PASS | status=400 page=400 |
| 37 | คิวรอพิมพ์มีทั้ง 2 งานจาก snapshot + สรุปแยกขาวดำ/สี | 200 | PASS | bw spo=1172115 color spo=1172116 summary bw=8 color=250 |
| 38 | รายการเครื่องพิมพ์จาก env | 200 | PASS | e2e-bw,e2e-color |
| 39 | พิมพ์งานสีด้วยเครื่องขาวดำ → 400 (ไม่บันทึก log) | 400 | PASS | เครื่อง E2E local ขาวดำ เป็นเครื่องขาวดำ พิมพ์งานสีไม่ได้: 1172116 |
| 40 | print_type / เครื่องพิมพ์ ไม่ถูกต้อง → 400 | 400 | PASS | 400/400/400 |
| 41 | preview PDF 1 หน้า A4 (ไม่บันทึก log) | 200 | PASS | pages=1 a4=true |
| 42 | ลูกค้าเรียก preview PDF → 403 | 403 | PASS |  |
| 43 | ส่งออก .ai งานขาวดำ → PDF CMYK ไฟล์เดียว ไม่ลงประวัติ | 201 | PASS | attachment; filename="sticker-bw-1791956743728.ai" |
| 44 | ส่งออก .jpg งานสี 1 งาน → JPEG CMYK (4 component) | 201 | PASS | components=4 |
| 45 | ส่งออก .psd → ไฟล์ Photoshop CMYK | 201 | PASS | bytes=34972916 |
| 46 | ส่งออกขาวดำ + สีปนกัน → 400 | 400 | PASS |  |
| 47 | ส่งออก format ไม่รองรับ / psd เกิน 10 งาน → 400 | 400 | PASS | pdf=400 psd11=400 |
| 48 | ลูกค้าเรียกส่งออก → 403 | 403 | PASS |  |
| 49 | PDF งานสีกับเครื่องขาวดำ → 400 ไม่มี log | 400 | PASS |  |
| 50 | PDF พิมพ์ทดสอบ → 1 หน้า + id ของ log ใน header | 201 | PASS | pages=1 log=150 |
| 51 | พิมพ์ทดสอบ (test) → 1 แผ่น สถานะยังรอพิมพ์ | 201 | PASS | status=pending count=0 |
| 52 | พิมพ์จริง (print) → พิมพ์แล้ว, printed_by จาก token ไม่ใช่ body | 201 | PASS | printed_by=0007 sheets=5 |
| 53 | print ซ้ำงานที่พิมพ์แล้ว → 400 ให้ใช้ reprint | 400 | PASS | งานนี้พิมพ์แล้ว ให้ใช้พิมพ์ซ้ำ (reprint): 1172115 |
| 54 | reprint → จำนวนครั้ง 2 สถานะยังพิมพ์แล้ว | 201 | PASS | count=2 last=0007 |
| 55 | PDF งานสี 50 แผ่นด้วยเครื่องสี → 50 หน้า, คิวรอพิมพ์ไม่มีงานของออเดอร์นี้ | 201 | PASS | pdf pages=50 pending left=0 summary bw=3 color=200 |
| 56 | ประวัติการพิมพ์ของงานขาวดำ (ใหม่สุดก่อน) | 200 | PASS | reprint,print,test,test |
| 57 | ประวัติของ order line ที่ไม่ใช่สติ๊กเกอร์ → 404 | 404 | PASS |  |
| 58 | admin ปิด flag sticker_label คืน | 201 | PASS |  |