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

### C-002  PR description must explicitly state whether new environment variables are added in this change
**Why:** PR#229 — reviewer found the PR introduced new env vars but the PR description made no mention of them: "เพิ่มใน PR Information ด้วยว่ามี env เพิ่ม". Deployers who miss this skip adding the var and get a silent runtime failure.
**Example:**
```
## Environment Variables
- `KAFKA_BROKER_URL` (new) — Kafka broker URL for shopping-order notifications
```
If there are no new env vars, write: `ไม่มี env ใหม่`
**Source:** PR#229 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/229
**Added:** 2026-09-21  **Confidence:** medium (single occurrence)
