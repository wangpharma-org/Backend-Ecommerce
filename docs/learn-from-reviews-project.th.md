# โปรเจกต์: learn-from-reviews
### เปลี่ยน feedback จาก PR review ให้เป็นความรู้ร่วมของทีมและ AI

> เอกสารฉบับนี้ผูกกับงานใน Jira: **ECWC-239** และ Bootstrap PR: **#155**
> โครงสร้าง: แนวคิด → วิธีการ → การลงมือทำ

---

## 1. แนวคิด (Idea)

### ปัญหา
ทุกวันนี้ความรู้ที่มีค่าที่สุดของทีมจำนวนมากอยู่ใน **คอมเมนต์ตอน review PR** แล้วก็ "ระเหยหายไป":

- รีวิวเวอร์ต้องคอมเมนต์เรื่องเดิมซ้ำ ๆ ("อันนี้ใช้ Logger สิ ไม่ใช่ console.log")
- dev คนใหม่ และ **AI session ใหม่ทุกครั้ง** ต้องเรียนรู้ใหม่จากศูนย์ → ทำผิดแบบเดิม → โดนคอมเมนต์แบบเดิม
- เราจ่าย "ต้นทุนการรีวิว" ซ้ำแล้วซ้ำเล่า ทั้งที่เป็นความรู้ที่เคยผลิตไปแล้ว

### ไอเดียหลัก
ถือว่า **ทุกการรีวิวคือเหตุการณ์สกัดความรู้ (knowledge extraction)**:
ดึง feedback ของแต่ละรอบมา "กลั่น" ให้เป็นกฎ/ข้อตกลงที่เป็นลายลักษณ์อักษร อยู่ใน version control
แล้วป้อนกลับเป็น context ให้ทั้ง **มนุษย์** (เอกสาร onboarding) และ **AI** (CLAUDE.md) ก่อนรอบ PR ถัดไป

### คุณค่า
- รีวิวเวอร์เลิกพูดเรื่องเดิมซ้ำ — รีวิวไปโฟกัสปัญหาใหม่จริง ๆ
- ความรู้สะสมขึ้นเรื่อย ๆ ไม่หายไปกับคน
- มนุษย์กับ AI ทำงานบนชุดความจริงเดียวกัน (ไม่มี drift ระหว่าง "ที่บอกพนักงานใหม่" กับ "ที่บอก AI")

---

## 2. วิธีการ (Method)

### Loop การทำงาน
```
PR ถูก merge ──► รีวิว (คน ± AI)
                    │
                    ▼
        ดึงคอมเมนต์รีวิว (gh pr view --comments)
                    │
                    ▼
        จัดประเภท (classify) แต่ละคอมเมนต์
                    │
                    ▼
        กลั่นเป็นกฎที่เสนอ (statement + เหตุผล + ตัวอย่าง + ลิงก์ PR)
                    │
                    ▼
        ✋ มนุษย์อนุมัติผ่าน PR ไปยังไฟล์ความรู้   ← นี่คือ "ข้อตกลง"
                    │
                    ▼
        ความรู้ถูกอ่านโดยทั้งคน (onboarding) และ AI (CLAUDE.md)
                    │
                    ▼
        PR รอบถัดไปเริ่มต้นพร้อม context ──► ผิดซ้ำน้อยลง ──► วนกลับ
```

### Taxonomy — จัดทุก feedback เป็น 1 ใน 7 ประเภท
| ประเภท | คือ | เก็บที่ | การบังคับใช้ |
|---|---|---|---|
| **rule** | ต้อง/ห้าม เด็ดขาด (ความปลอดภัย, ความถูกต้อง, contract) | `.ai/rules.md` | แข็ง → เลื่อนขั้นเป็น lint/CI |
| **convention** | "ทีมเราทำแบบนี้" ไม่มี failure แข็ง | `.ai/conventions.md` | นุ่ม คน+AI อ่าน |
| **architecture** | การตัดสินใจเชิงออกแบบ + เหตุผล | `.ai/adr/` | บันทึก (ADR) |
| **domain** | ความจริงเชิงธุรกิจที่โค้ดต้องเคารพ | `.ai/domain.md` | context (lint ไม่ได้) |
| **gotcha** | "ดูถูกแต่พังเพราะ…" | `.ai/gotchas.md` | คำเตือน |
| **preference** | รสนิยมรีวิวเวอร์คนเดียว ยังไม่ตกลงร่วม | `.ai/quarantine.md` | รอ consensus |
| **discard** | บั๊กเฉพาะกิจ ไม่มีบทเรียนทั่วไป | ทิ้ง | — |

### หลักการสำคัญ 4 ข้อ (อะไรทำให้สำเร็จหรือพัง)
1. **Signal vs Noise** — 90% ของคอมเมนต์ไม่ใช่กฎ; ต้องมีคนคัดกรอง ไม่งั้นกลายเป็นลิ้นชักขยะ
2. **"ข้อตกลง" ต้องเป็นจริง** — ไฟล์กฎเปลี่ยนผ่าน PR ที่ถูกรีวิวเท่านั้น (PR นั้นแหละคือฉันทามติ)
3. **ทุกกฎต้องมี "ทำไม" + ตัวอย่าง + ลิงก์ที่มา** — กฎไม่มีเหตุผลจะถูกเมิน
4. **Promotion ladder** — `preference → convention → rule (+lint/CI)` เลื่อนขั้นเมื่อมีหลักฐานซ้ำข้าม PR/รีวิวเวอร์

