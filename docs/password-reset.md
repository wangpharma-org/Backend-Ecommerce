# ลืมรหัสผ่าน — พนักงานขายโทรยืนยันตัวตน (ECWC-706)

ร้านที่ลืมรหัสผ่านส่งคำขอจากหน้าเว็บ → พนักงานขายที่ดูแลร้านโทรยืนยันตัวตน → รีเซ็ตเป็นรหัสผ่านชั่วคราวแล้วแจ้งทางโทรศัพท์ → ร้านเข้าสู่ระบบด้วยรหัสชั่วคราวและต้องตั้งรหัสของตัวเองก่อนใช้งาน

โมดูล: [src/password-reset/](../src/password-reset/) · migration `20261013000100-add-password-reset-request` · feature flag **`password_reset_request`** (สร้างไว้เป็นปิด)

## สถานะคำขอ

| สถานะ | ความหมาย |
|---|---|
| `pending` | รอพนักงานยืนยัน (หมดอายุใน 24 ชม.) |
| `approved` | รีเซ็ตแล้ว — รหัสชั่วคราวใช้ได้ 24 ชม. |
| `rejected` | พนักงานปฏิเสธ (สาเหตุบันทึกภายใน ลูกค้าไม่เห็น) |
| `expired` | ไม่มีคนยืนยันภายใน 24 ชม. หรือถูกปิดเพราะคำขออื่นของร้านเดียวกันรีเซ็ตแล้ว |

คำขอที่เลยเวลาจะเปลี่ยนเป็น `expired` ตอนมีการอ่าน/เขียน (ไม่ใช้ cron)

## Endpoint (prefix `/api`)

### ลูกค้า — ไม่ต้อง login

| Method | Path | หมายเหตุ |
|---|---|---|
| POST | `/ecom/password-reset/requests` | `{ account, phone_changed?: boolean, callback_phone? }` → `{ ref_code, status, expires_at, callback_phone_masked, ... }` · ต้องเปิด flag |
| GET | `/ecom/password-reset/requests/:ref` | สถานะตามรหัสอ้างอิง (`PR-XXXXXXX`) |

- **กันเดาบัญชี**: บัญชีที่ไม่มีจริง / เป็นบัญชีพนักงาน-แอดมิน ได้คำตอบรูปแบบเดียวกับบัญชีจริง (บันทึกไว้โดย `mem_code = NULL` พนักงานไม่เห็น)
- ส่งซ้ำระหว่างที่ยังรออยู่ → ได้คำขอเดิม
- จำกัด 3 คำขอ / บัญชีที่กรอก / 24 ชม. และ 10 คำขอ / IP / ชม. → `429`
- `phone_changed` ต้องเป็น boolean `true` เท่านั้น ถึงจะบังคับกรอก `callback_phone` (เบอร์ไทย 9–10 หลัก)

### ลูกค้า — login ด้วยรหัสชั่วคราว

| Method | Path | หมายเหตุ |
|---|---|---|
| POST | `/ecom/login` | ถ้ายังใช้รหัสชั่วคราว → `{ token, refresh_token, must_change_password: true }` token มี `scope: password_change` |
| POST | `/ecom/password-reset/set-password` | `{ new_password, confirm_password, logout_all_devices? }` · ≥ 8 ตัว มีตัวอักษรอังกฤษ+ตัวเลข ไม่ซ้ำรหัสชั่วคราว |

- token ขอบเขต `password_change` เรียกได้แค่ `set-password` และ `/ecom/session/*` (ดู `src/auth/token-scope.ts`) — refresh แล้วยังเป็นขอบเขตเดิม
- รหัสชั่วคราวหมดอายุ → login ได้ `401 รหัสผ่านชั่วคราวหมดอายุ` ต้องส่งคำขอใหม่
- ตั้งรหัสสำเร็จ → ลบ refresh token ทั้งหมดของร้าน (+ ปิด session ทุกเครื่องถ้า `logout_all_devices` ไม่ใช่ `false`) ฝั่งเว็บ login ใหม่ด้วยรหัสใหม่
- ระบบรู้ว่า "ยังใช้รหัสชั่วคราว" จาก `users.mem_password` ยังเท่ากับ `temp_password_hash` ของคำขอ — ถ้าลูกค้าไปเปลี่ยนรหัสทางอื่น (OTP อีเมลเดิม / หน้าเปลี่ยนรหัส) ก็จะไม่ถูกบังคับอีก ไม่ต้องแก้ตาราง `users`

### พนักงาน — เรียกจากระบบ Sale Service เท่านั้น (wangpharma-sale-backend)

