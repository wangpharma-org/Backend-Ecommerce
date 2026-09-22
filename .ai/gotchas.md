# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Changing a TypeORM `@Column` definition in an Entity causes DROP + recreate (or silent schema divergence)
**Why:** PR#205 — reviewer blocked an entity edit with "ห้ามแก้ Entity เนื่องจาก Column จะโดน Drop ทิ้ง และสร้างใหม่". With `synchronize: true`, TypeORM drops the old column and recreates it, destroying data. With `synchronize: false` (our production setting) the change is silently ignored and the live schema diverges from the entity. Either way the result is broken — use a migration to alter column definitions.
**Example:**
```ts
// ✗ don't change column length directly in the entity and expect it to apply
@Column({ name: 'creditor_address', type: 'varchar', length: 100 })
creditor_address: string;
// Changing length to 500 in the entity file alone will NOT apply in prod

// ✓ write a migration instead
await queryRunner.query(`ALTER TABLE creditor MODIFY COLUMN creditor_address VARCHAR(500)`);
```
**Location:** src/products/creditor.entity.ts
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-07-20
