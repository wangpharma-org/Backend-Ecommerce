# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Never modify an existing Entity column definition in-place; always create a TypeORM migration for column changes
**Why:** PR#205 — reviewer warned "ห้ามแก้ Entity เนื่องจาก Column จะโดน Drop ทิ้ง และสร้างใหม่" (Don't modify Entity because the Column will be dropped and recreated). TypeORM's `synchronize` — even in a dev environment — will silently DROP the column and recreate it when its definition changes (type, length, nullable), destroying all existing data in that column.
**Example:**
```ts
// ✗ no — changing the column type in the entity directly
@Column({ type: 'text' })  // was varchar(255), now text
creditor_address: string

// ✓ create a migration instead
// npm run migration:generate -- src/migrations/AlterCreditorAddressToText
```
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-09-14
