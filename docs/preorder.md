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

### การเพิ่ม/ลดจำนวนหลังจอง (ล็อต + นโยบายต่อรอบ)

รายการจอง 1 แถวมี "ล็อต" (`preorder_item_lots`) อย่างน้อย 1 ล็อต = จำนวน + เวลาที่ก้อนนั้นเข้าคิว ผลรวม qty ทุกล็อต = `amount` เสมอ
คิวและการจัดสรรแบบ fifo ไล่ตามล็อต (ไม่ใช่ตามรายการ) ลูกค้าเห็นว่าแต่ละส่วนอยู่ลำดับไหน

| การกระทำ | ผล |
|---|---|
| ลดจำนวน | ตัดจากล็อตหลังสุดก่อน ส่วนที่จองก่อนคงคิวเดิมเสมอ |
| เพิ่มจำนวน + `increase_policy = keep` | รวมเข้าล็อตแรก ได้คิวเดิมทั้งหมด (ค่าเริ่มต้น) |
| เพิ่มจำนวน + `split` | ส่วนที่เพิ่มเป็นล็อตใหม่ ณ เวลาที่เพิ่ม ส่วนเดิมคงคิวเดิม |
| เพิ่มจำนวน + `reset` | ทั้งรายการรวมเป็นล็อตเดียว ณ เวลาที่เพิ่ม (`ordered_at` ของรายการเปลี่ยน) |
| `increase_grace_hours = N` | ภายใน N ชม. หลังจองครั้งแรก การเพิ่มถือเป็น keep ไม่ว่านโยบายจะเป็นอะไร (null = ไม่มีช่วงผ่อนผัน) |
| เจ้าหน้าที่แก้จำนวนให้ | ใช้ keep เสมอ |
| ยกเลิกแล้วจองใหม่ | ล้างล็อตเก่า ล็อตใหม่ ณ เวลาที่จองใหม่ (ท้ายคิว) |

ตรรกะอยู่ใน `src/preorder/preorder.lots.ts` (pure function มี unit test) การจัดสรร: fifo ไล่ล็อต, prorata แบ่งต่อรายการแล้วเติมล็อตแรกก่อน ผลต่อล็อตเก็บที่ `preorder_item_lots.allocated_qty`

## ตาราง

`preorder_campaigns` → `preorder_products` (สินค้าในรอบ) → `preorder_items` (รายการจองของร้าน) → `preorder_item_logs`
migration: `src/migrations/1788998400000-CreatePreorderTables.ts` (สร้าง feature flag `preorder` เป็นปิดไว้ด้วย), `1789003600000-AddPreorderLotsAndIncreasePolicy.ts` (ล็อต + นโยบายเพิ่มจำนวน backfill 1 ล็อตต่อรายการเดิม) และ `1789007200000-PreorderBlueprintExtras.ts` (reason/new_price/price_effective_date, min_per_member, pack_multiple, price_tiers, closing_reminded_at, cart_pushed_at, log action to_cart/staff_book)

ฟิลด์ต่อสินค้าในรอบ (`preorder_products`) ที่เพิ่มตาม Blueprint + มติประชุม 9 ก.ย. 69:

| ฟิลด์ | ความหมาย |
|---|---|
| `reason` | `restock` = สินค้ากำลังจะเข้า (ขาดสต็อก) · `price_increase` = สินค้าจะมีการปรับราคา (ขาดสต็อกและกำลังขึ้นราคา ลูกค้าจองได้ราคาเดิม) หน้าลูกค้าแยกเป็น 2 แท็บตาม reason |
| `new_price`, `price_effective_date` | ราคาใหม่และวันมีผล (บังคับกรอกเมื่อ reason = price_increase) |
| `min_per_member`, `pack_multiple` | ขั้นต่ำต่อร้าน / ต้องจองเป็นทวีคูณของหีบห่อ (server ปฏิเสธ 400) `min ≤ limit` เสมอ |
| `price_tiers` | ราคาขั้นบันไดตามยอดรวมทั้งรอบ `[{min_total_qty, price}]` → ลูกค้าเห็น `tier_price` (ขั้นที่ถึงแล้ว) และ `next_tier` (ขั้นถัดไป เหลืออีกเท่าไร) ใบสรุปสั่งซื้อใช้ราคานี้ |
| `preorder_items.cart_pushed_at` | ส่งจำนวนที่จัดสรรเข้าตะกร้าร้านแล้วเมื่อ (กันส่งซ้ำ) |

