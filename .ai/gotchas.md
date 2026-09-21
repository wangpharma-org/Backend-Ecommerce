# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Never query the DB inside a `.map()` on a list — batch-fetch with `In([...])` and group by key instead
**Why:** PR#139, PR#176 — N+1 query pattern found in `getAllHotdealsWithProductNames` (1 query per hotdeal × 2 products → 100+ queries for 50 hotdeals) and again in `happy-hour simulate()`. Reviewer flagged both as performance bugs requiring a batch fix. The correct pattern already existed in `getRewardsByTier` / `getRewardByTierId` in the same codebase.
**Example:**
```ts
// ✗ no — N+1: 1 query per item
const results = await Promise.all(
  items.map(async (item) => {
    const product = await this.productRepo.findOne({ where: { pro_code: item.pro_code } });
    return { ...item, product };
  }),
);

// ✓ batch: 1 query for all items
const codes = items.map((i) => i.pro_code);
const products = await this.productRepo.find({ where: { pro_code: In(codes) } });
const byCode = Object.fromEntries(products.map((p) => [p.pro_code, p]));
const results = items.map((item) => ({ ...item, product: byCode[item.pro_code] }));
```
**Location:** src/hotdeal/hotdeal.service.ts (getAllHotdealsWithProductNames), src/happy-hour/happy-hour.service.ts (simulate)
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139, PR#176 @Sasit-Nine — /pull/176
**Added:** 2026-09-21

### G-003  Never compare against the string `'null'` to detect a missing value; use `=== null` or `??`/`?.`
**Why:** PR#139 — `if (displayUnit === 'null')` silently deleted cart items when `spc_unit_enum` was null in the DB, because `String(null) === 'null'` is `true`. Cart items whose unit migration found no match got `spc_unit_enum = null`, and this string guard caused them to be deleted without warning.
**Example:**
```ts
// ✗ no — String(null) is 'null', so this deletes rows with a null unit silently
if (displayUnit === 'null') {
  await this.shoppingCartRepo.delete({ spc_id: row.spc_id });
}

// ✓ check the actual null/undefined
if (displayUnit == null) { /* handle missing unit */ }
// or guard at the source so displayUnit is never null
const displayUnit = unit ?? '';
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-09-21  **Confidence:** medium (single occurrence)
