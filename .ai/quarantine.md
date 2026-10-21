# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Review tightly-coupled backend and frontend PRs together before approving either side
**Why:** PR#255 — reviewer (62theories) dismissed their own review and asked to wait for the paired frontend PR to be ready before re-reviewing the backend. A backend feature that cannot be tested or understood without its frontend counterpart should wait for both to land in the same review cycle.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#255 @62theories — github.com/wangpharma-org/Backend-Ecommerce/pull/255
**Added:** 2026-09-28  **Status:** quarantined (not team-agreed)
