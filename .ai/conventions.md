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

### C-002  A PR that adds, removes, or renames schema elements must include the TypeORM migration file in the same PR
**Why:** PR#176 — added `happy_hour_slot_reward` table and new columns but shipped no migration file. With `SYNCHRONIZE=false` in production the schema change never lands, making the feature broken on deploy.
**Example:**
```bash
# After adding or changing an @Entity column, generate and commit the migration:
npm run migration:generate -- src/migrations/AddHappyHourSlotReward
# Then include src/migrations/<timestamp>-AddHappyHourSlotReward.ts in the same PR
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-20  **Confidence:** medium (single occurrence)
