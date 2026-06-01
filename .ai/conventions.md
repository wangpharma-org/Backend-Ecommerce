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

### C-002  Use a Guard or Decorator for role/permission checks; do not inline `if (role !== Admin)` inside controller action methods
**Why:** PR#154 — a permission check was written inline inside a Happy Hour controller action. Inline checks scatter authorization logic across handlers and are easy to omit on new endpoints; Guards/Decorators centralise the policy and are composable.
**Example:**
```ts
// ✗ inline in action
if (req.user.role !== UserRole.Admin && !req.user.permission)
  throw new ForbiddenException();

// ✓ declare at the endpoint (or controller class)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Post('admin-action')
adminAction() { ... }
```
**Source:** PR#154 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/154
**Added:** 2026-06-01  **Confidence:** medium (single occurrence)
