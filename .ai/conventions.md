# Conventions

How we do it here. Soft; read by humans and AI. No hard failure mode.

Format per entry: `### C-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### C-001  Validate and coerce numeric query params before use
**Why:** PR#148 — pagination `current_page` could arrive as "2a0 " (text + whitespace) and was used unvalidated. Numeric query/route params must be parsed and rejected/defaulted when not a clean number.
**Example:**
```ts
const page = Number(query.current_page)
if (!Number.isInteger(page) || page < 1) throw new BadRequestException('current_page')
```
**Source:** PR#148 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/148
**Added:** 2026-05-19  **Confidence:** medium (single occurrence)

### C-002  Always include migration files in the same PR as entity/schema changes
**Why:** PR#176 — new tables (`happy_hour_slot_reward`) and columns (`start_date`, `end_date`) were added to entities but no migration file was included in the diff. With `synchronize: false` in production this leaves the DB schema inconsistent until a migration is written and run separately. Reviewers flagged it as a must-fix before merge.
**Example:**
```
# When you add/change an entity column, generate and commit the migration in the same branch:
npm run migration:generate -- src/migrations/AddHappyHourSlotReward
git add src/migrations/
# then include it in the same PR as the entity change
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-06  **Confidence:** medium (single occurrence)
