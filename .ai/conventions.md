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

### C-002  Business logic shared across multiple domain services must live in a single service and be injected, not copy-pasted
**Why:** PR#139 — `convertEnumToUnitName` and `getRatioFromUnits` existed independently in 4 services. Each copy drifted (different fallback values), causing data inconsistency across hotdeal, promotion, shopping-cart, and shopping-order. Reviewer recommended extracting both into `products.service.ts` and injecting via NestJS DI.
**Example:**
```ts
// ✗ no — duplicated function in 4 services, each with a different fallback
function convertEnumToUnitName(units, unitEnum) { return units.find(...) ?? '' }

// ✓ extract to ProductsService, inject where needed
@Injectable()
export class ProductsService {
  convertEnumToUnitName(units: ProductUnitEntity[], unitEnum: number): string { ... }
}
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-07-13  **Confidence:** medium (single occurrence)

### C-003  Feature-domain endpoints must live in their feature controller, not in `AppController`
**Why:** PR#176 — `check-happy-hour-reward` was placed in `AppController`, forcing it to import `HappyHourService`. This breaks NestJS module boundaries and turns `AppController` into a catch-all. The endpoint belongs in `HappyHourController` or `ShoppingOrderController`.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-13  **Confidence:** medium (single occurrence)
