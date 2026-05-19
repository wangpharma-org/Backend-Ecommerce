# Backend Ecommerce — Project Guide for Claude

## Stack

- **Framework**: NestJS + TypeScript
- **ORM**: TypeORM
- **Database**: MySQL (utf8mb4_unicode_ci)
- **Message Broker**: Kafka (product sync from EasyAcc)
- **Storage**: DigitalOcean Spaces (S3-compatible)
- **Search**: Elasticsearch

---

## Critical Setup — ต้องทำก่อน run project

### ตรวจสอบ `product_unit` table

หลัง migration `1777869005107-unit` ระบบย้ายข้อมูลหน่วยสินค้าจาก columns
`pro_unit1/2/3` + `pro_ratio1/2/3` ใน `product` table ไปยัง `product_unit` table แยก

**ถ้า `product_unit` ว่างเปล่า ระบบจะแสดงหน่วยสินค้าผิดทั้งหมด** (cart, promotion reward,
hotdeal freebie จะใช้ ratio = 1 เสมอ ทำให้คำนวณราคาและของแถมผิด)

#### วิธีตรวจสอบ

```sql
SELECT COUNT(*) FROM product_unit;
```

ถ้าผลเป็น 0 ให้รัน migration:

```bash
npm run migration:run
```

#### ตรวจสอบหลัง migration

```sql
-- ควรมีข้อมูลตรงกับจำนวน product ที่มีหน่วย
SELECT COUNT(*) FROM product_unit;

-- ตรวจสอบว่า shopping_cart ไม่มี spc_unit_enum เป็น NULL เกินปกติ
SELECT COUNT(*) FROM shopping_cart WHERE spc_unit_enum IS NULL;
```

ถ้ามี `spc_unit_enum = NULL` จำนวนมาก แสดงว่าข้อมูล `spc_unit` เดิมไม่ตรงกับ
`product_unit.unit_name` (เช่น มี whitespace, typo) — ดู log ใน migration output

---

## Unit System Architecture

### ก่อน migration (เก่า)
```
product.pro_unit1 / pro_unit2 / pro_unit3  → string ชื่อหน่วย ("ชิ้น", "กล่อง")
product.pro_ratio1 / pro_ratio2 / pro_ratio3 → int อัตราส่วน
shopping_cart.spc_unit → string ชื่อหน่วย
```

### หลัง migration (ใหม่)
```
product_unit table:
  - pro_code  → FK → product.pro_code
  - unit_name → string ชื่อหน่วย ("ชิ้น", "กล่อง", "ลัง")
  - ratio     → int อัตราส่วนเทียบกับหน่วยเล็กสุด
  - level     → 1 (เล็กสุด) / 2 / 3 (ใหญ่สุด)
  - UNIQUE KEY (pro_code, level)

shopping_cart.spc_unit_enum → enum '1'|'2'|'3'  (แทน spc_unit string)
hotdeal_entity.pro1_unit / pro2_unit → '1'|'2'|'3' (varchar แต่เก็บ level)
promotion_reward.unit → '1'|'2'|'3' (varchar แต่เก็บ level)
```

### Pattern การแปลงหน่วย

**Enum → Unit name (สำหรับ display):**
```typescript
// ใช้ transformProductWithUnits() จาก ProductsService
const transformed = await productsService.transformProductWithUnits(product);
// → { pro_unit1: "ชิ้น", pro_unit2: "กล่อง", pro_unit3: "ลัง", pro_ratio1: 1, ... }
```

**Unit name → Enum (สำหรับ save ลง cart):**
```typescript
// ใช้ convertUnitNameToEnum() ใน ShoppingCartService (private)
// รับ unit name string → คืน '1'|'2'|'3'
```

---

## สิ่งสำคัญที่ต้องรู้

- **`product.units` relation ต้อง load เสมอ** เมื่อต้องการข้อมูลหน่วย — ถ้าไม่ load จะ default เป็น ratio = 1
- **`spc_unit_enum` อาจเป็น NULL** สำหรับ cart items เก่าที่ unit ไม่ match — ระบบจะ skip row ไม่ delete
- **ห้ามใช้ `pro_unit1/2/3` โดยตรงบน ProductEntity** — columns เหล่านั้นถูกลบออกแล้ว
  ใช้ `transformProductWithUnits()` แทน

---

## คำสั่งที่ใช้บ่อย

```bash
# รัน development
npm run start:dev

# รัน migration
npm run migration:run

# ย้อน migration
npm run migration:revert

# รัน tests
npm run test

# รัน tests แบบ watch
npm run test:watch
```
