# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Never modify an existing Entity column definition without a corresponding migration — TypeORM sync will DROP the column and recreate it
**Why:** PR#205 — a PR modified `creditor.entity.ts` column definitions directly. Reviewer flagged: "ห้ามแก้ Entity เนื่องจาก Column จะโดน Drop ทิ้ง และสร้างใหม่". Even with `synchronize: false` in production, any dev/staging environment with synchronize enabled will silently drop the column and recreate it, destroying data. Always write a migration instead of touching column decorators on existing columns.
**Example:**
```ts
// ✗ no — changing @Column() options on an existing column without a migration
@Column({ type: 'varchar', length: 500 })  // was length: 255
creditor_address: string;

// ✓ keep the entity matching the DB and write a migration:
// npm run migration:generate -- src/migrations/AlterCreditorAddressLength
```
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-07-06  **Confidence:** high

### G-003  Fixing an N+1 query in one method does not fix it everywhere — audit all methods in the same service for the same pattern
**Why:** PR#176 — the PR description claimed to fix N+1 queries, and `enrichSlotWithProducts()` was indeed fixed (batch IN query). But `simulate()` in the same file still had `Promise.all(slot.rewards.map(async (r) => this.productRepo.findOne(...)))` — one query per reward. Reviewers catch the missed instance during review; it should be found before PR is opened.
**Example:**
```ts
// ✗ still N+1 — one findOne per reward inside Promise.all
const products = await Promise.all(
  rewards.map(r => this.productRepo.findOne({ where: { pro_code: r.pro_code } }))
);

// ✓ batch fetch all at once
const codes = rewards.map(r => r.pro_code);
const products = await this.productRepo.find({ where: { pro_code: In(codes) } });
```
**Location:** src/happy-hour/happy-hour.service.ts — `simulate()` method
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-06  **Confidence:** medium (single occurrence)
