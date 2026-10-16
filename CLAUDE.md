# CLAUDE.md — Backend-Ecommerce

## Database Architecture

โปรเจกต์นี้ใช้ **2 MySQL databases** แยกกัน:

| Database | ตัวแปร env | ใช้สำหรับ |
|----------|-----------|----------|
| `ecommerce-db` | `DB_NAME` | Main database — entities ทั้งหมดที่ไม่ได้ระบุ `database` ใน `@Entity()` |
| `e-commerce-database-other` | hardcoded ใน entity | Secondary database — entities ที่ระบุ `database: 'e-commerce-database-other'` |

### Entities ที่อยู่ใน e-commerce-database-other

- `HappyHourConfigEntity` — [src/happy-hour/happy-hour-config.entity.ts](src/happy-hour/happy-hour-config.entity.ts)
- `HappyHourSlotEntity` — [src/happy-hour/happy-hour-slot.entity.ts](src/happy-hour/happy-hour-slot.entity.ts)

## Migration

- ใช้ TypeORM migrations เสมอ — **ห้ามใช้ `SYNCHRONIZE=true` ใน production**
- Migration files อยู่ที่ [src/migrations/](src/migrations/)
- รัน migration: `npm run migration:run`
- สร้าง migration ใหม่: `npm run migration:generate -- src/migrations/<ชื่อ>`

### สร้าง Table ใน e-commerce-database-other

Migration ที่สร้าง table ข้าม database ต้องทำ 2 ขั้นตอนใน `up()`:

```ts
// 1. สร้าง database ถ้ายังไม่มี
await queryRunner.query(
  `CREATE DATABASE IF NOT EXISTS \`e-commerce-database-other\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);

// 2. สร้าง table โดยระบุ database prefix
await queryRunner.query(
  `CREATE TABLE IF NOT EXISTS \`e-commerce-database-other\`.\`table_name\` (...) ENGINE=InnoDB`
);
```

DB user ที่รัน migration ต้องมีสิทธิ์ `CREATE` ระดับ global (`GRANT CREATE ON *.* TO 'user'@'host'`)

## Environment Variables

```env
SYNCHRONIZE=false        # ต้องเป็น false เสมอใน production
DB_HOST=...
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=...
DB_NAME=ecommerce-db
```

## Happy Hour — Auto-seed

`HappyHourService` implements `OnModuleInit` → seed default slots ลง `e-commerce-database-other` อัตโนมัติตอน app start ถ้าตารางว่างอยู่ ดู [src/happy-hour/happy-hour.service.ts](src/happy-hour/happy-hour.service.ts)

## Pre-order (สั่งจองสินค้า)

โมดูล [src/preorder/](src/preorder/) — รอบจอง 2 โหมด (allocation / aggregation), คิวจาก `ordered_at` ที่ไม่ถูกแก้, admin ล็อค/จัดสรร, แจ้งร้านเมื่อของเข้าผ่าน `NewArrivalsService → PreorderService.handleArrivals`
เปิดใช้ด้วย feature flag `preorder` (migration สร้างไว้เป็นปิด) รายละเอียดและ endpoint ทั้งหมดใน [docs/preorder.md](docs/preorder.md)
e2e: `scripts/e2e/preorder.e2e.ts`

## สติ๊กเกอร์ฉลากยา (สินค้าสั่งทำ)

โมดูล [src/sticker-label/](src/sticker-label/) — print mode → รหัส `95030411-05`/`-07` (backend เลือกเอง), `custom_options` ต่อแถวตะกร้า (แยกแถวด้วย `custom_options_hash`) + snapshot ใน `shopping_order`, คิวพิมพ์นับสถานะจาก `sticker_print_log`, PDF A4 (ดวง 80×50 มม. 2×5) ด้วย puppeteer — Sarabun ฝังใน `src/sticker-label/fonts/` (nest-cli assets)
เปิดใช้ด้วย feature flag `sticker_label` (migration สร้างไว้เป็นปิด) + env `STICKER_LABEL_ENABLED_LANGS`, `STICKER_PRINTERS` รายละเอียดใน [docs/sticker-label.md](docs/sticker-label.md)
e2e: `scripts/e2e/sticker-label.e2e.ts`

## ร้านล่าสุดที่รถส่งถึง + ความยินยอมแสดงชื่อร้าน (PDPA)

โมดูล [src/store-visibility/](src/store-visibility/) + `order-status-v2` — ที่อยู่ ต./อ./จ. แสดงเสมอ (ม.24(5)), ชื่อร้าน/พิกัดเป๊ะเฉพาะร้านที่ยินยอม (ม.19) สถานะ 3 แบบ + log เพิ่มอย่างเดียว, ข้อความ consent อยู่ฝั่ง backend (`store-visibility.consent.ts`) — แยกจาก popup ToS ของ `policy-doc` โดยตั้งใจ
เปิดใช้ด้วย feature flag `store_name_consent` (migration สร้างไว้เป็นปิด) รายละเอียดใน [docs/store-visibility.md](docs/store-visibility.md)
e2e: `scripts/e2e/store-visibility.e2e.ts`

## ลืมรหัสผ่าน — พนักงานขายยืนยันตัวตน

โมดูล [src/password-reset/](src/password-reset/) — ร้านส่งคำขอ (กันเดาบัญชี, จำกัดจำนวน) → พนักงานใน**ระบบ Sale Service** โทรยืนยัน + checklist (เรียก `/ecom/internal/password-reset/*` ด้วย `x-internal-token` + `x-actor-emp-code` — ร้านที่ `emp_id_ref` ตรงกัน) → รหัสผ่านชั่วคราว (แสดงครั้งเดียว) → login ได้ token ขอบเขต `password_change` ใช้ได้แค่ตั้งรหัสใหม่ (ตัดสินจาก `temp_password_hash` เทียบ `users.mem_password` ไม่แก้ตาราง users)
เปิดใช้ด้วย feature flag `password_reset_request` (migration สร้างไว้เป็นปิด) รายละเอียดใน [docs/password-reset.md](docs/password-reset.md)
e2e: `scripts/e2e/password-reset.e2e.ts` (seed `scripts/seed/ecwc706-password-reset.sql` ก่อน)

Team knowledge below is distilled from PR review feedback by the
`learn-from-reviews` skill and ratified through normal PR review. It primes both
human contributors and AI sessions so review feedback isn't re-learned every time.

## Rules (must follow)
@.ai/rules.md

## Conventions (how we do it here)
@.ai/conventions.md

## Domain knowledge
@.ai/domain.md

## Gotchas
@.ai/gotchas.md

---
To refresh this knowledge from recent merged PRs, run the `learn-from-reviews`
skill. It proposes changes only — a human reviews and ships them via a normal PR.

