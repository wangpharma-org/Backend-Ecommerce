# ห้ามใส่ตะกร้าเกินสต็อก (ECWC-766)

## กติกา
- เช็คที่ `POST /api/ecom/product-add-cart` (`ShoppingCartService.addProductCart`) **ตอนเพิ่มจำนวนเท่านั้น** — ตอนยืนยันสั่งซื้อไม่เช็คซ้ำ (ตกลงกับผู้ใช้ 13 พ.ย. 69)
- จำนวนที่ขอ = ทุกแถวของสินค้านั้นในตะกร้า (ทุกหน่วย + แถวกระเช้า) แปลงเป็นหน่วยเล็กสุดด้วย `product_unit.ratio` + จำนวนที่กำลังเพิ่ม → เทียบ `product.pro_stock` (หน่วยเล็กสุด)
- ไม่นับของแถม hotdeal (`hotdeal_free`) / ของรางวัล (`is_reward`)
- ลดจำนวน (amount ≤ 0) ทำได้เสมอ แม้ของในตะกร้าเกินสต็อกอยู่แล้ว
- ไม่ผูกสต็อก: สติ๊กเกอร์สั่งทำ (`customOptions`) และพรีออเดอร์ที่จัดสรรแล้ว (`isPreorderFulfillment`)
- เกิน → `400` ข้อความ (ไม่บอกตัวเลขสต็อก):
  `จำนวนที่สั่งเกินกว่าสินค้าคงเหลือในระบบ หากต้องการสั่งมากกว่านี้ กรุณาติดต่อฝ่ายขาย หรือ Line @wangpharma`
  หน้าบ้านจับด้วยข้อความ `เกินกว่าสินค้าคงเหลือ` (`isCartStockLimitError` ใน `utils/cartError.ts`) — ไม่ใช้ 409 เพราะ 409 = cart version conflict

## ขอให้ฝ่ายขายติดต่อกลับ
- popup เกินสต็อกมีปุ่ม **"แจ้งฝ่ายขายให้ติดต่อกลับ"** (กดปุ่มเดียวจบ) และหน้ารายละเอียดสินค้า/ตะกร้ามีลิงก์ "ต้องการมากกว่านี้?" เมื่อปุ่ม + เป็นสีเทา
- `POST /api/ecom/cart/stock-callback-request` (JWT ร้าน — ร้านมาจาก token เท่านั้น) body `{ pro_code, pro_unit?, amount }` → `{ id, status, repeated }`
  - เก็บที่ตาราง `stock_callback_request` (migration `20261113000200`) · ร้าน+สินค้าที่ยัง `open` รวมเป็นแถวเดียว อัปเดตจำนวนล่าสุด · กดซ้ำภายใน 60 วิไม่นับ `request_count` เพิ่ม
  - `requested_smallest` = ของในตะกร้า + ที่กด (หน่วยเล็กสุด) · `stock_smallest` = สต็อกตอนกด · flag ปิด → 404
- ระบบขาย (sale-backend → หน้า Sale Service ที่เซลส์ทุกคนเห็น) ใช้ internal API (`x-internal-token` = `INTERNAL_API_TOKEN`):
  - `GET /api/ecom/internal/stock-callback-requests?status=open|contacted|closed|all&q=&page=&limit=` → `{ items, total, page, limit, counts }` (แนบชื่อร้าน เบอร์ สาย เซลส์เจ้าของร้าน ชื่อสินค้า หน่วยเล็กสุด สต็อกตอนนี้)
  - `PATCH /api/ecom/internal/stock-callback-requests/:id` `{ status, note?, emp_code, emp_name? }` — ผู้ดำเนินการมาจาก token ของเซลส์ฝั่ง sale-backend

## Feature flag
`cart_stock_limit` — migration `20261113000100-add-cart-stock-limit-flag` สร้างไว้เป็นปิด + อยู่ใน `DEFAULT_DISABLED_FLAGS`
ปิด = behavior เดิม (ใส่เกินสต็อกได้)

## โค้ด
- logic ล้วน + unit test: `src/shopping-cart/cart-stock-limit.ts`
- e2e: `scripts/e2e/cart-stock-limit.e2e.ts` (ต้องการ `ADMIN_TOKEN` ที่จัดการ flag ได้, `USER_TOKEN`, `PRO_CODE` ที่มีสต็อกและหน่วยใหญ่ ratio > 1)

## ยังไม่ครอบคลุม
- กระเช้าโปร/กระเช้าสำเร็จรูป (`cart-basket.service`) มีเช็คสต็อกของตัวเองอยู่แล้วแต่ไม่นับแถวสินค้าเดี่ยวในตะกร้า
- การยืนยันสั่งซื้อ (submit-order) ไม่เช็คซ้ำ — ถ้าสต็อกลดหลังใส่ตะกร้า ยังสั่งได้ตามจำนวนในตะกร้า