### Governance
- **CODEOWNERS gate** — การแก้ `.ai/` และ `CLAUDE.md` ต้องผ่านการอนุมัติจาก team lead **@62theories** (บังคับโดย branch protection)
- **Propose-only** — ระบบอัตโนมัติ "เสนอ" เท่านั้น ไม่ commit/merge เอง
- **Ledger** — `ledger.json` บันทึก provenance ทุกรายการ (ที่มา PR, ประเภท, confidence, ใครอนุมัติ)

---

## 3. การลงมือทำ (Implementation)

### โครงสร้างในรีโป (commit ไปกับโค้ด → ทุกคน + AI session ได้ตอน clone)
```
Backend-Ecommerce/
├── .claude/skills/learn-from-reviews/   ← engine (SKILL.md + fetch_reviews.py)
├── .ai/
│   ├── rules.md  conventions.md  domain.md  gotchas.md  quarantine.md
│   ├── adr/        ← Architecture Decision Records
│   └── ledger.json ← provenance + สถานะอนุมัติ
├── CLAUDE.md       ← @-import .ai/ ให้ AI โหลดความรู้ทีมอัตโนมัติ
└── .github/
    ├── CODEOWNERS  ← /.ai/ + /CLAUDE.md ต้องให้ @62theories อนุมัติ
    └── workflows/learn-from-reviews.yml
```

### Pilot
`wangpharma-org/Backend-Ecommerce` (เป็น backend หลัก มี PR/review เยอะ ผลตอบแทนสูงสุด)

### ระบบอัตโนมัติ 2 ตัว (แบ่งหน้าที่ ไม่ชนกัน — ทั้งคู่ propose-only เปิด **draft PR**)
| | ทริกเกอร์ | จังหวะ | ผลลัพธ์ |
|---|---|---|---|
| **GitHub Action** | PR ถูก merge | ทุกครั้งที่ merge | draft PR เสนอแก้ `.ai/` |
| **Scheduled remote agent** | cron | ทุกวันจันทร์ 09:00 (Asia/Bangkok) | draft PR เสนอแก้ `.ai/` |

> ทั้งสองอ่านจาก `develop` → เขียนลง branch `bot/learn-from-reviews*` → เปิด draft PR กลับมาที่ `develop`
> **ไม่แตะ `develop` ตรง ๆ เด็ดขาด** — มนุษย์ (@62theories) เป็นคน merge

### ผลทดสอบจริง (พิสูจน์ว่าใช้ได้)
ดึงคอมเมนต์รีวิว 8 รายการจาก 60 PR → กลั่นได้ **5 รายการ** (PR #121/#137/#143/#148/#123):

| ID | ประเภท | ใจความ |
|---|---|---|
| **R-001** | rule | ห้าม `console.log` ในโค้ดที่ commit ใช้ NestJS `Logger` *(เลื่อนขั้นอัตโนมัติ: ซ้ำ 2 PR)* |
| **D-001** | domain | จำนวนของแถม = (ชุดที่เข้าเงื่อนไข) × `pro2_amount`; หลาย tier ของแถมตัวเดียวกันต้องรวมจำนวน |
| **C-001** | convention | ตรวจ/แปลง query param ที่เป็นตัวเลขก่อนใช้ |
| **G-001** | gotcha | อย่าแปลง `pro2_amount/pro2_unit` ด้วย unit ratio ของสินค้าหลัก |
| **Q-001** | quarantine | เลี่ยง return เป็น string (รอเจอซ้ำก่อนเลื่อนขั้น) |

อีก 3 คอมเมนต์ถูก discard อย่างถูกต้อง (คำถามคลุมเครือ / บั๊กเฉพาะกิจ / "comment")

### สถานะ & งานที่เหลือ (อ้างอิง Jira ECWC-239)
- [ ] @62theories รีวิว & merge **draft PR #155**
- [ ] หลัง merge: เปลี่ยน 5 รายการเป็น `status:"agreed"` + ใส่ `approved_by` ใน `ledger.json`
- [ ] เปิด branch protection บน `develop` ("Require review from Code Owners")
- [ ] รัน scheduled agent ด้วยมือ 1 ครั้ง เพื่อทดสอบ cloud sandbox (auth `gh` + เปิด draft PR) ก่อนรอบ 25 พ.ค.
- [ ] ยืนยัน GitHub Action ทำงานถูกตอน merge PR จริงครั้งถัดไป
- [ ] ตัดสินใจขยายแพทเทิร์นไป backend อื่น (Wang-OrderPickingService-NestJS, Wang-AgentAndBuyer services)

### ลิงก์
- Bootstrap PR: https://github.com/wangpharma-org/Backend-Ecommerce/pull/155
- Jira: ECWC-239