สถานะรอบ: `draft → open → closed → allocating → fulfilled` และ `cancelled` ได้จากทุกสถานะที่ยังไม่จบ
สถานะรายการ: `reserved → locked → allocated → fulfilled` และ `cancelled`

## Endpoints (prefix `/api/ecom`, ต้องมี JWT)

ลูกค้า (ต้องเปิด feature flag `preorder`)

| method | path | หน้าที่ |
|---|---|---|
| GET | `/preorder/campaigns` | รอบที่เปิดอยู่ + สินค้า + ราคาตามระดับ + รายการของฉัน + ลำดับคิว |
| PUT | `/preorder/campaigns/:campaignId/products/:proCode` | ตั้งจำนวนจอง body `{ amount, accept_terms? }` |
| DELETE | `/preorder/items/:id` | ยกเลิกเอง (เฉพาะรอบ `allow_cancel`) |
| POST | `/preorder/items/:id/to-cart` | นำจำนวนที่ได้รับจัดสรรเข้าตะกร้าของตัวเอง (ผ่าน `ShoppingCartService.addProductCart` ไม่เขียน shopping_head ตรง) ครั้งเดียวต่อรายการ |
| GET | `/preorder/my` | ประวัติทุกรอบ พร้อมสถานะ ลำดับคิว ETA ของเข้าแล้วหรือยัง |

admin (`req.user.permission === true`)

| method | path | หน้าที่ |
|---|---|---|
| GET/POST | `/admin/preorder/campaigns` | รายการ / สร้างรอบ |
| GET/PATCH | `/admin/preorder/campaigns/:id` | รายละเอียดรอบพร้อมยอดต่อสินค้า / แก้ |
| PATCH | `/admin/preorder/campaigns/:id/status` | เปลี่ยนสถานะ (ตรวจ transition) |
| POST | `/admin/preorder/campaigns/:id/products` | เพิ่มสินค้าเข้ารอบ |
| PATCH/DELETE | `/admin/preorder/products/:id` | แก้ limit/supply/moq/eta/note / ถอดออก (มีคนจองแล้วจะซ่อนแทนลบ) |
| GET | `/admin/preorder/products/:id/queue` | คิวแถวละ 1 ล็อต เรียงเวลาเข้าคิว พร้อมข้อมูลร้าน เซลล์ ยอดสะสม (`lot_no/lots_count`, `amount` = ล็อต, `item_amount` = ทั้งรายการ) |
| GET | `/admin/preorder/products/:id/queue.csv` | export CSV |
| POST | `/admin/preorder/products/:id/allocate` | จัดสรร `{ strategy: fifo/prorata/equal, supply_qty?, apply }` apply=false คือ preview (`equal` = วนแจกทีละ 1 ตามคิว fair share) |
| GET | `/admin/preorder/campaigns/:id/purchase-summary` (+ `.csv`) | ใบสรุปยอดสั่งซื้อของรอบ จัดกลุ่มตาม supplier (creditor_name ?? pro_supplier) ราคาขาย (tier/ประมาณ/ปกติ) ต้นทุน มูลค่า MOQ ขาดเท่าไร |
| PUT | `/admin/preorder/campaigns/:id/products/:proCode/members/:memCode` | เจ้าหน้าที่/เซลล์ (`permission` หรือ `role=Sales`) จองแทนร้าน `{ amount, note? }` ข้ามการยอมรับเงื่อนไข log `staff_book` และแจ้งร้าน |
| POST | `/admin/preorder/items/:id/to-cart` · `/admin/preorder/products/:id/to-cart` | ส่งจำนวนที่จัดสรรเข้าตะกร้าร้าน รายแถว / ทุกร้านของสินค้า (ข้ามที่ส่งแล้ว/ไม่ได้รับจัดสรร) |
| POST | `/admin/preorder/reminders/run` | รัน cron เตือนก่อนปิดรอบด้วยมือ (ปกติ 09:00 ทุกวัน: รอบ open ที่ `ends_at` ภายใน 24 ชม. และยังไม่เคยเตือน) |
| PATCH/DELETE | `/admin/preorder/items/:id` | ล็อค/ปลดล็อค/แก้จำนวน/ชำระแล้ว/allocated_qty / ยกเลิก |
| GET | `/admin/preorder/items/:id/logs` | ประวัติแถว |
| POST | `/admin/preorder/arrivals` | ยิงมือว่าสินค้าเข้าแล้ว `{ pro_codes: [] }` |

