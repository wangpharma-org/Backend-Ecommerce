# ค้นหาสินค้ารวมทุกแหล่ง (ECWC-751)

## ปัญหาเดิม

`searchProductsElastic` ค้นแบบขั้นบันได: Elasticsearch ก่อน → ถ้า ES ได้ **0** ตัว ถึงไปค้นเว็บเก่า (`search_auto.php` + `search_enter.php`) → ถ้ายังว่างค่อยค้น DB
ถ้า ES เจอบางตัว (เช่น 7 ตัว) แต่ใน DB มีสินค้าที่ตรงอีกและ ES ไม่มี (sync ไม่ทัน / index ล้ม เช่น ECWC-745 รหัสมี `/`) ลูกค้าจะไม่เห็นตัวนั้นเลย

## เปิดใช้

feature flag `search_all_sources` — migration `20261028000100-add-search-all-sources-flag` สร้างไว้เป็น **ปิด**
ปิด = พฤติกรรมเดิมทุกอย่าง · เปิด/ปิดผ่าน `POST /api/ecom/feature-flag/update-flag { flag: "search_all_sources", status: true }`

## endpoint ที่ได้ผล (เมื่อ flag เปิด)

| endpoint | ใช้ที่ไหน | เปลี่ยนอะไร |
|---|---|---|
| `POST /api/ecom/search-products` | ช่องค้นหา Navbar (dropdown) + หน้าผลค้นหา | ค้นทุกแหล่งพร้อมกันแล้วรวมเป็นหน้าเดียว |
| `POST /api/ecom/category-products` | หน้าหมวดหมู่ที่มีคำค้น | รหัสที่ ES + เว็บเก่าเจอ (ES สูงสุด 500) ถูก `OR pro_code IN (...)` เข้า LIKE เดิม — หมวด/ตัวกรอง/sort/แบ่งหน้ายังทำใน SQL (หมวด 8 แลกแต้มไม่เปลี่ยน) |
| `GET /api/ecom/product-search-autocomplete` | client อื่น (เว็บไม่ได้ใช้) | เดิมเว็บเก่าอย่างเดียว ไม่กรอง → รวมทุกแหล่ง ผ่านตัวกรองเดียวกัน สูงสุด 20 รายการ |

คำค้นว่าง (หรือค้นด้วย `creditor_codes` อย่างเดียว) ใช้ทางเดิมเสมอ

## ลำดับและการแบ่งหน้า (`search-products`)

ลำดับเสมือนของผลทั้งหมด = **pinned** + **ผล ES ตามคะแนน** + **rest**

- **pinned** — รหัส/บาร์โค้ด 1–3 ตรงคำค้นเป๊ะ แต่ ES ไม่มี (สูงสุด 5) ขึ้นก่อนเพื่อให้สแกนบาร์โค้ดเจอทันที
- **rest** — ตัวที่เว็บเก่า/DB เจอแต่ ES ไม่เจอ: เว็บเก่าก่อน (ลำดับความเกี่ยวข้องของเว็บเก่า) แล้ว DB (เรียงชื่อ, LIKE 15 คอลัมน์ สูงสุด 200)
- ไม่ซ้ำ: ตัวที่แหล่งอื่นเจอจะถูกถาม ES อีกครั้ง (`terms pro_code` + query เดียวกัน) ว่า ES นับไว้แล้วหรือยัง — ถ้านับแล้วจะอยู่ในช่วงผล ES เท่านั้น ไม่โผล่ซ้ำที่ท้าย
- `totalCount` = pinned + ES total + rest (หักตัวที่ถูกกรองตอนโหลดรายละเอียดเหมือนเดิม)
- ES ถูกดึงช่วง `[offset-5, offset+limit)` เพื่อรองรับ pinned 0–5 ตัว — logic อยู่ใน [src/products/search-merge.util.ts](../src/products/search-merge.util.ts) (unit test ครบ)

## ตัวกรอง

ผลจากเว็บเก่าไม่เคยผ่านตัวกรองใดๆ → กรองที่ DB ด้วยชุดเดียวกับ ES/DB fallback: ราคา > 0 และไม่ใช่ 1/10000000, `invisible_id IS NULL`, `pro_hidden` (WGDD-428), สินค้า L16 เฉพาะร้าน L16, `creditor_codes`, ชื่อของฟรี/ค่าบริการ/รีเบท ฯลฯ

## ทนแหล่งล่ม

ยิง ES, เว็บเก่า 2 เส้น และ DB พร้อมกัน — แหล่งไหนล่มก็ใช้ผลจากที่เหลือ (log warn)

## Environment

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `SEARCH_LEGACY_TIMEOUT_MS` | `3000` | timeout เว็บเก่าเมื่อยิงคู่ขนาน (flag เปิด) — ทางเดิม (fallback) ยังใช้ 10000 |

## ทดสอบ

- unit: `src/products/search-merge.util.spec.ts`, `src/products/products.service.spec.ts` (describe "flag search_all_sources เปิด")
- e2e: `scripts/e2e/search-all-sources.e2e.ts` — local หาสินค้าที่ DB มีแต่ ES ไม่มีเองจาก DB + `_mget` (อ่านอย่างเดียว) แล้วพิสูจน์ว่าแบบเดิมหายไป/แบบใหม่เห็น
  deployed: ส่ง `MISSING_PRO_CODE` + `MISSING_NAME_KEYWORD` เอง
