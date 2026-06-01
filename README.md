# Backend Ecommerce API

NestJS backend สำหรับระบบ e-commerce — จัดการสินค้า, ตะกร้า, คำสั่งซื้อ, โปรโมชั่น และ hotdeal

---

## ⚠️ สำคัญ — ต้องทำก่อน run project ครั้งแรก

### ตรวจสอบ `product_unit` table

ระบบหน่วยสินค้าถูก migrate ไปอยู่ใน `product_unit` table แยกต่างหาก
**ถ้า table นี้ว่างเปล่า ระบบจะคำนวณราคา, ของแถม และหน่วยสินค้าผิดทั้งหมด**

```bash
# ตรวจสอบด้วย SQL
mysql -u <user> -p <database> -e "SELECT COUNT(*) FROM product_unit;"
```

ถ้าผลเป็น `0` ให้รัน migration ก่อน:
<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Database Architecture

โปรเจกต์นี้ใช้ **2 MySQL databases** แยกกัน:

| Database | ใช้สำหรับ |
|----------|----------|
| `ecommerce-db` | Main database — entities ทั้งหมดทั่วไป |
| `e-commerce-database-other` | Secondary database — features ที่แยกออกมา เช่น Happy Hour |

Entity ที่อยู่ใน secondary database จะระบุ `database` ใน decorator:

```ts
@Entity({ name: 'happy_hour_config', database: 'e-commerce-database-other' })
```

### Migration

```bash
# รัน migration ที่ยังไม่ได้รัน
npm run migration:run

# สร้าง migration ใหม่
npm run migration:generate -- src/migrations/<ชื่อ>

# ย้อน migration ล่าสุด
npm run migration:revert
```

> DB user ต้องมีสิทธิ์ `CREATE ON *.*` เพื่อสร้าง database ใหม่ได้
> ห้ามใช้ `SYNCHRONIZE=true` ใน production — ใช้ migration แทนเสมอ

### การเพิ่ม Table ใน Secondary Database

Migration ที่สร้าง table ข้าม database ต้อง `CREATE DATABASE IF NOT EXISTS` ก่อน:

```ts
await queryRunner.query(
  `CREATE DATABASE IF NOT EXISTS \`e-commerce-database-other\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await queryRunner.query(
  `CREATE TABLE IF NOT EXISTS \`e-commerce-database-other\`.\`my_table\` (...) ENGINE=InnoDB`
);
```

## Project setup

```bash
npm run migration:run
```

---

## Project Setup

```bash
# ติดตั้ง dependencies
npm install

# ตั้งค่า environment variables
cp .env.example .env
# แก้ไข .env ให้ครบ (DB, Kafka, S3, etc.)

# รัน migration (สำคัญ — ดูหัวข้อด้านบน)
npm run migration:run

# รัน development
npm run start:dev
```

---

## Environment Variables

| Variable | คำอธิบาย |
|----------|----------|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (default: 3306) |
| `DB_USERNAME` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_DATABASE` | Database name |
| `JWT_SECRET` | Secret สำหรับ JWT |
| `KAFKA_BROKER` | Kafka broker URL |
| `DO_SPACES_KEY` | DigitalOcean Spaces access key |
| `DO_SPACES_SECRET` | DigitalOcean Spaces secret |
| `ELASTICSEARCH_NODE` | Elasticsearch endpoint |

---

## Migration

```bash
# รัน migration ทั้งหมดที่ยังไม่ได้รัน
npm run migration:run

# ย้อน migration ล่าสุด
npm run migration:revert

# สร้าง migration ใหม่
npm run migration:generate -- src/migrations/<MigrationName>
```

### Migration สำคัญ

| Migration | คำอธิบาย |
|-----------|----------|
| `1777869005107-unit` | ย้ายหน่วยสินค้าจาก `product.pro_unit1/2/3` → `product_unit` table + เปลี่ยน `shopping_cart.spc_unit` (string) → `spc_unit_enum` (enum '1'\|'2'\|'3') |

---

## Run Project

```bash
# development (watch mode)
npm run start:dev

# production
npm run start:prod

# debug mode
npm run start:debug
```

---

## Tests

```bash
# unit tests
npm run test

# unit tests (watch mode)
npm run test:watch

# test coverage
npm run test:cov

# e2e tests
npm run test:e2e
```

---

## Architecture

```
src/
├── products/          # สินค้า + ProductUnitEntity (หน่วยสินค้า)
├── shopping-cart/     # ตะกร้าสินค้า
├── shopping-order/    # คำสั่งซื้อ
├── promotion/         # โปรโมชั่น + reward
├── hotdeal/           # hotdeal + ของแถม
├── flashsale/         # flash sale
├── favorite/          # รายการโปรด
├── migrations/        # TypeORM migrations
└── ...
```

### Unit System

หน่วยสินค้าแต่ละรายการมีได้สูงสุด 3 ระดับ (level 1 = เล็กสุด, 3 = ใหญ่สุด):

```
product_unit:
  level 1 → ชิ้น  (ratio: 1)
  level 2 → กล่อง (ratio: 12)   ← 1 กล่อง = 12 ชิ้น
  level 3 → ลัง   (ratio: 144)  ← 1 ลัง = 144 ชิ้น
```

ใน cart และ promotion ใช้ enum `'1'|'2'|'3'` แทนชื่อหน่วย — service layer แปลงกลับก่อน return
