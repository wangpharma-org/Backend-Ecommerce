# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Store per-environment / configurable constants in env vars, not hardcoded in source
**Why:** PR#226 — `COM_FILE_HASH` was hardcoded directly in `app.controller.ts`. Reviewer asked to move it to `.env`. Single occurrence from one reviewer, but the principle (anything that may differ between environments belongs in env vars) is a common-sense hygiene rule. Promote to convention if seen again.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#226 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/226
**Added:** 2026-08-03  **Status:** quarantined (single occurrence)

### Q-003  List new environment variables in the PR description when a PR introduces them
**Why:** PR#229 — reviewer noted inline that the PR added a new env variable (Kafka Broker config) but the PR description did not mention it. Single occurrence from one reviewer; if adopted it would improve deployability review.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#229 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/229
**Added:** 2026-08-03  **Status:** quarantined (single occurrence)
