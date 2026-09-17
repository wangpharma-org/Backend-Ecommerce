# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Use a Guard/Decorator for admin-only authorization rather than inline permission checks
**Why:** PR#154 — reviewer noted that repeated inline `if (req.user.permission !== true)` checks should be moved to a reusable Guard or Decorator. Suggested pattern: verify both `role === UserRole.Admin` AND `permission === true` in one place and apply via `@UseGuards()`, so each endpoint doesn't re-implement the check.
**Example:**
```ts
// ✗ inline — easy to forget on new endpoints
if (req.user.permission !== true) throw new ForbiddenException('...');

// ✓ dedicated Guard (when the pattern recurs across endpoints)
@UseGuards(JwtAuthGuard, AdminGuard)
@Put('admin/happy-hour/slots/:id')
updateSlot(...) { ... }
```
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#154 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/154#discussion_r3265220194
**Added:** 2026-05-25  **Status:** quarantined (not team-agreed)
