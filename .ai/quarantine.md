# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Use TypeORM object-style `select` — `{ field: true }` — not array style `['field']`
**Why:** PR#176 (Sasit-Nine, minor): `select: ['pro_unit1', 'pro_unit2', ...]` in `findSmallestUnit`. Object style is the v0.3+ TypeORM API and produces better type inference.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-06-08  **Status:** quarantined (single occurrence)

### Q-003  Domain-specific endpoints belong in their own controller, not AppController
**Why:** PR#176 (Sasit-Nine, medium): `/ecom/check-happy-hour-reward` was added to `AppController`, pulling in a domain service dependency and blurring responsibility. Suggested home: `HappyHourController` or `ShoppingOrderController`.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-06-08  **Status:** quarantined (single occurrence)

### Q-004  PR description must include a Jira task link
**Why:** AI review (claude[bot]) on PR#154 repeatedly flagged the empty Jira link field in the PR template. Traceability between tickets and code helps review and future debugging.
**Promote to convention when:** a human reviewer flags the same point in ≥1 PR.
**Source:** PR#154 claude[bot] — github.com/wangpharma-org/Backend-Ecommerce/pull/154
**Added:** 2026-06-08  **Status:** quarantined (ai-review only — no human corroboration yet)
