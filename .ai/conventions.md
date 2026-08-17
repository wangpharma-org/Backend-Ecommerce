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

### C-002  Document new environment variables in the PR description
**Why:** PR#229 — a Kafka broker connection was added but the PR description omitted the new env var it required. Reviewers must discover it from the diff. Listing new env vars in the PR description lets deployers update their configs before the deploy.
**Example:**
In the PR body, add a section:
```
## New Environment Variables
- `KAFKA_BROKER_SHOPPING_ORDER_URL` — broker address for shopping-order Kafka consumer
```
**Source:** PR#229 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/229
**Added:** 2026-08-17  **Confidence:** medium (single occurrence)
