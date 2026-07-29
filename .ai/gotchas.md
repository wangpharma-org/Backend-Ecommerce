# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  `Promise.all(items.map(async i => repo.findOne(...)))` is an N+1 query trap
**Why:** Flagged in PR#139 (`getAllHotdealsWithProductNames` — 2 queries per hotdeal, so 100+ queries for 50 hotdeals) and again in PR#176 (`simulate()` — 1 query per reward slot). The pattern looks concurrent but issues a separate DB round-trip per item. Fix: one `In([...ids])` query, then group into a `Map`.
**Example:**
```ts
// ✗ N+1 — 1 DB call per item
const results = await Promise.all(
  items.map(async (item) => repo.findOne({ where: { pro_code: item.pro_code } }))
);

// ✓ batch — 1 DB call total
const proCodes = items.map((i) => i.pro_code);
const products = await repo.find({ where: { pro_code: In(proCodes) } });
const byCode = new Map(products.map((p) => [p.pro_code, p]));
const results = items.map((i) => byCode.get(i.pro_code));
```
**Location:** src/hotdeal/hotdeal.service.ts, src/happy-hour/happy-hour.service.ts
**Source:** PR#139 @Sasit-Nine, PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139 , /pull/176
**Added:** 2026-07-13

### G-003  Copy-pasting unit-conversion helpers with divergent fallbacks causes silent data corruption
**Why:** PR#139 — `convertEnumToUnitName` existed in 4 services. `products.service.ts` returned `''` on miss; `promotion.service.ts` and `shopping-order.service.ts` returned `String(unitEnum)` (e.g. `"1"`, `"2"`). Orders saved by the latter stored `spo_unit = "1"` instead of an actual unit name, breaking display and downstream lookups.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-07-13

### G-004  Changing an `@Column()` definition in an `@Entity` file without a migration will DROP the column if `synchronize` runs
**Why:** PR#205 — reviewer flagged directly editing `creditor.entity.ts` column definitions: "ห้ามแก้ Entity เนื่องจาก Column จะโดน Drop ทิ้ง และสร้างใหม่". TypeORM treats any spec change (type, length, nullable) as DROP + re-ADD, destroying existing data. Always write a migration instead of touching `@Column()`.
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-07-13
