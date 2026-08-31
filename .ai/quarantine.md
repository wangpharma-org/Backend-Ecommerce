# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Hardcoded validation constants (hashes, tokens) belong in environment variables, not source code
**Why:** PR#226 — reviewer commented "เก็บค่า COM_FILE_HASH ใน env" when a file-validation hash was added directly as a constant in `src/app.controller.ts`. Hardcoding makes value rotation impossible without a redeploy and embeds the value permanently in source history.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#226 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/226
**Added:** 2026-08-31  **Status:** quarantined (not team-agreed)
