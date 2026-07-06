# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Use object-style `select` in TypeORM queries (`{ field: true }`) rather than array-style (`['field']`)
**Why:** PR#176 — `findSmallestUnit` used `select: ['pro_unit1', 'pro_unit2', ...]`. Reviewer noted the object style is preferred in TypeORM v0.3+. Single reviewer, single PR — not yet team-agreed.
**Example:**
```ts
// array style (works but older pattern)
select: ['pro_unit1', 'pro_unit2', 'pro_unit3']

// object style (preferred in TypeORM v0.3+)
select: { pro_unit1: true, pro_unit2: true, pro_unit3: true }
```
**Promote to convention when:** seen flagged in ≥1 more PR by another reviewer.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-06  **Status:** quarantined (not team-agreed)

### Q-003  Service-specific endpoints belong in their domain controller, not in AppController
**Why:** PR#176 — `/ecom/check-happy-hour-reward` was added to `AppController` alongside `HappyHourService`. Reviewer suggested it belongs in `HappyHourController` or `ShoppingOrderController` to avoid coupling AppController to domain services. Single reviewer, single PR.
**Promote to convention when:** seen flagged again or adopted as a project-wide structural decision.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-06  **Status:** quarantined (not team-agreed)
