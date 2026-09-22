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

### R-003  Use `@UseGuards` on every route handler; encapsulate role/permission checks in Guards or Decorators
**Why:** PR#176 flagged a `/ecom/check-happy-hour-reward` endpoint with no `@UseGuards` — any unauthenticated caller could trigger reward mutation. PR#154 flagged an inline `if (!hasPermission && !isAdmin)` check inside a controller method; reviewer asked to move it to a Guard/Decorator so the pattern is reusable and consistent.
**Example:**
```ts
// ✗ no — no guard at all
@Post('/ecom/check-happy-hour-reward')
async checkHappyHourReward(...) { ... }

// ✗ no — inline role check in controller body
async someAdminAction(@Req() req) {
  if (req.user.role !== UserRole.Admin) throw new ForbiddenException();
}

// ✓ guard on every handler; role via decorator
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Post('/ecom/check-happy-hour-reward')
async checkHappyHourReward(...) { ... }
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176 ; PR#154 @MossOcelot — /pull/154
**Added:** 2026-07-20  **Enforce:** code-review checklist; consider ESLint custom rule
