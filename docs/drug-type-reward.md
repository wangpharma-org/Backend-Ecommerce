# WGDD-427 สินค้าแถม/ขายพ่วงตามประเภทยา

ProductService เป็นต้นทางของ "ประเภทยา" (ชุดใหม่ แยกจาก category) แต่ละประเภทมีสินค้าแถม (`FREE`) และขายพ่วง (`BUNDLE`) ได้หลายรายการ แต่ละรายการระบุว่าซื้อสินค้าในประเภทครบ `buy_qty buy_unit` แล้วจะได้หรือพ่วง `reward_qty reward_unit` เงื่อนไขนับแยกต่อสินค้า ขายพ่วงมี `bundle_price` ได้ ถ้าเป็น null หมายถึงราคาปกติ ไม่มีวันเริ่ม/หมดอายุ และไม่ผูกเจ้าหนี้

Ecommerce เก็บสำเนาไว้ **เพื่อแสดงอย่างเดียว** ในหน้าสินค้าและตะกร้า ยังไม่คิดของแถมหรือราคาพ่วงในตะกร้าหรือ order และไม่ได้แปลงเป็น promotion

## ข้อมูลไหลเข้า

```
ProductService (drug_types / drug_type_rewards / products.drug_type_id)
  └─ product_kafka_outbox ─ POST /api/kafka/ecom-drug-type-upsert      → topic drug_type_upsert_ecom  → DrugTypeListener
                          └ POST /api/kafka/product-update-from-easyacc → topic product_update_from_easyacc
                              { product_code, drug_type_code }          → ProductsService.updateProductFromEasyAcc
```

- **`drug_type_upsert_ecom`**: payload คือ `{ code, previous_code, name, description, is_active, deleted, rewards[] }` อ้างอิงด้วย `code` เพราะ Ecommerce ไม่รู้ uuid ของต้นทาง
  - upsert ประเภท แล้วแทนที่ `drug_type_reward` ทั้งชุด ข้อความซ้ำได้ผลเดิม
  - มี `previous_code`: เปลี่ยนรหัสประเภท (reward ย้ายตามด้วย `ON UPDATE CASCADE`) และย้าย `product.drug_type_code` ตาม
  - `deleted = true`: ลบประเภท (reward ลบตาม cascade) และล้าง `product.drug_type_code`
- **`product_update_from_easyacc`**: ตั้ง `product.drug_type_code` ส่ง `null` เพื่อเอาสินค้าออกจากประเภท ไม่เช็คว่าประเภทมีอยู่แล้ว เพราะข้อความประเภทอาจตามมาทีหลัง
- **ซ่อมข้อมูลหรือ sync ครั้งแรก:** เรียก `POST /api/products/drug-types/sync-ecommerce` ที่ ProductService (สิทธิ์ `PRODUCT:WRITE`) ระบบจะส่งทุกประเภทและการผูกสินค้าทั้งหมดใหม่

## ตาราง (migration `20261021000100-create-drug-type`)

| ตาราง / คอลัมน์ | หมายเหตุ |
|---|---|
| `drug_type` | PK `code`, `name`, `description`, `is_active` |
| `drug_type_reward` | `drug_type_code` (FK → `drug_type.code`, cascade), `reward_type`, `product_code` (ไม่ทำ FK), `buy_qty`, `buy_unit`, `reward_qty`, `reward_unit`, `bundle_price`, `sort_order`, `note` |
| `product.drug_type_code` | varchar(50) null + `IDX_product_drug_type_code` |
| `feature_flag` `drug_type_reward` | seed เป็นปิด และอยู่ใน `DEFAULT_DISABLED_FLAGS` ด้วย |

หน่วยของแถมเป็นหน่วยของสินค้าแถมเอง ห้ามแปลงด้วย ratio ของสินค้าหลัก (G-001)

## API หน้าร้าน (JwtAuthGuard, flag ปิด → 403)

| Method และ path | Body | คำตอบ |
|---|---|---|
| `GET /api/ecom/drug-type/product/:proCode` | — | `{ "drug_type": { code, name, rewards[] } \| null }` |
| `POST /api/ecom/drug-type/products` | `{ "pro_codes": ["P1", "P2"] }` (สูงสุด 200) | `{ "P1": { code, name, rewards[] } }` มีเฉพาะสินค้าที่มีแถม/พ่วง |

แต่ละ `rewards[]` คือ `{ reward_type, product_code, product_name, product_image, buy_qty, buy_unit, reward_qty, reward_unit, bundle_price, note }` โดย `product_name` ใช้ `pro_nameTH` ก่อน ถ้าไม่มีจึงใช้ `pro_name` ประเภทที่ `is_active = 0` หรือไม่มีรายการแถม/พ่วง จะไม่อยู่ในผลลัพธ์

## e2e

```bash
BASE_URL=http://localhost:3021/api npx ts-node scripts/e2e/drug-type-reward.e2e.ts
BASE_URL=https://<api>/api E2E_ENV=prod ADMIN_TOKEN=... USER_TOKEN=... PRO_CODE=<สินค้าที่มีแถม/พ่วง> npx ts-node scripts/e2e/drug-type-reward.e2e.ts
```

- **local:** seed ประเภท `E2E-DT-<เวลา>` ลง DB ตรง (เลียนแบบผลของข้อความ Kafka) แล้วลบเมื่อจบ
- **deployed:** ไม่ seed อ่านข้อมูลจริงอย่างเดียว
- ทั้งสองแบบสลับ flag ปิด → เปิด แล้วคืนค่าเดิมเมื่อจบ
