# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  `String(null)` coerces to the literal string `"null"` — comparisons against `'null'` silently trigger on DB-null values
**Why:** PR#139 — `shopping-cart.service.ts` converted a nullable `spc_unit_enum` column with `String()` then checked `displayUnit === 'null'`, which deleted cart items whenever the column was NULL in the DB. Any pattern that stringifies a nullable field before a string comparison will silently match real nulls.
**Example:**
```ts
// ✗ no
const displayUnit = String(row.spc_unit_enum); // null → "null"
if (displayUnit === 'null') await repo.delete(row.spc_id); // fires on DB null!

// ✓ check the original nullable value first
if (row.spc_unit_enum == null) { /* handle null */ }
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-10

### G-003  TypeORM query builder crashes at runtime on duplicate `.leftJoinAndSelect` alias
**Why:** PR#139 — `products.service.ts` called `.leftJoinAndSelect('product.units', 'units')` twice on the same query builder. TypeORM silently accepts the duplicate during build but throws at query execution time.
**Example:**
```ts
// ✗ no — second call with same alias 'units' causes a runtime error
qb.leftJoinAndSelect('product.units', 'units')
  .leftJoinAndSelect('product.units', 'units')

// ✓ join once
qb.leftJoinAndSelect('product.units', 'units')
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-10

### G-004  `import { console } from 'node:inspector'` makes all `console.*` calls silent in production
**Why:** PR#139 — a stray import brought in the inspector's `console` object, which only activates when Node's debugger is attached. In production the import silently replaced the global console, making every `console.log/error` in the service a no-op. Use the NestJS `Logger` (see R-001); if you must use the global console, do not import it.
**Example:**
```ts
// ✗ no — inspector console is a no-op outside debugger sessions
import { console } from 'node:inspector';

// ✓ inject NestJS Logger instead
private readonly logger = new Logger(MyService.name);
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-10

### G-005  Inconsistent `convertEnumToUnitName` fallback writes raw enum integers into saved order data
**Why:** PR#139 — `products.service.ts` returned `''` when no unit mapping was found while `promotion.service.ts` and `shopping-order.service.ts` returned `String(unitEnum)` (yielding `"1"`, `"2"`, `"3"`). Orders saved through the latter path stored numeric strings as unit names. The fallback must be consistent: either always `''` or always the real name — and all callers must handle the empty-string case before persisting.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-10
