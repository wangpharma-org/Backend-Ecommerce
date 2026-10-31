# E2E activity-tracking — local

- environment: **local**
- commit: Backend-Ecommerce `efdac03` · sale-backend `16979f5`
- เวลา: 2026-10-24T02:14:54.247Z
- e-commerce: http://localhost:3051/api · sale-backend: http://localhost:3052/api/sale
- โปร: 39 · สินค้า E2E-P01 × 30 · ร้าน E2E-C01 · สั่งซื้อ: ใช่
- tag ข้อมูลทดสอบ: session_id ขึ้นต้น `E2E local 2026-10-24T02:14:54`
- ผล: **15/15**

| # | ขั้น | ผล | รายละเอียด |
|---|---|---|---|
| 1 | เปิด flag activity_tracking | PASS | HTTP 201 |
| 2 | ไม่มี token → ถูกปฏิเสธ | PASS | HTTP 401 |
| 3 | เกิน 50 รายการ → 400 | PASS | HTTP 400 |
| 4 | ส่งชุดอีเวนต์: รับ 3 ทิ้ง 3 (add_cart จาก client / ชื่อฟีเจอร์ผิด / โปรไม่มีจริง) | PASS | HTTP 200 {"enabled":true,"accepted":3,"dropped":3} |
| 5 | ใส่ตะกร้าสินค้าในเงื่อนไข | PASS | HTTP 201 |
| 6 | สั่งซื้อ (sales ทำแทน emp_code) | PASS | HTTP 201 005-000002 |
| 7 | sale-backend summary เห็นทุกขั้น | PASS | มี impression,open,click,add_cart,order (ต้องการ impression,open,click,add_cart,order) |
| 8 | ร้านทดสอบอยู่ในรายชื่อร้าน ขั้นลึกสุดถูก | PASS | {"memCode":"E2E-C01","stage":"order","impressions":1,"opens":1,"clicks":1,"addCarts":1,"orders":1,"value":4500,"channels":["web"],"empCodes":["E2E-EMP"],"firstAt":"2026-10-24T02:14:54.286Z","lastAt":"2026-10-24T02:14:54.435Z"} |
| 9 | channel = web (จาก User-Agent) | PASS | ["web"] |
| 10 | ยอดบาทของออเดอร์ > 0 | PASS | value=4500 |
| 11 | emp_code ของ sales ติดมากับออเดอร์ | PASS | ["E2E-EMP"] |
| 12 | summary แยก actorType=sales ของ order | PASS | [{"channel":"web","actorType":"sales","action":"order","events":1,"stores":1,"value":4500}] |
| 13 | ไม่มีสิทธิ์ SALE_ACTIVITY:READ → 403 | PASS | HTTP 403 |
| 14 | query ผิดรูปแบบ → 400 | PASS | HTTP 400 |
| 15 | คืนค่า flag activity_tracking = ปิด | PASS | HTTP 201 |

## ตรวจผ่านหน้าเว็บจริง (Ecommerce-Frontend `3d285e7`, local)

เปิดหน้าแรกด้วย Playwright (ร้าน E2E-C01, vite → backend local) — ไม่ได้อยู่ในสคริปต์ e2e อัตโนมัติ (ต้องเตรียม session + ปิด tour) สคริปต์อยู่ `~/Developer/_local/activity-tracking/scripts/browser-check.cjs`

| ขั้น | อีเวนต์ที่หน้าเว็บส่ง | ผล |
|---|---|---|
| การ์ด Company Day + Wang Day โผล่บนจอ ≥ 1 วินาที | `impression:company_day:39:home_banner`, `impression:wang_day:40:home_banner` (ชุดเดียว) | 200 accepted 2 |
| กดการ์ด Company Day → หน้า `/product-list?promo_id=39` | `click:company_day:39:home_banner`, `open:company_day:39:product_list` | 200 accepted 2 |
| sale-backend `activity_events` | 4 แถว channel `web`, source `ecommerce-client` | ตรง |

พบระหว่างทาง (บั๊กเดิม ไม่ได้แก้ในงานนี้): ถ้าตาราง `modalmain` ว่าง `GET /ecom/admin/modal-content/get` ตอบ `data: null` แล้ว Navbar ทำ `[null].filter(m => m.show)` หน้าแรกขาวทั้งหน้า
