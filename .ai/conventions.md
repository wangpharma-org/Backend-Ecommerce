# Conventions

How we do it here. Soft; read by humans and AI. No hard failure mode.

Format per entry: `### C-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### C-001  Validate and coerce numeric query params before use
**Why:** PR#148 — pagination `current_page` could arrive as "2a0 " (text + whitespace) and was used unvalidated. Numeric query/route params must be parsed and rejected/defaulted when not a clean number.
**Example:**
```ts
const page = Number(query.current_page)
if (!Number.isInteger(page) || page < 1) throw new BadRequestException('current_page')
```
**Source:** PR#148 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/148
**Added:** 2026-05-19  **Confidence:** medium (single occurrence)

### C-002  Avoid per-item async DB calls in loops; batch-fetch with `In([...ids])` and build a lookup map
**Why:** PR#139 — `getAllHotdealsWithProductNames()` called `transformProductWithUnits()` for each of two products per hotdeal inside a `Promise.all`. With 50 hotdeals that was 100+ sequential-per-item queries per request. The correct pattern — already used in `getRewardsByTier` in the same PR — is one `repo.find({ where: { pro_code: In([...codes]) } })` followed by grouping into a Map before the loop.
**Example:**
```ts
// ✗ N+1: 1 query per hotdeal item
const results = await Promise.all(
  hotdeals.map(async (hd) => {
    const u1 = await this.productService.transformProductWithUnits(hd.product);
    const u2 = await this.productService.transformProductWithUnits(hd.product2);
    return { ...hd, u1, u2 };
  })
);

// ✓ batch: 1 query for all, then map in memory
const codes = hotdeals.flatMap(hd => [hd.product.pro_code, hd.product2?.pro_code]).filter(Boolean);
const units = await this.productUnitRepo.find({ where: { pro_code: In(codes) } });
const unitMap = new Map<string, ProductUnitEntity[]>();
for (const u of units) {
  if (!unitMap.has(u.pro_code)) unitMap.set(u.pro_code, []);
  unitMap.get(u.pro_code)!.push(u);
}
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-03  **Confidence:** medium (single detailed reviewer callout)

### C-003  Centralise shared unit-conversion helpers (`convertEnumToUnitName`, `getRatioFromUnits`) to one service
**Why:** PR#139 — these two helpers were duplicated across at least four services (`products`, `promotion`, `shopping-order`, `hotdeal`). Duplication led to divergent fallback behaviour (see G-004) and will keep drifting. The canonical home is `ProductsService`; other services should inject it or import a shared utility module rather than copy the function.
**Example:**
```ts
// ✗ four copies, each with slightly different behaviour
// products.service.ts, promotion.service.ts, shopping-order.service.ts, hotdeal.service.ts
//   all define their own convertEnumToUnitName()

// ✓ one export from ProductsService (or a dedicated UnitUtils module)
// other services inject ProductsService and call this.productsService.convertEnumToUnitName(...)
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-03  **Confidence:** medium (single occurrence)
