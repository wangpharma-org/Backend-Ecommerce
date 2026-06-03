---
description: วิเคราะห์ bug จาก description → อ่าน code → หา root cause → เสนอ solution options พร้อม effort estimate ก่อนตัดสินใจสร้าง Jira
---

## Instructions

รับ bug description จาก user แล้วทำตามขั้นตอน:

### ขั้น 1 — ค้นหาไฟล์ที่เกี่ยวข้อง

ใช้ Grep / Glob ค้นหาใน `src/`:
- controller / service ที่ชื่อตรงกับ feature ที่แจ้ง
- keyword จาก error message หรือ field name

### ขั้น 2 — อ่าน code

อ่านไฟล์ที่น่าจะเกี่ยวข้อง ให้ระบุ:
- บรรทัดที่น่าจะเป็นจุดปัญหา
- logic ที่ผิดพลาด
- dependency ที่เกี่ยวข้อง (entity, service อื่น)

### ขั้น 3 — สรุป root cause

ระบุให้ชัดเจน:
- **Root cause:** อะไรที่ทำให้เกิด bug
- **Scope:** กระทบ flow ไหนบ้าง
- **ไฟล์ที่เกี่ยวข้อง:** path:line

### ขั้น 4 — เสนอ solution options

เสนอ 2-3 วิธีพร้อม:

| Option | วิธีแก้ | Effort | Trade-off |
|--------|---------|--------|-----------|
| A | ... | S/M/L | ... |
| B | ... | S/M/L | ... |

Effort: S = < 2h, M = 2h–1d, L = > 1d

### ขั้น 5 — ถามว่าจะสร้าง Jira ต่อหรือเปล่า

ถ้า user ตอบตกลง → ให้เรียก `/new-bug` ต่อ โดยส่ง root cause และ solution options ที่วิเคราะห์ได้ให้ใช้เป็น input
