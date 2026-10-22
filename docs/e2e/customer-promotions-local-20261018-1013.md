# E2E — GET /ecom/internal/customer-promotions (โปรที่ร้านร่วมได้ สำหรับหน้า Key ขาย)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `68d0783` · **base:** http://127.0.0.1:3032/api
- โหมด: ใส่ข้อมูลทดสอบ "E2E local …" (รหัส E2EL-) แล้วลบเมื่อจบ

## ผล 16/16

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | ไม่มี token / token ผิด → 403 | 403 / 403 |
| PASS | ไม่ส่ง mem_code / mem_code ผิดรูป / pro_codes เกิน 200 → 400 · ร้านที่ไม่มี → 404 | 400 / 400 / 400 / 404 |
| PASS | ร้านทดสอบ → 200 และมีทุกส่วนตามสัญญา | HTTP 200 · route L03 |
| PASS | Company Day: type=company มีบริษัท · ขั้นนับยอด P1 เท่านั้น · conditionCount=1 · ของแถมพร้อมชื่อหน่วย (รวมของ L16 เพราะร้านไม่ใช่ L16) | E2E local Company Day · E2EL-CR1 · matched E2EL-P1 · rewards E2EL-G1×2กล่อง,E2EL-G16×1แผง |
| PASS | Wang Day: type=wang ไม่มีบริษัท · all_products นับทุกตัวยกเว้น P2 · conditionCount=null · isUnit | E2E local Wang Day · matched E2EL-P1,E2EL-P3 · conditionCount null |
| PASS | โปรที่ปิด (status=0) และโปรหมดอายุ ไม่ถูกส่งมา | หลุดมา 0 |
| PASS | Hot Deal ของ P1: ซื้อ 10 กล่อง แถม H2 1 แผง (หน่วยของแถมใช้หน่วยของสินค้าแถม) · kind product-pro | {"proCode":"E2EL-P1","name":"E2E local สินค้าในขั้น Company Day","buyQty":10,"buyUnit":"กล่อง","giftProCode":"E2EL-H2","giftName":"E2E local ของแถม Hot Deal","giftQty":1,"giftUnit":"แผง","title":"E2E local ซื้อ 10 แถม 1","kind":"product-pro","image":null,"giftImage":null} |
| PASS | Flash Sale วันนี้: ตัวที่เปิด live=true มี P3 จำกัด 5 · ตัวที่ปิดไม่ส่งมา | เปิด {"id":30,"name":"E2E local Flash Sale วันนี้","date":"2026-10-18","timeStart":"00:00","timeEnd":"23:59","live":true,"products":[{"proCode":"E2EL-P3","limit":5,"name":"E2E local สินค้า Flash Sale/Bundle","image":"https://www.wangpharma.com/images/e2e-local.png"}]} · ปิด ไม่มี |
| PASS | Happy Hour: เปิดอยู่ (ไม่จำกัดวัน) → ส่ง slot ที่เปิดครบ | slots 0 / ใน DB 0 |
| PASS | Special Collection: เห็นของที่เลือกร้านนี้ (พร้อมป้ายรายการ) · ไม่เห็นของร้านอื่น | ของร้านนี้ E2E local คอลเลกชันเฉพาะร้านนี้ · ของร้านอื่น ไม่มี |
| PASS | Bundle Set: ชุดที่เปิดและมี P3 ส่งมา (ราคา 990, มีของแถม) · ชุดที่ปิดไม่ส่ง | S1 990 · S2 ไม่มี |
| PASS | รูป: โปส์เตอร์โปร/ขั้น/ชุด = URL เต็มตามเดิม · รูปของแถม/สินค้า Flash Sale/ในชุด = "../images" ต่อโดเมน CDN (กติกาหน้าร้าน) · มีชื่อสินค้า | poster https://e2e.local/poster-company.png · tier https://e2e.local/tier-1.png · gift https://www.wangpharma.com/images/e2e-local.png · flash https://www.wangpharma.com/images/e2e-local.png · bundle https://e2e.local/bundle.png |
| PASS | Wang Rebate: เป้า/ยอดปีก่อน/rebate ตรง · ยอด เม.ย. 14,000 ต.ค. 9,000 รวม 23,000 · 9 เดือน | 2026-04-01–2026-12-31 · รวม 23000 · เป้า 135000 |
| PASS | ร้าน L16: ไม่เห็นของแถมที่เป็น pro_l16_only (แบบเดียวกับหน้าร้าน) · ไม่มี Wang Rebate | rewards E2EL-G1 · rebate null |
| PASS | ไม่ส่ง pro_codes: ยังเห็นโปรทั้งหมด แต่ matchedProCodes ว่าง และ hotDeals ว่าง | โปร 2 · hotDeals 0 |
| PASS | ล้างข้อมูลทดสอบ | เหลือ 0 แถว |
