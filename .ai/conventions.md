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

### C-002  Include the migration file in the same PR as the entity or feature that requires it
**Why:** PR#176 — migration file was absent from the PR, leaving the DB schema change and the feature code in separate PRs. Splitting them makes the branch undeployable until both land and prevents reviewers from verifying the schema matches the entity.
**Example:**
```
feat/my-feature/
  ├── src/my-feature/my-feature.entity.ts      ← entity change
  └── src/migrations/1234567890-my-feature.ts  ← migration in the SAME PR
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-06-29  **Confidence:** medium (single occurrence)
