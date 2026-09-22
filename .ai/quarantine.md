# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Feature endpoints should live in their own feature controller, not in AppController
**Why:** PR#176 — reviewer noted that `happyHourService` was injected directly into `AppController` to add a new `/ecom/check-happy-hour-reward` endpoint, making AppController grow indefinitely. "ควรอยู่ใน `HappyHourController` หรือ `ShoppingOrderController` แทน"
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-09-21  **Status:** quarantined (single reviewer / one PR)

### Q-003  Wrap multi-step DB saves (create parent → create children) in `dataSource.transaction()`
**Why:** AI-review on PR#156 (origin: ai-review) — `duplicatePromotion()` saved promotion then tiers then conditions sequentially without a transaction; a failure mid-way leaves orphan rows. No human reviewer corroborated this yet.
**Promote to convention when:** a human reviewer raises the same point on a different PR.
**Source:** PR#156 @claude[bot] (ai-review) — github.com/wangpharma-org/Backend-Ecommerce/pull/156
**Added:** 2026-09-21  **Status:** quarantined (ai-review origin only; cannot be promoted past convention without human corroboration)
