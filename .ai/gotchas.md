# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Never import `console` from `node:inspector` — it silences all console output in production
**Why:** PR#139 — `shopping-cart.service.ts` had `import { console } from 'node:inspector'`. Node's inspector `console` only works while the inspector is active; in production the import succeeds but every `console.log/error` call becomes a no-op. Use the NestJS `Logger` (see R-001) and never touch `node:inspector` in service code.
**Example:**
```ts
// ✗ breaks silently in production
import { console } from 'node:inspector';

// ✓ inject NestJS Logger
private readonly logger = new Logger(ShoppingCartService.name);
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-07-27

### G-003  Unit-enum conversion helpers must be consistent; divergent fallbacks silently corrupt persisted data
**Why:** PR#139 — `convertEnumToUnitName` had different fallback returns across services: `products.service.ts` returned `''` on no-match, while `promotion.service.ts` and `shopping-order.service.ts` returned `String(unitEnum)` (= `'1'`/`'2'`/`'3'`). Orders saved through the latter store `spo_unit = "1"` (the raw enum) instead of a real unit name, breaking downstream display and price calculations. Fix: one canonical implementation in a shared service (see C-003), or ensure all copies return the same sentinel.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-07-27
