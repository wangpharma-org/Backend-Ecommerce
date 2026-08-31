# DHL tracking inbound API

ระบบภายนอกส่งหมายเลขพัสดุ DHL เข้ามาที่ E-commerce โดยอ้างอิงเลขคำสั่งจอง
`soh_running` จาก `shopping_head` ซึ่งเป็นเลขเดียวกับที่หน้าติดตามคำสั่งจอง
ใช้เรียกข้อมูลรายละเอียดคำสั่งจองอยู่แล้ว

## Endpoint

`POST /api/ecom/external/dhl-tracking`

ใช้ JWT access token เช่นเดียวกับ endpoint ที่ใช้ `JwtAuthGuard` อื่นในระบบ

```http
POST /api/ecom/external/dhl-tracking
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "soh_running": "<เลขคำสั่งจอง>",
  "tracking_number": "7128083062012186"
}
```

Response เมื่อบันทึกสำเร็จ:

```json
{
  "success": true,
  "soh_running": "<เลขคำสั่งจอง>",
  "tracking_number": "7128083062012186"
}
```

ส่งคู่ `soh_running` และ `tracking_number` เดิมซ้ำได้อย่างปลอดภัย (upsert) และ
หนึ่งคำสั่งจองมี DHL tracking ได้หลายเลข เพื่อรองรับการแยกส่งสินค้า

## Validation และสถานะตอบกลับ

| สถานะ | กรณี |
| --- | --- |
| 201 | บันทึกสำเร็จ หรือส่งข้อมูลเดิมซ้ำ |
| 400 | body ไม่ครบ, มี field ที่ไม่กำหนด, หรือข้อความยาวเกินกำหนด |
| 401 | ไม่ได้ส่ง JWT หรือ JWT ไม่ถูกต้อง |
| 404 | ไม่พบ `soh_running` ใน `shopping_head` จึงไม่บันทึกข้อมูลที่อ้างอิงไม่ได้ |

ตาราง `dhl_tracking` เก็บ `soh_running`, `tracking_number`, `created_at` และ
`updated_at` โดยมี unique key ที่ `(soh_running, tracking_number)` และ index ที่
`soh_running` สำหรับใช้เพิ่มปุ่มลิงก์ DHL ในหน้าติดตามสินค้าในงานถัดไป
(`https://www.dhl.com/th-th/home/tracking.html?tracking-id=<tracking_number>&submit=1`).
