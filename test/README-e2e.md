# E2E tests

เทสชุดนี้ยิง HTTP ใส่ backend ที่**รันอยู่จริง** ไม่ได้ boot `AppModule` ในตัวเทส
เพื่อให้ครอบทั้ง stack — guard, DB, การคำนวณ, transaction

## ต้องมีก่อนรัน

**1. docker ขึ้นครบ**

```bash
docker compose up -d db-ecommerce-services-demo zookeeper kafka
```

Kafka จำเป็น — ถ้าไม่ขึ้น `bootstrap` ของแอปจะล้มทั้งตัว

**2. backend รันอยู่**

```bash
npm run start:dev
```

**3. บัญชีทดสอบใน DB**

เทสต้องล็อกอินได้ จึงต้องมีบัญชีที่รู้รหัสผ่าน สร้างครั้งเดียวพอ:

```bash
# สร้าง hash
node -e "require('bcrypt').hash('e2e-test-pass-2026',10).then(h=>console.log(h))"
```

```sql
INSERT INTO users (mem_code, mem_username, mem_password, mem_nameSite, mem_price, permision_admin, role)
VALUES ('E2E-TEST', 'e2e_test_user', '<hash ที่ได้>', 'ร้านทดสอบอัตโนมัติ (E2E)', 'C', 1, 'Admin')
ON DUPLICATE KEY UPDATE mem_password = VALUES(mem_password);
```

> บัญชีนี้ใช้เฉพาะเครื่อง dev เท่านั้น **ห้ามสร้างบน production**

**4. โปรโมชั่นที่ใช้ทดสอบ**

ต้องเป็นโปรที่ยัง active มีสินค้าร่วมรายการอย่างน้อย 2 ตัวที่มีหน่วยและราคา
ค่าเริ่มต้นคือ `promo_id = 189` เปลี่ยนได้ด้วย `E2E_PROMO_ID`

หาโปรที่ใช้ได้:

```sql
SELECT p.promo_id, COUNT(DISTINCT c.product_code) AS products
FROM promotion p
JOIN promotion_tier t ON t.promo_id = p.promo_id AND t.deleted_at IS NULL
JOIN promotion_condition c ON c.tier_id = t.tier_id
WHERE p.deleted_at IS NULL AND p.status = 1
  AND p.start_date <= NOW() AND p.end_date >= NOW()
GROUP BY p.promo_id HAVING products >= 2;
```

## รัน

```bash
npm run test:e2e -- promo-basket          # เฉพาะชุดกระเช้า
npm run test:e2e -- --runInBand           # ทั้งหมด — ต้องรันทีละไฟล์ เพราะทุกชุดใช้ตะกร้าของบัญชีทดสอบเดียวกัน
```

ปรับปลายทาง/บัญชีได้ด้วย env:

```bash
E2E_BASE_URL=http://localhost:3021 \
E2E_USERNAME=e2e_test_user \
E2E_PASSWORD=e2e-test-pass-2026 \
E2E_PROMO_ID=189 \
npm run test:e2e -- promo-basket
```

## ชุดที่มี

| ไฟล์ | ครอบอะไร |
|---|---|
| `promo-basket.e2e-spec.ts` | กระเช้าโปรโมชั่น — สร้าง/อ่าน/เอาออกทีละชิ้น/ยกออกทั้งก้อน/เกณฑ์ขั้นต่ำ/สต็อก/สิทธิ์/ไม่ปนกับสินค้าเดี่ยว/ของแถมคิดใหม่ทันที |
| `set-basket.e2e-spec.ts` | กระเช้าสำเร็จรูป (bundle_set) — เข้าตะกร้าทั้งชุดในราคาชุด/ยอดรวมคิดที่ราคาชุด/แบ่งขายไม่ได้/สต็อก/payload ผิดรูป (ต้องมี set ที่ active เช่น `SET-DEMO-01`) |
| `promo-reward-sets.e2e-spec.ts` | จำนวนชุดของแถม (ECWC-496 review) — ยอดหลายเท่าของเกณฑ์ได้หลายชุด / พรีวิวกระเช้าก่อนใส่ตะกร้าตรงกับของแถมที่ engine แจกจริง / basket กับ board รายงานตัวเลขเดียวกัน |
| `flashsale-collection.e2e-spec.ts` | flashsale ในคอลเลกชันพิเศษ (ECWC-523) — ลูกค้าเห็นเฉพาะรอบที่ยังไม่จบ/แอดมินเห็นรอบที่จบเป็น unavailable/endpoint สินค้าในรอบ + live/หน้าแรกยังเห็นเฉพาะรอบที่กำลังลด/ใส่ตะกร้าแล้วสะท้อนจำนวน (สร้าง flashsale + คอลเลกชันเองแล้วลบทิ้ง) |
| `app.e2e-spec.ts` | scaffold เดิมของ NestJS ยังไม่ได้ใช้งานจริง |

## ข้อควรรู้

เทสจะ **ล้างกระเช้าของ `E2E_PROMO_ID` ทิ้งก่อนและหลังทุกเคส** ถ้ารันด้วยบัญชีที่มี
กระเช้าจริงอยู่ ของจะหาย — ใช้บัญชีทดสอบเท่านั้น
ชุด `set-basket` ล้างแรงกว่านั้น: **ทั้งตะกร้า** (กระเช้าทุกชนิด + สินค้าเดี่ยว) เพราะต้องเทียบยอดรวมจาก 0
