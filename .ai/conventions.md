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

### C-002  Business-domain endpoints belong in their feature controller, not AppController
**Why:** PR#176 — `checkHappyHourReward` was added to `AppController`, giving it an unnecessary `HappyHourService` dependency and breaking controller cohesion. Feature endpoints should live in the controller for that domain (`HappyHourController`, `ShoppingOrderController`, etc.).
**Example:**
```ts
// ✗ no — adding domain logic to AppController
@Controller()
export class AppController {
  constructor(private readonly happyHourService: HappyHourService) {}
  @Post('/ecom/check-happy-hour-reward') async checkHappyHourReward(...) { ... }
}

// ✓ place it in the owning domain controller
@Controller('happy-hour')
export class HappyHourController {
  @Post('check-reward') async checkReward(...) { ... }
}
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-08-24  **Confidence:** medium (single occurrence)

### C-003  Use TypeORM object-style `select: { field: true }`, not array-style `select: ['field']`
**Why:** PR#176 — `findSmallestUnit` used array-style `select: ['pro_unit1', 'pro_unit2', ...]`. TypeORM recommends object notation, which is type-safe and explicit; array-style is a legacy API.
**Example:**
```ts
// ✗ no
await repo.findOne({ select: ['pro_unit1', 'pro_unit2', 'pro_unit3'] })

// ✓
await repo.findOne({ select: { pro_unit1: true, pro_unit2: true, pro_unit3: true } })
```
**Source:** PR#176 @Sasit-Nine — github.com/wangpharma-org/Backend-Ecommerce/pull/176
**Added:** 2026-08-24  **Confidence:** medium (single occurrence)
