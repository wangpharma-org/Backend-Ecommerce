# E2E — ECWC-496 review fixes (local)

| | |
|---|---|
| Environment | **local** (ไม่ใช่ Definition of Done — ต้องรันซ้ำกับ deployed code หลัง deploy) |
| Backend commit | `d83f257` (branch `feature/ECWC-496`) |
| Frontend commit | `fbbb792` (branch `feature/ECWC-496`, repo Ecommerce-Frontend) |
| Backend | `http://localhost:3031` (npm run start:dev, worktree Backend-Ecommerce-ecwc496) |
| Frontend | `http://localhost:5183` (vite dev, worktree Ecommerce-Frontend-ecwc496) |
| DB | docker `ecommerce-db` :3311 `ecommerce_db` (migration 20260906000100–20260907000100 รันแล้ว) |
| บัญชีทดสอบ | `E2E-TEST` / `e2e_test_user` (price option C) |
| ข้อมูลทดสอบ | promo 189 (MedicPharmaDay, tier 553 เกณฑ์ 500 บาท แถม 1 แผง), bundle set `SET-DEMO-01` ชื่อขึ้นต้น "E2E local" |
| วันที่รัน | 2026-09-12 10:32 +0700 |

## Backend — jest e2e (ยิง HTTP ใส่ backend ที่รันจริง)

```bash
E2E_BASE_URL=http://localhost:3031 npm run test:e2e -- <suite>
```

| suite | ผล |
|---|---|
| `promo-reward-sets` (ใหม่) | **6/6 ผ่าน** |
| `promo-basket` | **13/13 ผ่าน** |
| `set-basket` | **7/7 ผ่าน** |
| `flashsale-collection` | **5/5 ผ่าน** |
| รวม | **31/31 ผ่าน** |

เคสสำคัญของรอบนี้ — `promo-reward-sets`:

- ยอด 3 เท่าของเกณฑ์ → preview บอก 3 ชุด (เดิมหน้าจอบอก 1 เซตเสมอ)
- พรีวิวบอกกี่ชิ้น ใส่ตะกร้าจริงแล้วของแถมในตะกร้าเพิ่มเท่านั้นพอดี
- basket กับ board รายงานจำนวนชุดตรงกับแถว is_reward ที่ engine สร้างจริง
- พรีวิวกระเช้าว่างตอบ 0 ไม่ใช่ error · ไม่มี token ตอบ 401

## Backend — unit

```bash
npx jest src/promotion src/special-collection src/bundle-set
```

**37/37 ผ่าน** (รวม `tier-allocation.spec.ts` 7 เคสใหม่ และ 3 เคสใน
`special-collection.service.spec.ts` ที่ล้มอยู่ก่อนหน้านี้ — แก้ mock แล้ว)

## Frontend — Playwright

```bash
E2E_BASE_URL=http://localhost:5183 E2E_API_URL=http://localhost:3031 npx playwright test
```

| suite | ผล |
|---|---|
| `promo-review-fixes` (ใหม่) | **4/4 ผ่าน** |
| ทั้งชุด | 21 ผ่าน / 5 ล้ม |

5 ที่ล้ม ไม่ได้มาจากโค้ดชุดนี้:

- `banner-promo` 1 เคส และ `hub-modal` 3 เคส — ล้มเหมือนกันบนโค้ดก่อนแก้ (stash แล้วรันซ้ำ)
  เพราะ DB เครื่องนี้ยังไม่มีแบนเนอร์ที่ผูกโปรและยังไม่มี special_collection ให้บัญชีทดสอบเห็น
- `set-basket` 1 เคส — ล้มเฉพาะตอนรันทั้งชุดต่อกัน (ทุก suite ใช้ตะกร้าของบัญชีเดียวกัน)
  รันเดี่ยว **2/2 ผ่าน**

## ตรวจด้วยมือในเบราว์เซอร์ (Browser pane)

- promo 189 เลือก 3 กล (2,385 บาท) → "ได้ของแถมแล้ว 4 ชุด (4 ชิ้น)" · การ์ดขั้น "ได้ 4 ชุด" · ของแถม "×4 แผงเดียว · 1 × 4 ชุด"
- แถวสินค้าโชว์ "สั่งได้อีก N <หน่วย>" และ + ตันที่เพดาน · เลือก 2 หน่วยพร้อมกันโชว์ "10 แผง · 2 กล50แผง = 110 แผง · ฿1,749"
- ลบของในกระเช้าจาก drawer → หัวข้อกระเช้าบนหน้า board อัปเดตเป็น "1 รายการ · ฿795" ทันที → กดแก้ไขกระเช้า ร่างมี 1 บรรทัด (ก่อนแก้ได้ 2 บรรทัดกลับมา)
- หน้าชำระเงิน ป้ายจำนวนอ่านได้เป็น "3 ซอง10ช · 15 กล3ชิ้น · 1 แผงเดียว · 50 แผง" (เดิมเป็นเลขลอยๆ)

## เก็บกวาด

กระเช้าทดสอบถูกลบทั้งก่อนและหลังทุกเคสโดยตัวสคริปต์ · bundle set `SET-DEMO-01`
กับผู้ใช้ `E2E-TEST` เป็นข้อมูลทดสอบบนเครื่อง dev เท่านั้น ไม่ได้แตะ production
