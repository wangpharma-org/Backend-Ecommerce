# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Batch N+1 fixes must be applied to ALL methods in the service that share the same data-access pattern — a partial fix leaves regressions in sibling methods
**Why:** PR#176 — `enrichSlotWithProducts()` was correctly refactored to a single batch `IN` query, but `simulate()` in the same file still contained the per-item `findOne()` loop. The N+1 was invisibly reintroduced in every call path that goes through `simulate()`.
**Example:**
```ts
// After fixing enrichSlotWithProducts(), also fix simulate():
// ✗ — forgot to fix sibling method
async simulate(...) {
  const products = await Promise.all(
    slot.rewards.map(r => productRepo.findOne({ where: { pro_code: r.pro_code } }))
  )
}

// ✓ — same batch pattern used in enrichSlotWithProducts
async simulate(...) {
  const proCodes = slot.rewards.map(r => r.pro_code)
  const products = await productRepo.find({ where: { pro_code: In(proCodes) } })
  const byCode = new Map(products.map(p => [p.pro_code, p]))
}
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-08-24

### G-003  `String(null) === 'null'` evaluates to `true` — never test for null by converting to string
**Why:** PR#139 — `if (displayUnit === 'null')` silently deleted shopping cart items whenever `spc_unit_enum` was null in the DB, because `String(null)` yields the literal string `"null"`. The deletion happened without any warning.
**Example:**
```ts
// ✗ — deletes when unit is DB-null
if (String(row.spc_unit_enum) === 'null') {
  await cartRepo.delete({ spc_id: row.spc_id })
}

// ✓ — explicit null check
if (row.spc_unit_enum == null) {
  this.logger.warn(`cart item ${row.spc_id} has no unit — skipping`)
}
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-24

### G-004  `Promise.all(items.map(async i => repo.findOne(...)))` fires N separate DB queries — batch with `In()` instead
**Why:** PR#139 — `getAllHotdealsWithProductNames()` used `Promise.all(hotdeals.map(...))` to fetch product units, generating 2N DB round-trips per request. Concurrent promises reduce wall-clock time but do not reduce query count. A single batch `find({ where: { id: In([...]) } })` replaces all N calls.
**Example:**
```ts
// ✗ — N concurrent queries, still N round-trips
const results = await Promise.all(
  hotdeals.map(h => productRepo.findOne({ where: { pro_code: h.pro_code } }))
)

// ✓ — 1 query, group into Map for O(1) lookup
const units = await productRepo.find({ where: { pro_code: In(hotdeals.map(h => h.pro_code)) } })
const byCode = new Map(units.map(u => [u.pro_code, u]))
```
**Location:** src/hotdeal/hotdeal.service.ts (getAllHotdealsWithProductNames)
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-24
