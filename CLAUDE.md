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
