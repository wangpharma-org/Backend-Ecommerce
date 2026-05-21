# Happy Hour Module — Bug Report

**Module:** `src/happy-hour/`
**Tester:** QA (read-only review)
**Date:** 2026-05-19
**Branch:** `feature/ECWC-142`

> หมายเหตุ: report นี้รวบรวม bug/issue ที่พบจากการอ่าน source โดยไม่แก้ไข codebase
> ทุก bug จะมี test case ที่ reproduce อยู่ใน `*.spec.ts` ที่เขียนคู่กัน

---

## Severity Legend
- 🔴 **Critical** — กระทบ data integrity / production behavior โดยตรง
- 🟠 **High** — bug ที่ทำให้ฟังก์ชันทำงานผิดในบาง input
- 🟡 **Medium** — ปัญหา validation / edge case ที่ควรปิด
- 🔵 **Low** — code smell / inconsistency

---

## BUG-001 🟠 DTO regex รับเวลาที่ไม่ valid

**File:** [src/happy-hour/dto/create-slot.dto.ts:11-15](src/happy-hour/dto/create-slot.dto.ts#L11-L15), [src/happy-hour/dto/simulate.dto.ts:8](src/happy-hour/dto/simulate.dto.ts#L8)

**Issue**
Regex `/^\d{2}:\d{2}$/` ตรวจเฉพาะ format ไม่ตรวจ valid range
ค่าเช่น `"25:99"`, `"99:99"`, `"30:60"` ผ่าน validation

**Impact**
- `createSlot("25:99", "26:00")` ผ่าน DTO → ส่งไป MySQL TIME column → error หรือถูก coerce
- `simulate({ order_time: "99:99" })` ผ่าน DTO → SQL `99:99:00` → ไม่ match slot ไหนเลย → silent failure ("is_happy_hour: false") ทั้งที่ input ผิด
- `validateTimeRange` ใช้ string compare — `"25:99" >= "26:00"` = false (เพราะ '2'='2','5'<'6') → ดูเหมือน valid แต่ semantic ผิด

**Reproduction (test):** `happy-hour.dto.spec.ts > CreateSlotDto > rejects invalid HH:mm range`

**Expected**
Regex หรือ custom validator ควรตรวจ `00-23` สำหรับชั่วโมง และ `00-59` สำหรับนาที
เช่น `/^([01]\d|2[0-3]):[0-5]\d$/`

---

## BUG-002 🟠 DEFAULT_SLOTS ใช้ `end_time: '24:00'` ซึ่งไม่ใช่ valid 24-hour clock

**File:** [src/happy-hour/happy-hour.service.ts:21](src/happy-hour/happy-hour.service.ts#L21)

**Issue**
`DEFAULT_SLOTS[0]` มี `end_time: '24:00'`
- ใน 24-hour notation มาตรฐาน เวลาคือ `00:00`–`23:59`
- MySQL TIME ยอมรับ `24:00:00` (เป็น special case) แต่ ISO 8601 ไม่รับ และ JavaScript `Date` ก็ไม่
- หาก endpoint `createSlot` reject `24:00` (เพราะ implement custom validator ภายหลัง) จะเกิดความขัดแย้งกับ seed
- query `slot.end_time > '23:59:00'` กับค่า `'24:00:00'` จะ work ใน MySQL แต่ developer ที่อ่าน code อาจสับสน

**Impact**
- เวลา `23:59` ปัจจุบัน — slot นี้ active ✓ (OK)
- เวลา `00:00` — slot `00:00-02:00` active ✓ แต่ slot `22:00-24:00` ใช้ end_time `24:00` ซึ่งไม่ match `start_time <= '00:00:00' AND end_time > '00:00:00'` เพราะ start_time `22:00:00` > `00:00:00` (ไม่ match อยู่แล้ว) → OK

**Reproduction:** `happy-hour.service.spec.ts > onModuleInit > seeds default slots with end_time 24:00`

**Recommendation**
ใช้ `23:59:59` หรือ design ใหม่ให้ slot รองรับ wrap-around รอบเที่ยงคืน (slot เดียวที่คร่อม midnight) แทนการแบ่งเป็น 2 rows

---

## BUG-003 🟠 `calcHappyHourReward` คืน `excessDiscount` แต่ไม่คืน `totalReward`

**File:** [src/happy-hour/happy-hour.service.ts:148-186](src/happy-hour/happy-hour.service.ts#L148-L186)

**Issue**
Return shape ของ `calcHappyHourReward` ≠ shape ของ `simulate`:
- `calcHappyHourReward` คืน `{ slot, numCards, excessDiscount, totalCardValue }`
- `simulate` คืน `{ ..., num_cards, excess_discount, total_reward (= cards*cardValue + excessDiscount) }`

caller (production code) ต้องคำนวณ `totalReward` เอง เสี่ยงคำนวณผิดเพราะแต่ละจุดมี logic ต่างกัน

**Impact**
ทุกที่ที่เรียก `calcHappyHourReward` ต้องเขียน `numCards * Number(slot.card_value) + excessDiscount` เอง → high risk of divergence

**Reproduction:** `happy-hour.service.spec.ts > calcHappyHourReward > shape mismatch with simulate`

**Recommendation**
Return ให้สอดคล้องกัน เช่นเพิ่ม `totalReward` ใน calc หรือใช้ helper เดียวร่วมกัน

---

## BUG-004 🟡 `validateTimeRange` ใช้ string compare — เปราะบางต่อ format

**File:** [src/happy-hour/happy-hour.service.ts:246-250](src/happy-hour/happy-hour.service.ts#L246-L250)

**Issue**
`if (start >= end)` — ใช้ string lexicographic compare
- ถ้า input ตาม regex `HH:mm` (2 หลักเสมอ) — work ถูกต้อง
- แต่ใน `updateSlot` ทำ `slot.start_time.substring(0, 5)` — สมมติว่า DB เก็บ `HH:mm:ss` เสมอ ถ้า MySQL คืน `H:mm:ss` หรือ format อื่น จะ slice ผิด

**Impact**
ระดับ low เพราะ MySQL TIME format มาตรฐาน แต่เป็น implicit contract ที่ไม่ defensive

**Reproduction:** `happy-hour.service.spec.ts > validateTimeRange > equal start and end rejected`

---

## BUG-005 🟡 `validateNoOverlap` ไม่ครอบคลุม overlap ที่ "ครอบทั้ง slot เดิม"

**File:** [src/happy-hour/happy-hour.service.ts:252-270](src/happy-hour/happy-hour.service.ts#L252-L270)

**Issue**
Query: `start_time < :end AND end_time > :start`
- เคส A: existing `10:00-12:00`, new `09:00-13:00` → start=10 < 13 ✓, end=12 > 9 ✓ → detect ✓
- เคส B: existing `10:00-12:00`, new `10:30-11:30` → start=10 < 11:30 ✓, end=12 > 10:30 ✓ → detect ✓
- เคส boundary: existing `10:00-12:00`, new `12:00-14:00` → start=10 < 14 ✓, end=12 > 12 ✗ → no overlap (correct — touching boundary)
- เคส boundary: existing `10:00-12:00`, new `08:00-10:00` → start=10 < 10 ✗ → no overlap (correct)

**Verdict:** logic ถูกต้อง ไม่ใช่ bug แต่ tests ควรครอบเคสเหล่านี้

**Reproduction:** `happy-hour.service.spec.ts > validateNoOverlap > * (multiple cases)`

---

## BUG-006 🔵 `getConfig` มี race condition

**File:** [src/happy-hour/happy-hour.service.ts:89-96](src/happy-hour/happy-hour.service.ts#L89-L96)

**Issue**
ถ้า 2 request เข้ามาพร้อมๆ ในตอนที่ยังไม่มี config row → ทั้งคู่จะ `create({id:1})` + save พร้อมกัน → unique key conflict (1 request error)

**Impact**
Low — เกิดครั้งเดียวต่อ deployment (มี config row หลัง first call แล้ว); error ทำให้ user หนึ่ง retry ก็ผ่าน

**Reproduction:** ทดสอบไม่คุ้ม — เป็น race condition เชิงสถาปัตยกรรม

---

## BUG-007 🟡 `simulate` ไม่ตรวจ `config.is_enabled`

**File:** [src/happy-hour/happy-hour.service.ts:188-244](src/happy-hour/happy-hour.service.ts#L188-L244)

**Issue**
`simulate` คำนวณรางวัลโดยไม่สนใจว่า feature เปิดหรือไม่ — ขณะที่ `calcHappyHourReward` (production path) เช็ค `config.is_enabled`

**Impact**
- Admin tool: คงตั้งใจให้ simulate ได้แม้ปิด feature → **อาจไม่ใช่ bug แต่เป็น behavior ที่ควร document**
- ถ้า frontend แสดงผล `simulate` ให้ลูกค้าเห็น → จะ leak ข้อมูล reward ทั้งที่ feature ปิด

**Reproduction:** `happy-hour.service.spec.ts > simulate > works regardless of config.is_enabled`

**Recommendation**
ยืนยันเจตนากับ Product — ถ้าใช่ admin only ให้ document; ถ้าไม่ใช่ ให้เพิ่ม guard

---

## BUG-008 🟡 `updateSlot` `Object.assign(slot, dto)` ทำ partial mutation โดยไม่ validate ทุก field

**File:** [src/happy-hour/happy-hour.service.ts:121-138](src/happy-hour/happy-hour.service.ts#L121-L138)

**Issue**
- DTO เป็น `Partial<CreateSlotDto>` — DTO field ที่เป็น `@IsOptional` ก็จะ optional หมด แต่ field บังคับเดิม (`@IsNumber()` + `@Min(1)`) ที่ไม่ใส่ Optional จะกลายเป็น invalid เมื่อไม่ส่ง
- NestJS `ValidationPipe` ดูจาก class signature; `Partial<CreateSlotDto>` เป็น TypeScript util ไม่ส่งผลต่อ runtime decorator → field `min_order_amount` ฯลฯ จะถูก validate เป็น required ทุกครั้งใน PUT (ทำให้ partial update ใช้ไม่ได้จริง!)

**Impact** 🟠 (อัปเกรดเป็น High เมื่อพิจารณาจริง)
PUT `/admin/happy-hour/slots/:id` ด้วย body `{ "is_active": false }` จะ fail validation
เพราะ `min_order_amount`, `card_value`, `excess_threshold`, `discount_per_step` decorator ยังถือว่า required

**Reproduction:** `happy-hour.controller.spec.ts > updateSlot > partial update is rejected by validation`

**Recommendation**
ใช้ `PartialType(CreateSlotDto)` จาก `@nestjs/mapped-types` แทน TypeScript `Partial<>`

---

## BUG-009 🟡 `min_order_amount` constraint `@Min(1)` แต่ DEFAULT_SLOTS ใส่ 9999

**File:** [src/happy-hour/dto/create-slot.dto.ts:18](src/happy-hour/dto/create-slot.dto.ts#L18)

**Issue**
DTO ยอมรับ `min_order_amount = 1` แต่ `calcHappyHourReward` จะคำนวณ `numCards = floor(orderAmount / 1) = orderAmount` → ลูกค้าได้ card เท่ากับยอดสั่ง → exploit ได้

**Impact**
ขึ้นกับ business rule — ถ้า admin ตั้ง min 1 บาทโดยไม่ตั้งใจ → ลูกค้าสั่ง 1,000 บาท ได้ 1,000 cards × card_value

**Reproduction:** `happy-hour.dto.spec.ts > CreateSlotDto > accepts min_order_amount=1 (potential exploit)`

**Recommendation**
ใส่ business min (เช่น 100) หรือ document warning

---

## BUG-010 🔵 Decimal field คืน string จาก TypeORM แต่ใช้ `Number()` cast ปลายทาง

**File:** [src/happy-hour/happy-hour.service.ts:172-184](src/happy-hour/happy-hour.service.ts#L172-L184)

**Issue**
`min_order_amount`, `card_value`, `excess_threshold`, `discount_per_step` เป็น `decimal(10,2)` — TypeORM mysql driver คืนเป็น **string** ไม่ใช่ number
Code cast ด้วย `Number(...)` ที่ใช้งานจริง — แต่ entity field type declare เป็น `number` (lie)

**Impact**
TypeScript ไม่เตือน developer ที่ลืม cast → division ของ string เกิด NaN ใน case `"100" / 0` หรือ logic อื่น
Code ปัจจุบัน cast ครบทุกจุดที่คำนวณ — ok แต่เป็น trap

**Reproduction:** `happy-hour.service.spec.ts > calcHappyHourReward > handles decimal-as-string from DB`

---

## BUG-011 🟡 `calcHappyHourReward` timezone parsing เปราะบาง

**File:** [src/happy-hour/happy-hour.service.ts:157-160](src/happy-hour/happy-hour.service.ts#L157-L160)

**Issue**
```ts
const now = new Date(
  new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }),
);
```
- `toLocaleString('en-US')` คืน format `"M/D/YYYY, h:mm:ss AM/PM"` หรือ similar — depends on Node ICU build
- `new Date(<string>)` parse string โดย browser-specific; **ไม่ portable**
- ถ้า Node มี `--icu=small` (without full ICU data) จะคืน format ต่างไป → parsing เพี้ยน

**Impact**
Production: server-side Node มักมี ICU เต็ม — work; แต่ docker image baseimages บางตัวไม่มี → silent wrong time

**Reproduction:** ไม่ใส่ test (env-specific) — แต่ document warning

**Recommendation**
ใช้ `dayjs` (มีอยู่ใน dependencies แล้ว) + `dayjs.tz('Asia/Bangkok')`

---

## BUG-012 🟡 `reward_amount` constraint `@Min(1)` แต่ entity default = 1

**File:** [src/happy-hour/dto/create-slot.dto.ts:46-48](src/happy-hour/dto/create-slot.dto.ts#L46-L48), [src/happy-hour/happy-hour-slot.entity.ts:41-42](src/happy-hour/happy-hour-slot.entity.ts#L41-L42)

**Issue**
Field optional → ถ้าไม่ส่ง entity ใช้ default 1 ✓
แต่ถ้าส่ง `0` → reject (ดี) — เคสนี้ OK

ปัญหา: ใน `simulate` ถ้า `reward_pro_code` มีค่าและ `reward_amount` คือ 1 — ทำงานปกติ
แต่ถ้า `reward_amount = 0` (กรณี admin ตั้งใจไม่ให้รางวัล) — DTO reject แต่ business logic อาจต้องการเปิด case นี้

**Impact** Low — business rule clarification

---

## BUG-013 🟠 `simulate` ไม่ตรวจ `slot.is_active` ในการคำนวณ reward_product

**File:** [src/happy-hour/happy-hour.service.ts:222](src/happy-hour/happy-hour.service.ts#L222)

**Issue**
Query หาก slot ที่ `is_active = true` แล้ว — แต่ check `if (num_cards > 0 && slot.reward_pro_code)`
- หาก slot ไม่มี `reward_pro_code` (NULL) → `reward_product = null` ✓
- หาก `reward_amount = 0` (default ใน entity = 1, แต่ admin อาจตั้ง 0 ผ่าน raw SQL) — `num_cards * 0 = 0` ใน reward_product → frontend แสดง "0 ชิ้น"

**Impact** Edge case ระดับ low

---

## Summary Table

| Bug | Severity | Has Test |
|-----|----------|----------|
| BUG-001 DTO regex | 🟠 High | ✓ |
| BUG-002 24:00 in defaults | 🟠 High | ✓ |
| BUG-003 Shape mismatch calc vs simulate | 🟠 High | ✓ |
| BUG-004 string compare timeRange | 🟡 Med | ✓ |
| BUG-005 overlap boundary | 🟡 Med (logic ok, ต้องการ test coverage) | ✓ |
| BUG-006 getConfig race | 🔵 Low | — |
| BUG-007 simulate ignores config | 🟡 Med | ✓ |
| BUG-008 updateSlot partial fails | 🟠 High | ✓ |
| BUG-009 min_order_amount=1 exploit | 🟡 Med | ✓ |
| BUG-010 decimal as string | 🔵 Low | ✓ |
| BUG-011 timezone parsing | 🟡 Med | — |
| BUG-012 reward_amount=0 | 🔵 Low | — |
| BUG-013 reward_product 0 | 🔵 Low | — |
