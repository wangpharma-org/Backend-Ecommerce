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

### C-002  Batch-fetch related entities with `In([...ids])` + group into a map; never use per-item DB calls in a loop
**Why:** PR#139 — `getAllHotdealsWithProductNames()` called `transformProductWithUnits()` per hotdeal, producing 100+ DB queries for 50 hotdeals. The same PR already contained a correct batch pattern in `getRewardsByTier` using `In([...proCodes])` — reviewer praised that approach and flagged the loop as N+1.
**Example:**
```ts
// ✗ N+1 — one DB roundtrip per item
const results = await Promise.all(items.map(i => productUnitRepo.findOne({ where: { pro_code: i.pro_code } })));

// ✓ batch + map
const units = await productUnitRepo.find({ where: { pro_code: In(items.map(i => i.pro_code)) } });
const unitsByCode = new Map(units.map(u => [u.pro_code, u]));
```
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-06-22  **Confidence:** high

### C-003  Use allow-list logic for admin authorization; extract repeated checks to a shared Guard
**Why:** PR#154 @MossOcelot flagged deny-list logic (`permission === false && role !== 'admin'`) that passes through users with `permission === undefined`. Allow-list logic rejects all undeclared states by default. Extracting the check to a Guard/Decorator prevents duplication across controllers.
**Example:**
```ts
// ✗ deny-list — undefined permission slips through
if (req.user.permission === false && req.user.role !== 'admin') throw new ForbiddenException();

// ✓ allow-list — only explicit grant passes
const isAdmin = req.user.role === UserRole.Admin;
const hasPermission = req.user.permission === true;
if (!hasPermission && !isAdmin) throw new ForbiddenException('You do not have permission to perform this action');
```
**Source:** PR#154 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/154
**Added:** 2026-06-22  **Confidence:** medium (single PR)
