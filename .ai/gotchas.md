# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Fixing an N+1 query in one method does not fix sibling methods that load the same relationship
**Why:** PR#176 (Sasit-Nine, Medium): `enrichSlotWithProducts()` had its N+1 fixed with a batch IN query, but `simulate()` in the same service still used the per-item `findOne()` loop. The PR claimed N+1 was resolved but the fix was incomplete — only the most visible code path was updated.
**Example:**
```ts
// ✗ simulate() still N+1 even after enrichSlotWithProducts() was fixed
const products = await Promise.all(
  rewards.map(r => this.productRepo.findOne({ where: { pro_code: r.pro_code } }))
)
// ✓ extract a shared batch helper and apply it everywhere
const products = await this.batchFetchProductsByCodes(rewards.map(r => r.pro_code))
```
**Location:** src/happy-hour/happy-hour.service.ts — simulate() vs enrichSlotWithProducts()
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-06-08
