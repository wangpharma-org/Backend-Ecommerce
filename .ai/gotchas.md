# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Importing `console` from `node:inspector` shadows the global console and silently fails in production
**Why:** PR#139 — `import { console } from 'node:inspector'` was found in `shopping-cart.service.ts`. The `node:inspector` module exports a `console` tied to the inspector protocol; it only works when the Node.js inspector is active. In normal production every `console.log/error` in the file silently does nothing.
**Example:**
```ts
// ✗ inspector-only — production calls silently do nothing
import { console } from 'node:inspector';

// ✓ remove the import; use NestJS Logger (see R-001)
private readonly logger = new Logger(ShoppingCartService.name);
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-06-22

### G-003  Comparing a nullable DB column to the string `'null'` causes silent data loss
**Why:** PR#139 — `displayUnit === 'null'` triggered a silent cart-item deletion when `spc_unit_enum` was `null` in the DB. `String(null)` produces `"null"`, so the string comparison matched and deleted the row without any warning.
**Example:**
```ts
// ✗ String(null) === 'null' is true → silent delete
if (displayUnit === 'null') { await this.shoppingCartRepo.delete({ spc_id: row.spc_id }); }

// ✓ check the actual null at source
if (row.spc_unit_enum === null) { /* log and skip */ }
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-06-22

### G-004  Duplicate TypeORM QueryBuilder join alias causes a runtime error
**Why:** PR#139 — two `.leftJoinAndSelect('product.units', 'units')` calls with the same alias appeared in `products.service.ts`. TypeORM throws when the same alias is registered twice on a query builder, crashing the request.
**Example:**
```ts
// ✗ alias 'units' registered twice → runtime error
qb.leftJoinAndSelect('product.units', 'units')
  .leftJoinAndSelect('product.units', 'units');

// ✓ deduplicate
qb.leftJoinAndSelect('product.units', 'units');
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-06-22

### G-005  Object-spreading a nested relation into its parent silently overrides shared keys
**Why:** PR#139 — `{ ...condition, ...condition.product, units }` in `getTierWithProCode` let `condition.product.id` and `condition.product.pro_code` overwrite the parent `condition`'s own keys, producing wrong data downstream.
**Example:**
```ts
// ✗ product.id overwrites condition.id
{ ...condition, ...condition.product, units }

// ✓ explicitly map only the fields needed
{ ...condition, productName: condition.product.name, units }
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-06-22

### G-006  Modifying a TypeORM entity column definition when synchronize is on DROPS the column
**Why:** PR#205 @Sasit-Nine flagged a PR that changed `creditor.entity.ts` field definitions inline. If `SYNCHRONIZE=true` is used (even temporarily in dev/staging sharing real data), TypeORM detects the schema diff, drops the existing column, and recreates it — destroying all data in that column. Always express schema changes as migrations; never rely on synchronize to apply entity edits.
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-06-22
