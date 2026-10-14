# ร้านล่าสุดที่รถส่งถึง + ความยินยอมแสดงชื่อร้าน (ECWC-565 / 600 / 601 / 617)

ลูกค้าเห็นว่ารถขนส่งที่กำลังส่งของให้ ส่งถึงร้านไหนแล้ว ทั้งหน้าสถานะออเดอร์และแถบใต้ navbar

## PDPA — ข้อมูลสองอย่างใช้ฐานกฎหมายคนละตัว

| ข้อมูล | ฐาน | ในระบบ |
| --- | --- | --- |
| ตำบล / อำเภอ / จังหวัด + พิกัดปัด (ทศนิยม 3 ตำแหน่ง ~110 ม.) | ประโยชน์โดยชอบ ม.24(5) | แสดงเสมอ — แจ้งใน ToS/Privacy ผ่าน `policy-doc` |
| ชื่อร้าน + พิกัดเป๊ะ | ความยินยอม ม.19 | แสดงเฉพาะร้านที่ `GRANTED` ภายใต้ `CONSENT_VERSION` ปัจจุบัน |

ความยินยอมชื่อร้าน **แยกจาก** popup ToS ของ `policy-doc` โดยตั้งใจ — ถามรวมกับการยอมรับเงื่อนไขใช้บริการ = พ่วงความยินยอม (ม.19 ว.4)

## Feature flag

`store_name_consent` — migration สร้างไว้เป็น **ปิด** (และอยู่ใน `DEFAULT_DISABLED_FLAGS`) เปิดหลังเซ็น LIA + สเปกความยินยอม

ระหว่างปิด: `GET` คืน `enabled: false, should_ask: false` · `PUT` / `POST asked` ตอบ 403 · ไม่แสดงชื่อร้านของใครเลย (พิกัดถูกปัดทุกร้าน)

## ตาราง

- `customer_store_visibility` — สถานะปัจจุบัน: `mem_code` PK, `status` (`NOT_ASKED` / `GRANTED` / `DECLINED`), `consent_version`, `asked_count`, `updated_at`
- `customer_store_visibility_log` — หลักฐาน **เพิ่มแถวอย่างเดียว**: `action` (`GRANTED` / `DECLINED` / `WITHDRAWN` / `ASKED`), `consent_version`, `text_hash` (sha256 ของข้อความ), `channel` (`WEB` / `APP`), `ip`, `user_agent`, `created_at` — เขียนใน transaction เดียวกับสถานะ

Migration: `src/migrations/20261014000100-create-store-visibility-consent.ts` (idempotent — DB ที่มีตารางแบบเก่า `show_store_name` จะถูกแปลง และทุกแถวกลับเป็น `NOT_ASKED`)

## Endpoint (JwtAuthGuard, `mem_code` จาก token เท่านั้น)

| Method | Path | Body | ผล |
| --- | --- | --- | --- |
| GET | `/ecom/store-visibility` | — | `{ enabled, status, show_store_name, should_ask, asked_count, consent: { version, title, description } }` |
| PUT | `/ecom/store-visibility` | `{ show_store_name: boolean, channel?: 'WEB' \| 'APP' }` | เปิด = `GRANTED` · ปิด = `DECLINED` (log `DECLINED` ถ้ายังไม่เคยเปิด, `WITHDRAWN` ถ้าเคยเปิด) · กดค่าเดิมซ้ำไม่ log |
| POST | `/ecom/store-visibility/asked` | `{ channel?: 'WEB' \| 'APP' }` | ลูกค้าปัดการ์ดทิ้ง → `asked_count + 1` (เพดาน `MAX_ASK_COUNT = 3`) · ตอบแล้ว/ครบเพดานไม่นับ |
| GET | `/ecom/v2/order-status/:soh_running` | — | `delivery.last_delivered_store` + `checkpoint.approximate` เมื่อพิกัดถูกปัด |
| GET | `/ecom/v2/delivery/latest-store` | — | `[{ soh_running, last_delivered_store }]` บิลกำลังส่งย้อนหลัง 7 วัน |

`should_ask` = flag เปิด และ ยังไม่ตอบ (หรือยินยอมไว้กับข้อความเวอร์ชันเก่า) และ `asked_count < 3`

## ข้อความขอความยินยอม

อยู่ที่ `src/store-visibility/store-visibility.consent.ts` ที่เดียว — frontend/แอปแสดง `consent` จาก API ห้าม hardcode
แก้สาระสำคัญ (ขอบเขตข้อมูล / ใครเห็น) ต้อง bump `CONSENT_VERSION` → ความยินยอมเก่าไม่นับ ทุกร้านถูกถามใหม่

## E2E

```bash
BASE_URL=http://localhost:3021/api npx ts-node scripts/e2e/store-visibility.e2e.ts   # local: mint token เอง + เช็ค log จาก DB
BASE_URL=https://<api>/api E2E_ENV=dev ADMIN_TOKEN=... USER_TOKEN=... USER2_TOKEN=... npx ts-node scripts/e2e/store-visibility.e2e.ts
```

ไม่ครอบคลุมชื่อร้านใน order-status / latest-store (ต้องมี logistics-backend จริง) — ดู unit test `order-status-v2.service.spec.ts`

## ยังไม่ทำ (ECWC-617)

- หลังบ้าน: นับ GRANTED / DECLINED / NOT_ASKED ตาม `consent_version` + export log เป็น CSV
- ข้อความใน ToS / Privacy (คู่กับ NNRB-1303) — อัปโหลดผ่าน `POST /ecom/policy/upload-policy`
