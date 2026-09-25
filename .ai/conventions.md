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

### C-002  Centralise shared unit-conversion helpers; do not duplicate them across services
**Why:** PR#139 — `convertEnumToUnitName` and `getRatioFromUnits` were copied into at least 4 services (`products`, `promotion`, `shopping-cart`, `shopping-order`). Divergent copies led to inconsistent fallback behaviour and a data-corruption bug (see G-005). Shared logic belongs in `products.service.ts` (or a dedicated `units` helper); all other services import from there.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-10  **Confidence:** medium (single occurrence)

### C-003  Store per-environment config values in environment variables, not as hardcoded constants
**Why:** PR#226 — `COM_FILE_HASH` was hardcoded as a constant in `app.controller.ts`. Reviewer flagged it should live in env (`เก็บค่า COM_FILE_HASH ใน env`). Values that differ between environments (checksums, hashes, feature toggles, service URLs) must come from `process.env` so they can be changed without a code deploy.
**Example:**
```ts
// ✗ no
const COM_FILE_HASH = 'abc123deadbeef';

// ✓
const comFileHash = process.env.COM_FILE_HASH;
```
**Source:** PR#226 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/226
**Added:** 2026-08-10  **Confidence:** medium (single occurrence)
