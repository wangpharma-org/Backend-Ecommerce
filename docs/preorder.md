# Pre-order (สั่งจองสินค้าที่ยังไม่มา)

แทนที่ระบบ `pre_order` (หน้า FMCG) และ `shopping_preorder` (ฟ้าทะลายโจร) ใน wang_shopping
สรุปที่มาและการเทียบระบบเดิมอยู่ใน Wang Pre-order Blueprint (artifact)

## แนวคิด

pre-order เกิดได้ 2 โหมด กำหนดต่อ "รอบจอง" (`preorder_campaigns.mode`)

| โหมด | สถานการณ์ | กลไกที่ใช้ |
|---|---|---|
| `allocation` | ของขาด demand > supply ไม่เปิดขายปกติ | `limit_per_member`, `supply_qty`, จัดสรร fifo/prorata, ห้ามยกเลิก |
| `aggregation` | ไม่รู้ demand supplier ไม่กล้าสต๊อก รวมยอดแล้วสั่งผู้ผลิต | `moq`, `estimated_price`, `eta_date`, ยกเลิกได้จนปิดรอบ |

กติกาที่ server บังคับทุกกรณี

- 1 แถวต่อ (สินค้าในรอบ, ร้าน) unique key กันซ้ำ, upsert ใน transaction พร้อม lock แถวสินค้า
- `ordered_at` = เวลาจองครั้งแรก ไม่ถูกแก้ตลอดอายุแถว ใช้เรียงคิว (แก้บั๊กระบบเดิมที่รีเซ็ตเวลาทุก submit)
- จำนวนต้องเป็นจำนวนเต็ม ≥ 1 กรอก 0 ไม่ใช่การยกเลิก
- แถว `locked` / `allocated` ลูกค้าแก้ไม่ได้ (เดิมกันแค่ใน HTML)
- ต้องยอมรับเงื่อนไขของรอบก่อนจองครั้งแรก ถ้ารอบมี `terms`
- ทุกการเปลี่ยนแปลงลง `preorder_item_logs` (ใคร เมื่อไหร่ จากเท่าไหร่เป็นเท่าไหร่)
- ปิดรอบ (`closed`) → ล็อคทุกแถวที่ยัง reserved อัตโนมัติ

## ตาราง

`preorder_campaigns` → `preorder_products` (สินค้าในรอบ) → `preorder_items` (รายการจองของร้าน) → `preorder_item_logs`
migration: `src/migrations/1788998400000-CreatePreorderTables.ts` (สร้าง feature flag `preorder` เป็นปิดไว้ด้วย)

สถานะรอบ: `draft → open → closed → allocating → fulfilled` และ `cancelled` ได้จากทุกสถานะที่ยังไม่จบ
สถานะรายการ: `reserved → locked → allocated → fulfilled` และ `cancelled`

## Endpoints (prefix `/api/ecom`, ต้องมี JWT)

ลูกค้า (ต้องเปิด feature flag `preorder`)

| method | path | หน้าที่ |
|---|---|---|
| GET | `/preorder/campaigns` | รอบที่เปิดอยู่ + สินค้า + ราคาตามระดับ + รายการของฉัน + ลำดับคิว |
| PUT | `/preorder/campaigns/:campaignId/products/:proCode` | ตั้งจำนวนจอง body `{ amount, accept_terms? }` |
| DELETE | `/preorder/items/:id` | ยกเลิกเอง (เฉพาะรอบ `allow_cancel`) |
| GET | `/preorder/my` | ประวัติทุกรอบ พร้อมสถานะ ลำดับคิว ETA ของเข้าแล้วหรือยัง |

admin (`req.user.permission === true`)

