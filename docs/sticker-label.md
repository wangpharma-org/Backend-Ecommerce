# สติ๊กเกอร์ฉลากยา แบบพิมพ์หัวร้าน (ECWC-697)

สินค้าสั่งทำที่ลูกค้ากำหนดหัวฉลากเอง แต่ละแถวในตะกร้า/ออเดอร์มีรูปแบบของตัวเอง แล้ว admin พิมพ์ตามคิว
โค้ดอยู่ที่ [src/sticker-label/](../src/sticker-label/)

## กติกาหลัก

- **print mode เลือกรหัสสินค้า** (backend เลือกเอง ไม่เชื่อ client): `bw` → `95030411-05`, `color` → `95030411-07`
- สินค้า 2 รหัสนี้ต้องสร้างใน **ERP** แล้ว sync เข้ามา (ระบบนี้ไม่ seed สินค้าเอง) หน่วยแนะนำ `ดวง` (ratio 1) / `ม500ดวง` (ratio 500) ราคา `pro_price*` เป็นราคาต่อดวง
- ขนาดบรรจุ `packSize`: `1` = 1 แผ่น = 10 ดวง · `50` = 50 แผ่น = 500 ดวง → backend แปลงเป็นหน่วยที่ใหญ่สุดที่หารลงตัว
- รูปแบบ `custom_options`: `shopName` (บังคับ, ≤ 40), `address` (≤ 55), `line3` (≤ 40), `lang` (`th|en|zh|ru|ar|my`), `printMode`, `color` (hex `#RRGGBB` เฉพาะ `color`; `bw` เก็บ `null`), `packSize`
- key ของแถวในตะกร้า = `pro_code + unit + sha1(custom_options)` → รูปแบบเดียวกันรวมจำนวน รูปแบบต่างกันแยกแถว
- ตอนสั่งซื้อ `shopping_order.custom_options` = snapshot + `sheets` / `dots`
- สถานะพิมพ์และจำนวนครั้งพิมพ์นับจาก `sticker_print_log` (`print` ครั้งแรก = พิมพ์แล้ว, `reprint`/`test` ไม่เปลี่ยนสถานะ, จำนวนครั้งไม่นับ `test`)

## Feature flag / Env

| ชื่อ | ค่า | หมายเหตุ |
|------|-----|---------|
| flag `sticker_label` | ปิด (migration) | ปิดอยู่ = API ฝั่งลูกค้าตอบ 403 · admin queue ใช้ได้เสมอ |
| `STICKER_LABEL_ENABLED_LANGS` | `th` (ค่าเริ่มต้น) | ภาษาที่เปิดขาย คั่นด้วย `,` — เปิดภาษาอื่นหลังคำแปลผ่าน ECWC-705 |
| `STICKER_PRINTERS` | `[]` | JSON `[{"id":"bw-1","name":"เครื่องขาวดำ 1","color":false}]` — `color:false` พิมพ์งานสีไม่ได้ |

## Endpoints (prefix `/api/ecom`, ต้องมี JWT)

ลูกค้า (ต้องเปิด flag)

| Method | Path | Body / หมายเหตุ |
|--------|------|-----------------|
| GET | `/sticker-label/config` | ตัวเลือกทั้งหมด + ราคาต่อแพ็คตาม price option ของร้าน |
| GET | `/sticker-label/last-options` | `{ custom_options }` รูปแบบล่าสุดที่ร้านเคยสั่ง หรือ `null` |
| POST | `/sticker-label/cart` | `{ custom_options, packs, clientVersion? }` หยิบใส่ตะกร้า |
| POST | `/sticker-label/cart/update` | `{ spc_id, packs, clientVersion? }` ตั้งจำนวนแพ็คของแถวเดียว (`packs: 0` = ลบแถว) |

`POST /product-add-cart` ด้วยรหัส -05/-07 จะได้ 400 — ต้องผ่าน endpoint ด้านบนเท่านั้น
ตะกร้า (`GET /product-cart/:mem_code`) แต่ละแถวใน `shopping_cart[]` มี `custom_options` และ `sticker_quantity: { packs, sheets, dots }`

