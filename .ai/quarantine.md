# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  Error messages must not contain debug suffixes (e.g. numbered tags like `'Cart22'`, `'Cart11'`)
**Why:** PR#139 — Multiple error messages had leftover debug identifiers: `'Error in Add product Cart22'`, `'Something wrong in checkedProductCart55'`. These appear in production logs and are confusing. Single occurrence from one reviewer — needs corroboration to become a convention.
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-08-24  **Status:** quarantined (preference, single occurrence)

### Q-003  Wrap multi-step entity mutations (create parent → create children) in a database transaction
**Why:** AI reviewers on PR#156 (×3) flagged that `duplicatePromotion()` — which saves Promotion → Tiers → Conditions → Rewards sequentially — can leave orphan records in DB if any intermediate step throws. Flagged consistently by automated review but **no human reviewer has corroborated this yet**.
**Promote to convention when:** corroborated by a human reviewer in any PR, or same pattern flagged in ≥2 more PRs.
**Source:** PR#156 @claude[bot] (ai-review ×3) — github.com/wangpharma-org/Backend-Ecommerce/pull/156
**Added:** 2026-08-24  **Origin:** ai-review  **Status:** quarantined (ai-review only, no human corroboration)

### Q-004  Controller endpoints must use typed DTO classes with class-validator decorators, not inline TypeScript types on `@Body()`
**Why:** AI reviewers on PR#156 (×3) flagged `@Body() data: { promo_id: number; start_date: Date }` — at runtime `class-validator` cannot enforce types from inline type annotations; invalid payloads reach the service unvalidated. No human reviewer has corroborated this yet.
**Example:**
```ts
// ✗ — inline type, no runtime validation
@Post('duplicate') async duplicate(@Body() data: { promo_id: number; start_date: Date }) {}

// ✓ — DTO with decorators (once team agrees)
export class DuplicatePromotionDto {
  @IsInt() @IsPositive() promo_id: number
  @Type(() => Date) @IsDate() start_date: Date
}
```
**Promote to convention when:** corroborated by a human reviewer in any PR, or same pattern flagged in ≥2 more PRs.
**Source:** PR#156 @claude[bot] (ai-review ×3) — github.com/wangpharma-org/Backend-Ecommerce/pull/156
**Added:** 2026-08-24  **Origin:** ai-review  **Status:** quarantined (ai-review only, no human corroboration)
