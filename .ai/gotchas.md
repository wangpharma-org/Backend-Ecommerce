# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Querying the DB once per entity inside a loop produces O(N) round-trips
**Why:** PR#139 — `getAllHotdealsWithProductNames()`, `getHotdealByProCode()`, and `getHotdealInfo()` each called `transformProductWithUnits()` inside a `Promise.all(map(...))`, making two DB hits per hotdeal. 50 hotdeals = 100+ queries per request. The same PR already demonstrated the correct pattern in `getRewardsByTier`: batch-fetch with TypeORM's `In([...ids])` once, then group into a `Map` before iterating.
**Example:**
```ts
// ✗ N+1 — two queries per hotdeal
const items = await Promise.all(
  hotdeals.map(async (hd) => {
    const u1 = await this.productService.transformProductWithUnits(hd.product);
    const u2 = await this.productService.transformProductWithUnits(hd.product2);
    return { ...hd, u1, u2 };
  }),
);

// ✓ batch once, look up in Map
const proCodes = hotdeals.flatMap((hd) => [hd.pro_code1, hd.pro_code2]);
const units = await this.productUnitRepo.find({ where: { pro_code: In(proCodes) } });
const unitMap = new Map(units.map((u) => [u.pro_code, u]));
const items = hotdeals.map((hd) => ({ ...hd, u1: unitMap.get(hd.pro_code1), u2: unitMap.get(hd.pro_code2) }));
```
**Location:** src/hotdeal/hotdeal.service.ts (getAllHotdealsWithProductNames, getHotdealByProCode, getHotdealInfo)
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-06-01  **Confidence:** high