Admin (`permission = true`)

| Method | Path | Body / หมายเหตุ |
|--------|------|-----------------|
| GET | `/admin/sticker-label/printers` | รายการเครื่องพิมพ์จาก env |
| GET | `/admin/sticker-label/queue?status=pending\|printed\|all&page=&limit=` | รายการงาน + `summary` (รอพิมพ์ แยก bw/color เป็นแผ่น) |
| POST | `/admin/sticker-label/print` | `{ order_line_ids: number[], print_type: 'print'\|'reprint'\|'test', printer }` — `printed_by`/`printed_at` มาจาก token/เวลา server |
| GET | `/admin/sticker-label/lines/:spo_id/logs` | snapshot + ประวัติการพิมพ์ (ใหม่สุดก่อน) |
| POST | `/admin/sticker-label/print/pdf` | body เดียวกับ `/print` → **PDF + บันทึก log ในครั้งเดียว** (สร้าง PDF ไม่สำเร็จ = ไม่มี log) · header `X-Print-Log-Ids`, `X-Print-Pages` · สูงสุด 1000 หน้าต่อครั้ง |
| GET | `/admin/sticker-label/lines/:spo_id/preview.pdf` | ตัวอย่าง 1 หน้า ไม่บันทึก log |

หน้า admin ควรพิมพ์ผ่าน `/print/pdf` เสมอ (`/print` ใช้กรณีพิมพ์จากระบบอื่นแล้วแค่ลงประวัติ)

## PDF (ECWC-704)

- กระดาษ A4 · 1 หน้า = 1 แผ่น = 10 ดวง (2 คอลัมน์ × 5 แถว) · **ดวง 80 × 50 มม.** เว้นระยะระหว่างดวง 3 มม. และอยู่กลางหน้า (ขอบซ้าย/ขวา 23.5 มม. บน/ล่าง 17.5 มม.)
- ระยะห่างระหว่างดวงตั้งต้น 3 มม. ปรับได้ด้วย env `STICKER_PDF_GAP_MM="แนวนอน,แนวตั้ง"` (ค่าเดียว = ทั้งสองแนว, แนวตั้งสูงสุด 11.75 มม.)
- ปรับเทียบตำแหน่งกับเครื่องพิมพ์ได้ด้วย env `STICKER_PDF_OFFSET_MM="x,y"` (มม., ค่าบวก = ขวา/ลง)
- จำนวนหน้า: `print`/`reprint` = จำนวนแผ่นใน snapshot · `test` = 1 หน้า
- ขาวดำบังคับสีดำ · สีใช้ hex ที่ลูกค้าเลือก · อาหรับ `dir="rtl"` · บรรทัดหัวฉลากที่ยาวเกินย่อฟอนต์เฉพาะบรรทัด (ไม่ต่ำกว่า 7px)
- ฟอนต์: Sarabun ฝังในโค้ด ([src/sticker-label/fonts/](../src/sticker-label/fonts/), OFL) · ภาษาอื่นโหลด Noto จาก Google Fonts เฉพาะภาษาที่ใช้ ถ้าโหลดไม่ได้ใช้ `fonts-noto-core`/`fonts-noto-cjk` ใน Docker image
- render ด้วย Chrome ผ่าน puppeteer (`PUPPETEER_EXECUTABLE_PATH` ใน Dockerfile, หรือ `CHROME_EXECUTABLE_PATH`) · บล็อก request ภายนอกทั้งหมดยกเว้น Google Fonts · ข้อความลูกค้า escape ก่อนใส่ HTML
- ฟอร์มและคำแปลตาม design canvas "แก้ไขชื่อฉลากยา" (PrintSheet) — คำแปลต้องผ่าน ECWC-705 ก่อนเปิดภาษานั้น

## ยังไม่รวมในรอบนี้

- ราคาจริงของ -05/-07 (ตั้งใน ERP)

## E2E

`scripts/e2e/sticker-label.e2e.ts` — ดูเงื่อนไขก่อนรันที่หัวไฟล์
