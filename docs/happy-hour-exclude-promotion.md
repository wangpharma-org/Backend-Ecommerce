# Happy Hour ไม่รวมกับ Promotion (ECWC-747)

## กติกา

- บรรทัดในตะกร้าที่ติด `promo_id` = นับเข้า tier ของ promotion ที่ถึงเกณฑ์แล้ว (ทั้ง **Company Day** และ **Wang Day**)
  → **ไม่นับ**เข้ายอดขั้นต่ำของ Happy Hour
- สินค้าอื่นในบิลเดียวกันยังได้ Happy Hour ตามปกติ
- ทุกบรรทัดเข้าโปร → ไม่ได้ Happy Hour
- ใช้กับ `min_order_scope` ทุกแบบ (`all` / `specific` / `vendor`) — ตัดบรรทัดโปรออกก่อน แล้วค่อยกรองตาม scope

`promo_id` ถูกเขียนลงแถวตะกร้าโดย `ShoppingCartService.syncConditionTagsToCart` ทุกครั้งที่ตะกร้าเปลี่ยน
(เฉพาะ tier ที่ถึงเกณฑ์ — สินค้าในเงื่อนไขโปรที่ยังไม่ถึง tier ไม่ติด tag และยังนับเข้า Happy Hour)

## จุดที่ใช้

| จุด | ที่มาของ `promo_id` |
|-----|---------------------|
| `POST /happy-hour/cart-preview` (หน้าร้าน) | `summaryCartDetailed` → `lines[].promo_id` จากแถวตะกร้า |
| checkout-preview (ระบบขาย) | `previewCheckoutLines` → tag จากแผนโปรที่คำนวณสด (แถวเสมือน) |
| `submitOrder` | แถวตะกร้าที่สั่งจริง (`normalItems[i].promo_id`) |

ค่าจาก client ไม่ถูกใช้ — `CartPreviewDto` ไม่มีฟิลด์ `promo_id`

Response ของ cart-preview มีฟิลด์ใหม่ `promotion_excluded_amount` (ยอดที่ตัดออก) เฉพาะตอนเปิด flag

## Feature flag

`happy_hour_exclude_promotion` — migration `20261022000100` สร้างไว้เป็น **ปิด** (behavior เดิม: นับยอดทั้งบิล)
อ่าน flag ไม่ได้ → ถือว่าปิด (Happy Hour ไม่หายทั้งบิล)

## e2e

`scripts/e2e/happy-hour-exclude-promotion.e2e.ts`
