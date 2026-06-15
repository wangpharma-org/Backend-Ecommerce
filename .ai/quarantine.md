# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Put authorization checks in a Guard or Decorator, not inline in the controller body
**Why:** PR#154 — reviewer flagged manual `if (!req.user.permission && !isAdmin)` checks scattered in controller methods. This logic is hard to audit and easy to miss on new endpoints. Guards/Decorators are the NestJS-idiomatic pattern and are impossible to forget to add when using a Guard at the controller or method level.
**Example:**
```ts
// ✗ no — easy to omit on new methods, not auditable
if (req.user.role !== UserRole.Admin) throw new ForbiddenException();

// ✓ use a Guard / custom decorator
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
async myEndpoint() { ... }
```
**Promote to convention when:** seen flagged again in ≥1 more PR by a different reviewer.
**Source:** PR#154 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/154#discussion_r3265220194
**Added:** 2026-06-15  **Status:** quarantined (1 PR, 1 reviewer)

### Q-003  Avoid N+1 queries — batch-fetch related entities with `In()` then group into a Map
**Why:** PR#139 — `getAllHotdealsWithProductNames()` called `transformProductWithUnits()` per hotdeal (N×2 DB calls). Reviewer explicitly requested batch fetch with `In([...proCodes])` + grouping into a map, noting the existing `getRewardsByTier` already did this correctly. Same anti-pattern appeared in `getHotdealByProCode()` and `getHotdealInfo()`.
**Example:**
```ts
// ✗ no — N queries inside Promise.all still = N round trips
const results = await Promise.all(items.map(item =>
  this.productUnitRepo.findOne({ where: { pro_code: item.pro_code } })
));

// ✓ batch fetch once, group into Map
const codes = items.map(i => i.pro_code);
const units = await this.productUnitRepo.find({ where: { pro_code: In(codes) } });
const unitMap = new Map(units.map(u => [u.pro_code, u]));
const results = items.map(item => ({ ...item, unit: unitMap.get(item.pro_code) }));
```
**Promote to convention when:** seen flagged again in ≥1 more PR by a different reviewer.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139#pullrequestreview-4252458762
**Added:** 2026-06-15  **Status:** quarantined (1 PR, 1 reviewer)
