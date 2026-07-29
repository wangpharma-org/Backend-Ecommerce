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

### R-003  Every non-public endpoint must be decorated with @UseGuards; omitting it exposes it to unauthenticated callers
**Why:** PR#176 — `/ecom/check-happy-hour-reward` had no `@UseGuards`, so anyone could POST arbitrary `sh_running` IDs and manipulate order freebies without logging in. Missing guards compile and run silently, making them easy to miss until a security review.
**Example:**
```ts
// ✗ no guard — unauthenticated callers can reach this
@Post('check-happy-hour-reward')
async checkReward(@Body() dto: CheckRewardDto) { ... }

// ✓ guard every endpoint that touches user or order data
@UseGuards(JwtAuthGuard)
@Post('check-happy-hour-reward')
async checkReward(@Body() dto: CheckRewardDto) { ... }
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-06-29  **Enforce:** security checklist in PR template
