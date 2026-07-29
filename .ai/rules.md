# Rules / Policy

Hard must/must-not. Violations are bugs; promote each to a lint/CI check.

Format per entry: `### R-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### R-001  Never use console.log in committed code; use the NestJS Logger
**Why:** Reviewers repeatedly flagged stray console output ("มี console.log จ้า", "this.logger.error ดีกว่านะ"). console.* bypasses log levels/formatting and leaks into production output.
**Example:**
```ts
// ✗ no
console.log(result)
// ✓ inject and use Logger
private readonly logger = new Logger(ProductsService.name)
this.logger.error('failed to fetch products', err)
```
**Source:** PR#121 @MossOcelot, PR#137 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/121 , /pull/137
**Added:** 2026-05-19  **Enforce:** lint (ESLint `no-console: error`)

### R-002  ใช้ ADF format เสมอเมื่อสร้างหรือแก้ไข Jira issue description
**Why:** การส่ง description เป็น markdown string ที่มี `\n` escape ใน JSON parameter ทำให้ Jira render เป็น literal `\n\n` text แทนที่จะเป็น newline จริง (พบใน ECWC-283, ECWC-284)
**Example:**
```ts
// ✗ no — markdown string, \n จะเป็น literal
{ description: "## หัวข้อ\n\nเนื้อหา", contentFormat: "markdown" }

// ✓ ใช้ ADF JSON object เสมอ
{
  description: { version: 1, type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "หัวข้อ" }] },
    { type: "paragraph", content: [{ type: "text", text: "เนื้อหา" }] }
  ]},
  contentFormat: "adf"
}
```
**Source:** ECWC-282 session 2026-05-30
**Added:** 2026-05-30

### R-003  Every controller endpoint that is not explicitly public must be protected with `@UseGuards(JwtAuthGuard)`
**Why:** PR#176 (Sasit-Nine, Critical): `/ecom/check-happy-hour-reward` had no auth guard — any unauthenticated caller could POST an order ID and manipulate reward counts. PR#154 (MossOcelot): inline role checks inside controller actions should move to guards/decorators so the control point is consistent and visible.
**Example:**
```ts
// ✗ no — endpoint is accessible without authentication
@Post('/ecom/check-happy-hour-reward')
async checkHappyHourReward(@Body() body: { sh_running: string }) { ... }

// ✓ protect every non-public endpoint
@UseGuards(JwtAuthGuard)
@Post('/ecom/check-happy-hour-reward')
async checkHappyHourReward(@Body() body: { sh_running: string }) { ... }
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176 ; PR#154 @MossOcelot — /pull/154
**Added:** 2026-06-08  **Enforce:** PR review checklist; consider custom guard-presence lint rule

### R-004  Every PR that adds or changes database tables/columns must include a TypeORM migration file in the same diff
**Why:** PR#176 (Sasit-Nine, Medium/blocker): `happy_hour_slot_reward` table and `start_date`/`end_date` columns were added but no migration was included. With `synchronize: false` in production this silently breaks the deploy.
**Example:**
```ts
// ✗ no — entity updated, migration absent from PR
// ✓ always generate and commit before opening the PR:
// npm run migration:generate -- src/migrations/AddHappyHourSlotReward
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-06-08  **Enforce:** PR review checklist (reviewer verifies migration is in diff)
