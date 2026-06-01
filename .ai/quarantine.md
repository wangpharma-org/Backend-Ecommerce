# Quarantine

Individual reviewer preferences, NOT team-agreed. Promote to a convention once it recurs across PRs/reviewers.

Format per entry: `### Q-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### Q-001  Avoid stringly-typed return values
**Why:** PR#123 — reviewer questioned a method returning a string ("ทำไม return เป็น string"). Possibly a real convention (return typed objects/enums), but only one reviewer / one PR so far.
**Promote to convention when:** seen again in ≥1 more PR by another reviewer.
**Source:** PR#123 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/123
**Added:** 2026-05-19  **Status:** quarantined (not team-agreed)

### Q-002  TypeORM `softDelete()` does not cascade through relations
**Why:** PR#156 — when the cron job called `promotionRepo.softDelete({ promo_id })`, the child `PromotionTierEntity` rows kept `deleted_at = null`, becoming orphaned active records. TypeORM `onDelete: 'CASCADE'` only fires for hard deletes at the SQL level; soft-deleted parents must explicitly soft-delete their children.
**Example:**
```ts
// ✗ only parent gets deleted_at set
await this.promotionRepo.softDelete({ promo_id: p.promo_id });

// ✓ cascade manually
await this.promotionTierRepo.softDelete({ promotion: { promo_id: p.promo_id } });
await this.promotionRepo.softDelete({ promo_id: p.promo_id });
```
**Promote to gotcha when:** a human reviewer confirms this TypeORM behaviour in a PR.
**Source:** PR#156 claude[bot] — github.com/wangpharma-org/Backend-Ecommerce/pull/156
**Added:** 2026-06-01  **Status:** quarantined (ai-review only, no human corroboration yet)  **Origin:** ai-review

### Q-003  Multi-entity write sequences must be wrapped in `dataSource.transaction()`
**Why:** PR#156 — `duplicatePromotion()` saved Promotion → Tiers → Conditions → Rewards without a transaction. A failure mid-way left a partial promotion in the DB with missing tiers, requiring manual cleanup.
**Example:**
```ts
return this.dataSource.transaction(async (manager) => {
  const saved = await manager.save(manager.create(PromotionEntity, { ... }));
  await Promise.all(tiers.map((t) => manager.save(manager.create(PromotionTierEntity, { ...t, promotion: saved }))));
});
```
**Promote to convention when:** a human reviewer flags a missing transaction on a multi-entity write.
**Source:** PR#156 claude[bot] — github.com/wangpharma-org/Backend-Ecommerce/pull/156
**Added:** 2026-06-01  **Status:** quarantined (ai-review only)  **Origin:** ai-review

### Q-004  `catch {}` or `catch(e) { throw new Error('...') }` silently discards the original stack trace
**Why:** PR#156, PR#139 — bare catch blocks throw a new generic error without logging the original, making production debugging very difficult. Use `this.logger.error(message, err)` before rethrowing as an HTTP exception.
**Example:**
```ts
// ✗ destroys stack trace
} catch {
  throw new Error('Failed to get promotions');
}

// ✓ preserve context
} catch (err) {
  this.logger.error('Failed to get promotions', err);
  throw new InternalServerErrorException('Failed to get promotions');
}
```
**Promote to convention when:** a human reviewer flags bare catch blocks.
**Source:** PR#156 claude[bot]; PR#139 claude[bot] — github.com/wangpharma-org/Backend-Ecommerce/pull/156 , /pull/139
**Added:** 2026-06-01  **Status:** quarantined (ai-review only, 2 PRs)  **Origin:** ai-review

### Q-005  Shared utility functions should live in one service and be exported, not duplicated across services
**Why:** PR#139 — `convertEnumToUnitName` and `getRatioFromUnits` were duplicated across 4 services (products, promotion, shopping-cart, shopping-order). Each copy drifted independently, causing different fallback behaviours (one returned `''`, others returned `String(unitEnum)`).
**Promote to convention when:** seen in ≥1 more PR by another reviewer.
**Source:** PR#139 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/139
**Added:** 2026-06-01  **Status:** quarantined (single reviewer)  **Origin:** human
