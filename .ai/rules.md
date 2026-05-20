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
