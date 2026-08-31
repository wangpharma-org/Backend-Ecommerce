# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Modifying a TypeORM entity column definition drops and recreates the column — use a raw migration instead
**Why:** PR#205 — reviewer flagged a direct entity column change saying "ห้ามแก้ Entity เนื่องจาก Collumn จะโดน Drop ทิ้ง และสร้างใหม่". When TypeORM generates a migration from an entity column change (e.g. rename, type change), it emits DROP + ADD rather than ALTER COLUMN, silently destroying all existing data in that column. Write a manual `ALTER TABLE … MODIFY COLUMN` migration instead of editing the entity definition and regenerating.
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-08-31
