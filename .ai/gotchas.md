# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Avoid N+1 queries: don't issue a DB call per loop iteration; batch with `In()` or TypeORM relations instead
**Why:** PR#139 (`getAllHotdealsWithProductNames`) and PR#176 (`simulate()`) both had N+1 patterns flagged as critical by reviewers. A loop that fires one query per item multiplies latency with item count and saturates the connection pool.
**Example:**
```ts
// ✗ N+1 — one SELECT per hotdeal
for (const h of hotdeals) {
  h.products = await this.productRepo.find({ where: { pro_code: h.pro_code } })
}

// ✓ one SELECT, join in memory
const codes = hotdeals.map(h => h.pro_code)
const products = await this.productRepo.findBy({ pro_code: In(codes) })
const byCode = groupBy(products, p => p.pro_code)
for (const h of hotdeals) { h.products = byCode[h.pro_code] ?? [] }
```
**Source:** PR#139 @Sasit-Nine, PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139, /pull/176
**Added:** 2026-06-29

### G-003  Don't change column options in an Entity file without a corresponding migration — TypeORM drops and recreates the column
**Why:** PR#205 — reviewer explicitly warned "ห้ามแก้ Entity เนื่องจาก Column จะโดน Drop ทิ้ง และสร้างใหม่". Changing `nullable`, `type`, or `default` in the entity without a migration is safe only while `SYNCHRONIZE=false`; if that flag ever flips (local dev, CI seed) data is silently lost.
**Example:**
```ts
// ✗ changing column options in entity without a migration
@Column({ type: 'varchar', nullable: true })  // was: nullable: false
someColumn: string | null

// ✓ write a migration that ALTERs the column; keep the entity in sync with that migration
```
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-06-29
