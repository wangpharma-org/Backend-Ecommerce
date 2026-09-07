# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Document new environment variables in the PR description when adding them
**Why:** PR#229 — reviewer asked "เพิ่มใน PR Information ด้วยว่ามี env เพิ่ม" after the PR added a new Kafka broker env var without listing it. Single occurrence; process guidance not yet team-agreed.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#229 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/229
**Added:** 2026-09-07  **Status:** quarantined (not team-agreed)
