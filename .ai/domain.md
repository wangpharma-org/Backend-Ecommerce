# Domain Knowledge

Business facts the code must respect. Context, not lint-able.

Format per entry: `### D-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### D-001  Freebie quantity = qualifying sets × pro2_amount; sum across tiers
**Why:** PR#143 — `totalFreebies` used the number of qualifying sets directly as quantity. For "ซื้อ 10 ได้ของแถม 2 ชิ้น" that yields 1/set instead of 2. Also: when multiple promo tiers grant the SAME freebie SKU, quantities must be summed (group by `pro_code + unit`), not overwritten.
**Example:**
```ts
freebieQty = totalFreebies * Number(hd.pro2_amount)
existing.quantity += freebieQty // accumulate across tiers, don't replace
```
**Location:** src/shopping-cart/shopping-cart.service.ts:1815-1824, 1850-1859
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19
