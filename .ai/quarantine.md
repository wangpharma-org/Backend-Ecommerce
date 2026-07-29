# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Permission checks should use a dedicated Guard or Decorator, not inline if-blocks
**Why:** PR#154 — reviewer suggested replacing `if (!req.user.permission && req.user.role !== UserRole.Admin)` checks with a reusable Guard or Decorator for consistency. Single reviewer/single PR so far; quarantined until it recurs.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Example:**
```ts
// ✗ inline permission check
if (!req.user.permission && req.user.role !== UserRole.Admin) {
  throw new ForbiddenException('You do not have permission to perform this action')
}

// ✓ encapsulate in a guard
@UseGuards(PermissionGuard)
```
**Source:** PR#154 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/154
**Added:** 2026-06-29  **Status:** quarantined (not team-agreed)
