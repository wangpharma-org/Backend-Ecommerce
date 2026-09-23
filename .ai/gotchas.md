# Gotchas / Pitfalls

Looks correct but breaks. Tribal knowledge made explicit.

Format per entry: `### G-NNN <statement>` then **Why:** / **Example:** / **Source:** PR#n @reviewer url / **Added:** date.

<!-- entries appended below by learn-from-reviews after human approval -->

### G-001  Don't convert pro2_amount/pro2_unit with the main product's unit ratio
**Why:** PR#143 P2 — getHotdealFromproCode (src/hotdeal/hotdeal.service.ts:660-667) converts the freebie's pro2_amount/pro2_unit using the MAIN product's unit ratio. If product2 (the freebie) uses different units, the freebie data returned by the API is wrong. Either don't convert here, or use product2's own unit ratio.
**Source:** PR#143 @MossOcelot — github.com/wangpharma-org/Backend-Ecommerce/pull/143
**Added:** 2026-05-19

### G-002  Index/FK ที่ migration เขียนมือสร้าง ต้องประกาศชื่อเดียวกันใน entity ด้วย
**Why:** `migration:generate` เทียบ entity กับ DB — index/FK ที่ migration เขียนมือตั้งชื่อเอง (เช่น `IDX_product_redeem`, `FK_redeem_product_backup_primary`) แต่ entity ไม่ได้ประกาศ หรือประกาศ `@Index()` แบบไม่มีชื่อ จะถูกมองว่าเกินแล้ว generate คำสั่ง DROP ออกมา (บางตัวไม่สร้างกลับ เช่น unique/FK ของ redeem_product_backup) พบตอนทำ release-1.49.0
**Example:**
```ts
// ✗ no — ได้ชื่อ hash, generate จะ drop IDX_cart_basket_member แล้วสร้าง IDX_f3549... ใหม่
@Index()
@Column({ length: 30 }) mem_code!: string;

// ✓ ชื่อตรงกับ migration
@Index('IDX_cart_basket_member')
@Column({ length: 30 }) mem_code!: string;

// ✓ FK ตั้งชื่อ + onDelete/onUpdate ให้ตรง DB
@JoinColumn({ name: 'set_code', foreignKeyConstraintName: 'FK_bundle_set_item_set' })
```
**Also:** generate เทียบกับ DB ใน `.env` (ปกติคือ local) ไม่ใช่ prod — ผลที่ได้ต้องอ่านทุกบรรทัดก่อนใช้ และเช็คว่า generate เปล่าๆ ได้ "No changes" ก่อนเริ่มแก้ entity เสมอ
**Source:** release-1.49.0 session
**Added:** 2026-09-24
