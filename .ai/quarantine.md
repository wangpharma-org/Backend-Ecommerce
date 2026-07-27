# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Prefer NestJS Guard / Decorator for role-based auth checks over inline if-blocks in controllers
**Why:** PR#154 — a controller method had inline `if (role !== UserRole.Admin && !hasPermission)` logic. Reviewer suggested moving it to a Guard or Decorator "if this pattern continues." Single occurrence and conditionally framed — not yet team-agreed.
**Example:**
```ts
// preference: move inline checks to a reusable Guard
@UseGuards(RolesGuard)
@Roles(UserRole.Admin)
async sensitiveEndpoint() { ... }
```
**Promote to convention when:** seen again in ≥1 more PR or reviewer consensus.
**Source:** PR#154 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/154
**Added:** 2026-07-27  **Status:** quarantined (preference, not team-agreed)
