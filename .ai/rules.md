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

### R-003  ทุก feature/fix ที่จะขึ้น production ต้องมี e2e ยิง API จริง + รายงานระบุ environment + บันทึกใน Confluence
**Why:** unit/tsc/smoke มือพิสูจน์ไม่ได้ว่าของจริงทำงาน (schema drift, guard, feature flag, notification, Kafka โผล่เฉพาะตอนยิงจริง) และผลที่ไม่ได้บันทึกเท่ากับไม่ได้เทส ผล `local` (DB ทดสอบ Docker ในเครื่อง) นับแค่ "ผ่านก่อน merge" ไม่ใช่ Definition of Done ต้องรันซ้ำกับ deployed code หลัง deploy
**Example:**
```bash
# สคริปต์อยู่ scripts/e2e/<feature>.e2e.ts และต้องบังคับป้าย environment
BASE_URL=http://localhost:3021/api ADMIN_TOKEN=... USER_TOKEN=... npx ts-node scripts/e2e/<feature>.e2e.ts   # → env=local อัตโนมัติ
BASE_URL=https://<api>/api E2E_ENV=prod ADMIN_TOKEN=... USER_TOKEN=... npx ts-node scripts/e2e/<feature>.e2e.ts  # ไม่ระบุ E2E_ENV = ไม่รัน
# รายงาน docs/e2e/<feature>-<env>-<timestamp>.md (ระบุ environment + commit) แล้วบันทึกลง Confluence space R:
#   E2E Testing Playbook — Backend-Ecommerce (202407939) → Test Report — <feature> (หน้าลูก) + แถวในทะเบียน E2E Suites (202473473)
#   ห้ามเอาผล local ไปใส่ช่อง deployed · ห้ามวาง token ในแชท/commit · ข้อมูลทดสอบขึ้นต้น "E2E <env>" และปิด/ยกเลิกเมื่อจบ
```
**Source:** Tim (owner) 2026-09-07 "จำไว้เสมอนะ เราต้องมี e2e เสมอ" + 2026-09-09 งาน pre-order — กฎถาวรทุก repo · ต้นแบบ scripts/e2e/preorder.e2e.ts
**Added:** 2026-09-09  **Enforce:** PR template (ส่วน 🧪 E2E) + review — PR ที่ไม่มีลิงก์รายงาน e2e ไม่ merge