หน้าจอพนักงาน (รายการ / ยืนยันตัวตน / ปฏิเสธ / รหัสชั่วคราว) อยู่ใน **wangpharma-sale-services** — sale backend ตรวจ JWT ของ Wang Auth + สิทธิ์ แล้วเรียก endpoint ด้านล่างด้วย `x-internal-token` (= `INTERNAL_API_TOKEN` ของ e-commerce, ฝั่ง sale ตั้งเป็น `ECOMMERCE_INTERNAL_TOKEN`)

header ผู้ทำรายการ (sale backend เป็นคนใส่ ห้ามมาจาก browser):

| Header | ความหมาย |
|---|---|
| `x-actor-emp-code` | รหัสพนักงาน (`employee.emp_code` = `users.emp_id_ref` ของร้านที่ดูแล) จาก JWT — ไม่มี/ผิดรูปแบบ → 400 |
| `x-actor-name` | ชื่อพนักงาน (`encodeURIComponent`) ใช้บันทึกผู้ยืนยัน |
| `x-actor-scope` | `all` = เห็นทุกร้าน · ไม่ส่ง = เฉพาะร้านที่ `users.emp_id_ref` ตรงกับรหัสพนักงาน |
| `x-actor-supervisor` | `1` = ปิด "บังคับตั้งรหัสใหม่" ได้ (หัวหน้า) |

| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/ecom/internal/password-reset/summary` | `{ pending }` สำหรับ badge เมนู |
| GET | `/ecom/internal/password-reset/requests?tab=all\|pending\|mine\|closed&q=` | `{ counts, items }` ค้นด้วยรหัสอ้างอิง/รหัสร้าน/ชื่อร้าน |
| GET | `/ecom/internal/password-reset/requests/:id` | ข้อมูลในระบบเทียบกับข้อมูลจากคำขอ |
| POST | `/ecom/internal/password-reset/requests/:id/approve` | `{ checklist: { called, ref_ok, info_ok }, mode: 'auto'\|'manual', password?, force_change?, note? }` → คืน `temp_password` **ครั้งเดียว** |
| POST | `/ecom/internal/password-reset/requests/:id/reject` | `{ reason: 'unreachable'\|'not_requester'\|'wrong_info'\|'other', note? }` (`other` ต้องมี note) |

- ไม่ตั้ง `INTERNAL_API_TOKEN` = endpoint ฝั่งพนักงานปิดทั้งหมด (403)
- checklist ต้องเป็น `true` ครบทั้ง 3 ข้อ · `force_change: false` ทำได้เฉพาะ `x-actor-supervisor: 1`
- รีเซ็ต: ตั้งรหัสชั่วคราว (hash) ให้บัญชี + ลบ refresh token + ปิด session ทุกเครื่อง + ปิดคำขออื่นที่รออยู่ของร้านเดียวกัน
- บันทึก audit ในแถวคำขอ: ผู้ยืนยัน (`handled_by` = รหัสพนักงาน), เวลา, checklist, วิธีตั้งรหัส, หมายเหตุ, สาเหตุปฏิเสธ
- บัญชี role อื่นที่ไม่ใช่ `User` หรือ `permision_admin = 1` รีเซ็ตผ่านช่องทางนี้ไม่ได้

## E2E

```bash
# 1) seed บัญชีทดสอบ (dev/local เท่านั้น — รีเซ็ตรหัสผ่านบัญชีทดสอบ)
mysql ... ecommerce-db < scripts/seed/ecwc706-password-reset.sql
# 2) ยิง API จริง — ADMIN_TOKEN เปิด/ปิด flag · INTERNAL_TOKEN = INTERNAL_API_TOKEN ของ server (ฝั่งพนักงานยิงแบบ sale backend)
BASE_URL=http://localhost:3021/api ADMIN_TOKEN=... INTERNAL_TOKEN=... npx ts-node scripts/e2e/password-reset.e2e.ts
```

รายงานอยู่ที่ `docs/e2e/password-reset-<env>-<timestamp>.md`

## Deploy

migration → BE (ตั้ง `INTERNAL_API_TOKEN`) → sale backend (ตั้ง `ECOMMERCE_INTERNAL_TOKEN` ให้ตรงกัน) → FE ร้าน + sale-services แล้วเปิด flag `password_reset_request` ที่หน้า admin feature flag เมื่อทีมขายพร้อม (ปิด flag = หน้า "ลืมรหัสผ่าน" กลับไปใช้ OTP ทางอีเมลแบบเดิม)