## ของเข้าแล้ว → แจ้งร้านที่จอง

`NewArrivalsService.addNewArrival` (POST `/ecom/new-arrivals` จากระบบรับของ) เรียก `PreorderService.handleArrivals(pro_codes)` หลัง commit
ระบบจะตั้ง `arrived_at` บนสินค้าในรอบที่ยังไม่จบ แล้วส่งแจ้งเตือนผ่าน notification-service (`POST /api/notifications/dispatch`, channels FCM+LINE)
ให้ทุกร้านที่ยังจองอยู่ ครั้งเดียวต่อสินค้าต่อรอบ การแจ้งล้มเหลวจะ log อย่างเดียว ไม่ทำให้การรับของล้ม

แจ้งเตือนอื่น: ผลจัดสรร (หลัง allocate apply), ยกเลิกรอบ, ETA เลื่อน (เมื่อ admin แก้ `eta_date` ของสินค้าที่มีคนจอง), เตือนก่อนปิดรอบ (cron 09:00), เจ้าหน้าที่จองแทนให้

## ทดสอบ

- unit: `npx jest src/preorder`
- e2e ยิง API จริง: `BASE_URL=... E2E_ENV=dev|prod ADMIN_TOKEN=... USER_TOKEN=... PRO_CODE=... MEM2=<ร้านที่สอง> npx ts-node scripts/e2e/preorder.e2e.ts`
  (`MEM2` = รหัสร้านที่มีใน `users` และไม่ใช่ร้านของ USER_TOKEN ใช้ทดสอบจองแทนร้าน · access token อายุ 15 นาที ต่ออายุด้วย `POST /ecom/refresh_token {token: refresh_token}`)
  รายงานติดป้าย environment เสมอ (`local` อัตโนมัติเมื่อ BASE_URL เป็น localhost, อื่นๆ ต้องระบุ E2E_ENV) เขียนลง `docs/e2e/preorder-<env>-<timestamp>.md`
  ผล `local` = ผ่านก่อน merge เท่านั้น ต้องรันซ้ำกับ deployed code หลัง deploy แล้วบันทึกใน Confluence: [E2E Testing Playbook — Backend-Ecommerce](https://nitipongjin-13063.atlassian.net/wiki/spaces/R/pages/202407939) → [Test Report — Pre-order](https://nitipongjin-13063.atlassian.net/wiki/spaces/R/pages/202440705) + [ทะเบียน E2E Suites](https://nitipongjin-13063.atlassian.net/wiki/spaces/R/pages/202473473)
- สคริปต์มี 3 รอบทดสอบ: A = allocation (limit/supply/ล็อค/จัดสรร/ของเข้า, split) 23 ขั้น · B = aggregation (MOQ/ETA/ราคาโดยประมาณ, allow_cancel, keep → split ในช่วงผ่อนผัน → split → reset, ยกเลิกแล้วจองใหม่, ปิดรอบล็อคอัตโนมัติ) 20 ขั้น · C = กลุ่ม 3 + มติ 9 ก.ย. (reason=price_increase, min/pack, ราคาขั้นบันได, จองแทนร้าน + log, ใบสรุปสั่งซื้อ + CSV, เตือนก่อนปิดรอบ + กันเตือนซ้ำ, จัดสรร equal, ส่งเข้าตะกร้าลูกค้า/เจ้าหน้าที่ + กันส่งซ้ำ + ตรวจตะกร้าจริง) 28 ขั้น
- ผลล่าสุด: local **43/43** (9 ก.ย. 2569 รอบ 3 บน DB dump ล่าสุด) `docs/e2e/preorder-local-1788937151417.md` · รอบ 2 23/23 · รอบ 1 22/22 · deployed: ยังไม่ได้รัน

## งานค้าง (backlog) — อัปเดต 9 ก.ย. 2569

### 1. ปิดงานให้ขึ้น production (ทำเมื่อ review)
- [ ] push frontend + เปิด PR Ecommerce-Frontend (worktree `Ecommerce-Frontend-preorder` branch `feat/preorder`) ประสานลำดับ merge กับ `feature/ECWC-542-rewards`
- [ ] review/merge PR #261 → deploy dev/prod → `migration:run` (2 ตัว) → เปิด flag `preorder`
- [ ] รัน e2e กับ deployed (`E2E_ENV=dev|prod`) แล้วเติมช่อง deployed ใน Confluence (Test Report 202440705, ทะเบียน 202473473, Playbook 202407939)
- [ ] หาคนยิง POST `/ecom/new-arrivals` (ระบบรับของ) และใส่ guard ให้ endpoint นี้

### 2. ต้องพิสูจน์บนของจริง (task ทีม)
- [ ] แจ้งเตือนจริงผ่าน notification-service → FCM/LINE (`type: 'preorder'`) รวม template ฝั่ง notification-service
- [ ] จัดสรร prorata กับหลายร้าน และเส้นทาง Kafka `newArrival_insert`

### 3. ฟีเจอร์จาก Blueprint (ทำแล้ว 9 ก.ย. — backend commit fc02189+, frontend 459f865)
- [x] แจ้งเตือนเมื่อ ETA เลื่อน และเตือนก่อนรอบปิด (cron 09:00 + `/admin/preorder/reminders/run`)
- [x] ขั้นต่ำต่อร้าน / ทวีคูณหีบห่อ / ราคาขั้นบันไดตามยอดรวม
- [x] จัดสรรแบบแบ่งเท่ากัน (`equal`) เพิ่มจาก fifo/prorata
- [x] สรุปยอดปิดรอบเป็นใบสั่งซื้อ (purchase-summary + CSV)
- [x] เซลล์/เจ้าหน้าที่จองแทนร้าน
- [x] แปลงรายการที่จัดสรรแล้วเป็นออเดอร์: ส่งเข้าตะกร้าให้ร้านเช็คเอาต์เอง (ไม่สร้าง shopping_head ตรง เพื่อไม่ข้ามโปรโมชั่น/coin/ERP)
- [x] มติประชุม 9 ก.ย. 69: `reason` ต่อสินค้า + ราคาใหม่/วันมีผล, หน้าลูกค้า 2 แท็บ "สินค้ากำลังจะเข้า" / "สินค้าจะมีการปรับราคา"
- [ ] แอปลูกค้า (Flutter) ตามมติประชุม ยังไม่แตะ
- [ ] สคริปต์ย้ายข้อมูลจาก `pre_order` เดิม + กำหนดวันปิดหน้า fmcg.php
- [ ] backorder จากออเดอร์ปกติ → pre-order (รอ branch ตะกร้า merge ก่อน เลี่ยง conflict)

### 4. เก็บงาน
- [ ] ปิด backend 3021 / vite 5173 / container เมื่อเลิกใช้ ลบ token file ชั่วคราว
- [ ] ลบ config `ecommerce-frontend-preorder` ใน rag/.claude/launch.json และลบ worktree ทั้งสองหลัง merge
- [ ] lint error `any` ใน SiteConfigManage.tsx (มีอยู่ก่อนบน main)

## ยังไม่ทำในรอบนี้

- สร้างออเดอร์อัตโนมัติจาก allocated_qty (ตอนนี้ส่งเข้าตะกร้าแล้วให้ร้านยืนยันเอง สถานะ `fulfilled` ยังตั้งมือ)
- ย้ายข้อมูลจากตาราง `pre_order` เดิม / ปิดหน้า fmcg.php
- backorder จากออเดอร์ปกติ (รอ branch ตะกร้า)
- หน้า frontend (Ecommerce-Frontend)
