# ระงับการเข้าใช้งาน E-commerce รายร้าน (SSN0-273)

พนักงานขายบล็อคร้านไม่ให้เข้า E-commerce จากสวิตช์ "บล็อค Login" ในหน้าโปรไฟล์ลูกค้าของระบบขาย (sale-services)
sale-backend ตรวจสิทธิ์ (`SALE_CUSTOMER_BLOCK_EMP_CODES`) แล้วเรียก route ภายในของ repo นี้ — **สถานะจริงและประวัติอยู่ที่นี่ที่เดียว**

## ผลของการบล็อค

- login ทุกทางถูกปฏิเสธ: รหัสผ่าน (`POST /ecom/login`), LINE (`/ecom/auth/line-login`), ลิงก์ LINE (`/ecom/auth/line-login-by-id`), ต่ออายุ (`POST /ecom/refresh_token`)
- token ที่ออกไปแล้วใช้ไม่ได้: `JwtStrategy.validate` เช็คทุก request — ไม่ต้องรอ access token หมดอายุ 15 นาที
- ตอนบล็อค: ลบ refresh token ของร้านทั้งหมด + ปิด `user-sessions` ที่ active ทั้งหมด
- ตอบ `403 { code: "LOGIN_BLOCKED", message, reason }` — frontend ใช้ `code` แยกจาก 401/403 อื่น แล้วล้าง session + พาไปหน้า login พร้อม `message`
- login ด้วยรหัสผ่านเช็คสถานะ **หลัง** รหัสผ่านถูก — คนที่ไม่รู้รหัสได้ 401 เหมือนเดิม ไม่รู้ว่าร้านถูกบล็อค

## Feature flag

`member_login_block` — migration สร้างไว้เป็น **ปิด** (และอยู่ใน `DEFAULT_DISABLED_FLAGS`)

ระหว่างปิด: ไม่มีร้านไหนถูกบล็อค (แถวที่มีอยู่ถูกเมิน) · `GET` คืน `enabled: false` · `POST` ตอบ `403 FEATURE_DISABLED`
ฝั่ง sale เห็น `enabled: false` แล้วใช้ checkbox "บล็อค Login" แบบเดิม (เป็นแค่ธงในระบบขาย ไม่มีผลกับ E-commerce)

## ตาราง

- `member_login_block` — สถานะปัจจุบัน: `mem_code` PK, `is_blocked`, `reason`, `blocked_by_emp_code`, `blocked_by_name`, `blocked_at`, `updated_at` · ไม่มีแถว = ไม่ถูกบล็อค · แยกจาก `users` เพราะ `users` ถูก upsert จาก ERP
- `member_login_block_log` — ประวัติ **เพิ่มแถวอย่างเดียว**: `action` (`BLOCK` / `UNBLOCK`), `reason`, `actor_emp_code`, `actor_name`, `created_at` — เขียนใน transaction เดียวกับสถานะ

Migration: `src/migrations/20261019000100-create-member-login-block.ts` (idempotent, `down()` ลบตาราง + flag)

## Endpoint (ภายในเท่านั้น — `InternalTokenGuard`, header `x-internal-token` = env `INTERNAL_API_TOKEN`)

| Method | Path | Body | ผล |
| --- | --- | --- | --- |
| GET | `/api/ecom/internal/members/:mem_code/login-block` | — | สถานะ + `has_account` + ประวัติ 50 แถวล่าสุด (ร้านที่ไม่มีบัญชี = `has_account: false` ไม่ใช่ 404) |
| POST | `/api/ecom/internal/members/:mem_code/login-block` | `reason` (บังคับ ≤500), `actor_emp_code` (บังคับ ≤50), `actor_name?` | บล็อค + เตะออก · บล็อคอยู่แล้ว = `changed: false` ไม่เขียน log แต่ยังเตะซ้ำ |
| POST | `/api/ecom/internal/members/:mem_code/login-block/unblock` | `reason?`, `actor_emp_code`, `actor_name?` | ปลดบล็อค (ล้างเหตุผล/ผู้บล็อค) |

`reason` ถูกยุบช่องว่าง/บรรทัดซ้อนก่อนเก็บ — ลูกค้าเห็นข้อความนี้ในกล่องแจ้งเตือนหน้า login · ผู้ทำรายการ sale-backend อ่านจาก JWT ของพนักงาน ไม่ได้มาจาก browser

## เช็คทุก request — snapshot ในหน่วยความจำ

`MemberLoginBlockService` โหลดรายชื่อร้านที่ถูกบล็อค (เฉพาะ `is_blocked = 1`) + สถานะ flag ไว้ในหน่วยความจำ อายุ 30 วินาที
- instance ที่รับคำสั่ง block/unblock ล้าง snapshot ทันที → มีผลทันทีบน instance นั้น
- instance อื่นเห็นภายใน 30 วินาที (เปิด/ปิด flag ก็เช่นกัน)
- โหลดไม่สำเร็จ (DB สะดุด) → ใช้ snapshot เดิมต่อ + log error · ยังไม่เคยโหลดได้เลย = ยังไม่บล็อคใคร (ไม่ให้ทั้งเว็บ 500)

## Env

`INTERNAL_API_TOKEN` (มีอยู่แล้ว) — ต้องตั้งค่าเดียวกับ `ECOMMERCE_INTERNAL_TOKEN` ของ sale-backend ไม่ตั้ง = route ภายในปิดทั้งหมด

## e2e

`BASE_URL=http://localhost:3023/api npx ts-node scripts/e2e/member-login-block.e2e.ts` (local เท่านั้น — seed ร้าน `E2E-LB-<เวลา>` เอง ลบเมื่อจบ, สลับ flag แล้วคืนค่า)
ไม่ครอบคลุม LINE login / ลิงก์ LINE (ต้องมี notification-service จริง — ใช้ `assertNotBlocked` ตัวเดียวกับ login รหัสผ่าน)

ลำดับ deploy: migration → Backend-Ecommerce → sale-backend → sale-services / Ecommerce-Frontend → เปิด flag `member_login_block`