| method | path | หน้าที่ |
|---|---|---|
| GET/POST | `/admin/preorder/campaigns` | รายการ / สร้างรอบ |
| GET/PATCH | `/admin/preorder/campaigns/:id` | รายละเอียดรอบพร้อมยอดต่อสินค้า / แก้ |
| PATCH | `/admin/preorder/campaigns/:id/status` | เปลี่ยนสถานะ (ตรวจ transition) |
| POST | `/admin/preorder/campaigns/:id/products` | เพิ่มสินค้าเข้ารอบ |
| PATCH/DELETE | `/admin/preorder/products/:id` | แก้ limit/supply/moq/eta/note / ถอดออก (มีคนจองแล้วจะซ่อนแทนลบ) |
| GET | `/admin/preorder/products/:id/queue` | คิวเรียง ordered_at พร้อมข้อมูลร้าน เซลล์ ยอดสะสม |
| GET | `/admin/preorder/products/:id/queue.csv` | export CSV |
| POST | `/admin/preorder/products/:id/allocate` | จัดสรร `{ strategy: fifo/prorata, supply_qty?, apply }` apply=false คือ preview |
| PATCH/DELETE | `/admin/preorder/items/:id` | ล็อค/ปลดล็อค/แก้จำนวน/ชำระแล้ว/allocated_qty / ยกเลิก |
| GET | `/admin/preorder/items/:id/logs` | ประวัติแถว |
| POST | `/admin/preorder/arrivals` | ยิงมือว่าสินค้าเข้าแล้ว `{ pro_codes: [] }` |

## ของเข้าแล้ว → แจ้งร้านที่จอง

`NewArrivalsService.addNewArrival` (POST `/ecom/new-arrivals` จากระบบรับของ) เรียก `PreorderService.handleArrivals(pro_codes)` หลัง commit
ระบบจะตั้ง `arrived_at` บนสินค้าในรอบที่ยังไม่จบ แล้วส่งแจ้งเตือนผ่าน notification-service (`POST /api/notifications/dispatch`, channels FCM+LINE)
ให้ทุกร้านที่ยังจองอยู่ ครั้งเดียวต่อสินค้าต่อรอบ การแจ้งล้มเหลวจะ log อย่างเดียว ไม่ทำให้การรับของล้ม

แจ้งเตือนอื่น: ผลจัดสรร (หลัง allocate apply) และยกเลิกรอบ

## ทดสอบ

- unit: `npx jest src/preorder`
- e2e ยิง API จริง: `BASE_URL=... E2E_ENV=dev|prod ADMIN_TOKEN=... USER_TOKEN=... PRO_CODE=... npx ts-node scripts/e2e/preorder.e2e.ts`
  รายงานติดป้าย environment เสมอ (`local` อัตโนมัติเมื่อ BASE_URL เป็น localhost, อื่นๆ ต้องระบุ E2E_ENV) เขียนลง `docs/e2e/preorder-<env>-<timestamp>.md`
  ผล `local` = ผ่านก่อน merge เท่านั้น ต้องรันซ้ำกับ deployed code หลัง deploy แล้วบันทึกใน Confluence: [E2E Testing Playbook — Backend-Ecommerce](https://nitipongjin-13063.atlassian.net/wiki/spaces/R/pages/202407939) → [Test Report — Pre-order](https://nitipongjin-13063.atlassian.net/wiki/spaces/R/pages/202440705) + [ทะเบียน E2E Suites](https://nitipongjin-13063.atlassian.net/wiki/spaces/R/pages/202473473)
- ผลล่าสุด: local 22/22 (9 ก.ย. 2569) `docs/e2e/preorder-local-1788926680462.md` · deployed: ยังไม่ได้รัน

## ยังไม่ทำในรอบนี้

- สร้างออเดอร์ใน e-commerce จาก allocated_qty อัตโนมัติ (สถานะ `fulfilled` ยังตั้งมือ)
- สรุปยอดเป็น PR/PO ส่งจัดซื้อ
- ย้ายข้อมูลจากตาราง `pre_order` เดิม
- หน้า frontend (Ecommerce-Frontend)
