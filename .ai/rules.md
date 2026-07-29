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

### R-003  All data-mutating or user-scoped endpoints must declare `@UseGuards(JwtAuthGuard)`
**Why:** PR#176 — endpoint `/ecom/check-happy-hour-reward` (POST) had no guard, allowing anyone to alter reward quantities in an order without authenticating. Omitting the guard is a security bug.
**Example:**
```ts
// ✗ no — unprotected mutation
@Post('/ecom/check-happy-hour-reward')
async checkHappyHourReward(@Body() body: { sh_running: string }) { ... }

// ✓ guard every mutation / user-scoped read
@UseGuards(JwtAuthGuard)
@Post('/ecom/check-happy-hour-reward')
async checkHappyHourReward(@Body() body: { sh_running: string }) { ... }
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-13  **Enforce:** PR review checklist

### R-004  When a PR adds or changes database tables/columns, the migration file must be committed in the same PR
**Why:** PR#176 — a new table and two columns were added in entity files but no migration was included. With `synchronize: false` in production, the schema change never reaches prod until a migration runs; a PR without one ships a schema drift silently.
**Example:**
```bash
# ✗ no — entity changed, no migration in PR
# ✓ always pair entity changes with a generated migration:
npm run migration:generate -- src/migrations/<DescriptiveName>
# commit both the entity file and the migration file in the same PR
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-07-13  **Enforce:** PR review checklist
