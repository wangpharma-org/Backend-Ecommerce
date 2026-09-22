# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  `String(null)` returns `"null"` — comparing `=== 'null'` silently matches null DB values
**Why:** PR#139 — a cart-item deletion guard used `if (displayUnit === 'null')` to detect missing units. Because `String(null)` evaluates to the four-character string `"null"`, any row whose `spc_unit_enum` is NULL in the database silently passes the guard and the cart item is deleted with no warning. The same trap can occur in any `switch`/`if` branch that stringifies a value before comparing.
**Example:**
```ts
// ✗ trap: String(null) === 'null' is true
if (String(row.unit) === 'null') { /* fires on DB null too */ }

// ✓ check the original value directly
if (row.unit == null) { /* explicit null/undefined check */ }
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-03

### G-003  Duplicate TypeORM `.leftJoinAndSelect` alias on the same relation causes a runtime error
**Why:** PR#139 — `products.service.ts` had `.leftJoinAndSelect('product.units', 'units')` written twice in the same query builder chain. TypeORM throws when the same alias is declared more than once; this silently works in tests that hit a warm query cache but blows up on the first fresh query.
**Example:**
```ts
// ✗ duplicate alias — TypeORM throws
qb
  .leftJoinAndSelect('product.units', 'units')
  .leftJoinAndSelect('product.units', 'units') // duplicate!

// ✓ each alias appears once
qb
  .leftJoinAndSelect('product.units', 'units')
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-03

### G-004  Divergent `convertEnumToUnitName` fallback across services stores enum numbers as business data
**Why:** PR#139 — `products.service.ts` returns `''` when a unit enum is not found, while `promotion.service.ts` and `shopping-order.service.ts` return `String(unitEnum)` (e.g. `"1"`, `"2"`). When a product's units relation is not eagerly loaded, orders end up persisted with `spo_unit = "1"` instead of the actual unit name. All callers must agree on a single fallback (prefer `''` or throw — never silently store the raw enum number).
**Example:**
```ts
// ✗ inconsistent — two services, two different fallbacks
// products.service.ts
function convertEnumToUnitName(units, unitEnum) {
  return units.find(u => u.level === unitEnum)?.unit_name ?? '';  // fallback = ''
}
// shopping-order.service.ts
function convertEnumToUnitName(units, unitEnum) {
  return units.find(u => u.level === unitEnum)?.unit_name ?? String(unitEnum); // fallback = "1"
}

// ✓ one canonical implementation in products.service.ts, imported everywhere
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-03
