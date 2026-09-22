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

### C-002  Shared utility logic (unit conversion, ratio calculation) must live in one canonical service, never duplicated
**Why:** PR#139 — `convertEnumToUnitName` and `getRatioFromUnits` were copy-pasted across 4 services (products, hotdeal, promotion, shopping-order). When one copy was updated the others diverged, directly causing the bug described in G-003.
**Example:**
```ts
// ✗ duplicate in shopping-order.service.ts
function convertEnumToUnitName(units, e) { … }

// ✓ inject ProductsService and call its canonical method
constructor(private readonly productsService: ProductsService) {}
const name = this.productsService.convertEnumToUnitName(units, e)
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-09-07  **Confidence:** high

### C-003  Store runtime configuration constants in env vars — never hardcode them in source
**Why:** PR#226 — `COM_FILE_HASH` was hardcoded in `app.controller.ts`. Reviewer asked to "เก็บค่า COM_FILE_HASH ใน env" so the value is configurable per environment without a code change.
**Example:**
```ts
// ✗ hardcoded
const COM_FILE_HASH = 'abc123def456'

// ✓ inject via ConfigService
const hash = this.configService.get<string>('COM_FILE_HASH')
```
**Source:** PR#226 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/226
**Added:** 2026-09-07  **Confidence:** medium (single occurrence)
