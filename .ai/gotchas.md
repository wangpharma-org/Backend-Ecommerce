# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Wrapping per-item DB calls inside `Promise.all(items.map(async …))` creates N+1 queries silently
**Why:** PR#139 — `getAllHotdealsWithProductNames()` called `transformProductWithUnits()` per hotdeal inside `Promise.all`, generating 2 DB queries per hotdeal (100+ queries for 50 hotdeals per request). The same pattern recurred in `getHotdealByProCode()` and `getHotdealInfo()`. Fix: batch-fetch all needed rows with `In([...ids])` once, then group into a `Map` for O(1) lookup — the PR already used this pattern correctly in `getRewardsByTier`.
**Example:**
```ts
// ✗ N+1 — one DB round trip per item
const results = await Promise.all(
  items.map(async (item) => this.repo.findOne({ where: { id: item.id } }))
)
// ✓ batch fetch — one round trip
const rows = await this.repo.findBy({ id: In(items.map(i => i.id)) })
const byId = new Map(rows.map(r => [r.id, r]))
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-09-07

### G-003  Duplicated utility functions with divergent fallbacks silently corrupt saved data
**Why:** PR#139 — `convertEnumToUnitName` was copy-pasted into 4 services with different fallbacks: `products.service.ts` returned `''` on no-match; `shopping-order.service.ts` and `promotion.service.ts` returned `String(enumValue)` (e.g., `"1"`). Orders were saved with `spo_unit = "1"` instead of a real unit name in some code paths.
**Example:**
```ts
// products.service.ts → fallback ''
units.find(u => u.level === e)?.unit_name ?? ''
// shopping-order.service.ts diverged → fallback String(e) = "1"
units.find(u => u.level === e)?.unit_name ?? String(e)
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-09-07
