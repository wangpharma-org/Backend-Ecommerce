# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Prefer object-style `select` in TypeORM queries
**Why:** PR#176 — `findSmallestUnit` used `select: ['pro_unit1', 'pro_unit2', ...]` (array style). Reviewer flagged it should be `select: { pro_unit1: true, pro_unit2: true, ... }` (object style), which is the TypeORM v0.3+ recommended form and gives better type inference.
**Example:**
```ts
// ✗ array style
select: ['pro_unit1', 'pro_unit2', 'pro_unit3']
// ✓ object style
select: { pro_unit1: true, pro_unit2: true, pro_unit3: true }
```
**Promote to convention when:** flagged in ≥1 more PR by another reviewer.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-20  **Status:** quarantined (single reviewer)

### Q-003  Domain-specific endpoints belong in their feature module's controller, not AppController
**Why:** PR#176 — `check-happy-hour-reward` was added to `AppController`, giving it an unrelated dependency on `HappyHourService`. Reviewer suggested moving it to `HappyHourController` or `ShoppingOrderController`.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-20  **Status:** quarantined (single reviewer)

### Q-004  Store configuration constants (checksums, salts, hashes) in environment variables, not hardcoded in source
**Why:** PR#226 — `COM_FILE_HASH` was hardcoded in `app.controller.ts`; reviewer commented "เก็บค่า COM_FILE_HASH ใน env". Hardcoded constants make rotation difficult and widen the blast radius of source leaks.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#226 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/226
**Added:** 2026-07-20  **Status:** quarantined (single reviewer)

### Q-005  Before adding a Kafka event listener or handler function, verify no listener for that topic already exists
**Why:** PR#205 — PR added a new listener and handler for `product_update_from_easyacc`; reviewer pointed out both already existed. Duplicate listeners can cause double-processing or silent conflicts.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#205 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/205
**Added:** 2026-07-20  **Status:** quarantined (single reviewer)
