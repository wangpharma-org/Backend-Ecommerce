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

### C-002  Batch-fetch related entities with `In([...ids])` instead of per-item DB calls inside loops
**Why:** PR#139 — `getAllHotdealsWithProductNames()` called `transformProductWithUnits()` once per hotdeal, each triggering 2 extra queries, yielding 100+ queries for 50 hotdeals. The same pattern appeared in `getHotdealByProCode()` and `getHotdealInfo()`. Batch fetch related records with `In([...proCodes])` before the loop, group into a `Map`, then iterate — the same approach already used correctly in `getRewardsByTier`.
**Example:**
```ts
// ✗ N+1
const results = await Promise.all(items.map(item =>
  this.productUnitRepo.find({ where: { pro_code: item.pro_code } })
));

// ✓ batch
const units = await this.productUnitRepo.find({ where: { pro_code: In(items.map(i => i.pro_code)) } });
const unitMap = new Map(units.map(u => [u.pro_code, u]));
items.forEach(item => { const unit = unitMap.get(item.pro_code); ... });
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-07-27  **Confidence:** medium (single PR, multiple callsites)

### C-003  Extract cross-service helpers to a shared service or util; never copy-paste business logic across services
**Why:** PR#139 — `convertEnumToUnitName` and `getRatioFromUnits` appeared in 4 separate services with divergent implementations (see G-003). Shared logic belongs in one place (e.g., exported from `ProductsService` and injected) so it can be maintained and tested once.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-07-27  **Confidence:** medium (single PR)

### C-004  Store environment-specific constants in env vars, not as hardcoded TypeScript values
**Why:** PR#226 — `COM_FILE_HASH` was added as a source-code constant; reviewer required it to be read from env. Values that differ between environments (file hashes, API tokens, endpoint identifiers) must live in `.env` / secrets so they can be rotated or changed per environment without a code deploy.
**Example:**
```ts
// ✗
export const COM_FILE_HASH = 'abc123def456';

// ✓
const comFileHash = this.configService.get<string>('COM_FILE_HASH');
```
**Source:** PR#226 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/226
**Added:** 2026-07-27  **Confidence:** medium (single occurrence)

### C-005  PR description must list every new environment variable introduced by the change
**Why:** PR#229 — a new Kafka broker env var was added without being documented in the PR description; reviewer requested it be added. Ops/infra relies on PR descriptions to know what must be configured in each environment before deploying. Add a "New env vars" section to the PR body whenever the diff touches `.env.example` or adds a new `configService.get()` call.
**Source:** PR#229 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/229
**Added:** 2026-07-27  **Confidence:** medium (single occurrence)
