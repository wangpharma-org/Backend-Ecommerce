# Preorder API — เชื่อมระบบภายนอก (ERP/โกดัง)

API สำหรับระบบภายนอก (เช่น WangERP/โกดัง) ดึงข้อมูลรอบ Pre-order และรายการสั่งจองของลูกค้า
เพื่อใช้วางแผนจัดซื้อ/จัดสต็อก ไม่ใช่ endpoint สำหรับหน้าเว็บ Ecommerce (ดู [docs/preorder.md](../preorder.md) สำหรับภาพรวมฟีเจอร์ Pre-order ทั้งหมด)

## Auth

ทุก endpoint ต้องแนบ JWT ของบัญชีที่มี `permission: true` (แอดมิน) ผ่าน header:

```
Authorization: Bearer <token>
```

ได้ token จาก `POST /api/ecom/login` (`{ username, password }`) — ไม่มี endpoint auth แยกสำหรับระบบภายนอก
ถ้าไม่มี token หรือ token ไม่ใช่แอดมิน จะได้ `401 Unauthorized`

Base URL: `<BASE_URL>/api/ecom` (local dev: `http://localhost:3021/api/ecom`)

---

## 1. GET `/admin/preorder/erp/campaigns`

รายการรอบ Pre-order **ทั้งหมด** (ทุกสถานะ) พร้อมสินค้าที่เปิดจองในแต่ละรอบ (เฉพาะสินค้าที่ `is_active = true`)

### Response `200`

```jsonc
[
  {
    "id": 1,
    "name": "ฟ้าทะลายโจร รอบ 20 ก.ย. 2569",
    "mode": "aggregation",        // "allocation" | "aggregation"
    "status": "open",             // "draft" | "open" | "closed" | "allocating" | "fulfilled" | "cancelled"
    "starts_at": "2026-09-15T13:18:00.000Z",  // null ได้ (ไม่กำหนด = เปิดทันทีที่ status=open)
    "ends_at": "2026-09-20T13:00:00.000Z",    // null ได้ (ไม่กำหนดวันปิด)
    "products": [
      {
        "preorder_product_id": 2,   // ใช้เป็น param เรียก endpoint อื่นในกลุ่ม admin/preorder/products/:id/*
        "pro_code": "06010005",
        "pro_name": "-ฟ้าทะลายโจรสกัด10แค็ป[20มก]85บ1*10ผ/ไวทัลแคลร์",
        "pro_nameTH": null,
        "pro_imgmain": "../cms/product/17242220-pic-main.jpg",
        "pro_priceA": "440.00",
        "pro_priceB": "459.00",
        "pro_priceC": "459.00",
        "pro_unit1": "กล[10ผ]",     // หน่วยเล็กสุด (level 1) — null ถ้าไม่มี
        "pro_ratio1": 1,
        "pro_unit2": null,          // หน่วย level 2/3 — null ถ้าสินค้านี้ไม่มีหน่วยระดับนั้น
        "pro_ratio2": null,
        "pro_unit3": null,
        "pro_ratio3": null
      }
    ]
  }
]
```

### หมายเหตุ

- `pro_imgmain` เป็น path ดิบจาก DB — ถ้าขึ้นต้นด้วย `..` ต้องต่อเป็น `https://www.wangpharma.com<path ตัด ".." ออก 2 ตัวแรก>` เอง (เหมือนหน้าเว็บ)
- ราคา `pro_priceA/B/C` เป็น string ทศนิยม 2 ตำแหน่ง (แปลงมาจาก `decimal` ของ DB)
- `products` เป็น `[]` ถ้ารอบนั้นยังไม่มีสินค้า หรือสินค้าถูกถอดออกหมด (ไม่ error)

---

## 2. GET `/admin/preorder/erp/campaigns/:id/orders`

รายการสั่งจองของลูกค้าทั้งหมดใน **รอบเดียว** (เอา `id` จาก endpoint 1 มาใส่) จัดกลุ่มตามร้าน (`mem_code`)
**ไม่รวมรายการที่ถูกยกเลิก** (`status = cancelled`)

### Path param

| param | ชนิด | ความหมาย |
|---|---|---|
| `id` | number | `preorder_campaigns.id` (จาก endpoint 1) |

### Response `200`

```jsonc
[
  {
    "mem_code": "0539",
    "mem_name": "พนง.ธรรมรัตน์  จงวิไลเกษม",  // = users.mem_nameSite (ชื่อร้าน/หน้าร้าน)
    "mem_phone": "091-3285008",
    "mem_price": "C",                          // ราคากลุ่ม A/B/C ของร้าน
    "mem_route": "L1-1",
    "items": [
      {
        "item_id": 1,
        "preorder_product_id": 2,
        "pro_code": "06010005",
        "pro_name": "-ฟ้าทะลายโจรสกัด10แค็ป[20มก]85บ1*10ผ/ไวทัลแคลร์",
        "pro_nameTH": null,
        "pro_imgmain": "../cms/product/17242220-pic-main.jpg",
        "pro_unit": "กล[10ผ]",        // หน่วยที่ลูกค้าเลือกตอนจอง (ไม่ใช่หน่วยเล็กสุดเสมอไป)
        "amount": 10,                 // จำนวนที่จอง
        "allocated_qty": null,        // จำนวนที่จัดสรรให้จริง — null ถ้ายังไม่จัดสรร (โหมด allocation เท่านั้น)
        "status": "reserved",         // "reserved" | "locked" | "allocated" | "fulfilled" | "cancelled" (cancelled ถูกกรองออกแล้ว)
        "is_paid": false,
        "ordered_at": "2026-09-15T14:26:28.288Z"  // เวลาจองครั้งแรก ไม่เปลี่ยนแม้แก้จำนวนทีหลัง
      }
    ]
  }
]
```

### Error

| code | เมื่อไหร่ |
|---|---|
| `404` | ไม่พบรอบจอง id นี้ (`ไม่พบรอบจอง id=<id>`) |

### หมายเหตุ

- ลูกค้า 1 คนอาจมีหลายรายการใน `items` ถ้าจองหลายสินค้าในรอบเดียวกัน
- `amount` คือยอดรวมทั้งแถว (ถ้าลูกค้าเคยเพิ่ม/ลดจำนวน `amount` คือยอดล่าสุด ไม่ใช่ยอดสะสมของแต่ละครั้ง)
- `allocated_qty` มีความหมายเฉพาะโหมด `allocation` (ของขาด จำกัดจำนวน) — โหมด `aggregation` จะเป็น `null` เสมอจนกว่า admin จะสั่งจัดสรร

---

## ตัวอย่างการเรียกใช้งาน

```bash
# 1) login เอา token
curl -X POST "$BASE_URL/api/ecom/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"<admin_username>","password":"<password>"}'

# 2) ดึงรายการรอบทั้งหมด
curl "$BASE_URL/api/ecom/admin/preorder/erp/campaigns" \
  -H "Authorization: Bearer $TOKEN"

# 3) ดึงรายการสั่งจองของรอบ id=1
curl "$BASE_URL/api/ecom/admin/preorder/erp/campaigns/1/orders" \
  -H "Authorization: Bearer $TOKEN"
```

## Source

- Controller: [src/preorder/preorder.controller.ts](../../src/preorder/preorder.controller.ts) (`listCampaignsForErp`, `listCampaignOrdersForErp`)
- Service: [src/preorder/preorder.service.ts](../../src/preorder/preorder.service.ts)
