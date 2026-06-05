---
description: รับ bug report จาก user → วิเคราะห์ code (ถ้าเกี่ยวกับ backend) → สร้าง Jira issue + subtasks ใน ECWC project ด้วย ADF format
---

## Instructions

รับ bug description จาก user แล้วทำตามขั้นตอนนี้ครบทุกขั้น:

### ขั้น 1 — รับข้อมูล bug

ถามหรือรับจาก user:
- อาการที่เจอ (symptom)
- ตำแหน่งที่เจอ (feature / URL / หน้า)
- ใครรายงาน
- ระดับความรุนแรง (Critical / High / Medium / Low)

### ขั้น 2 — วิเคราะห์ code (ถ้าเกี่ยวกับ backend)

- ค้นหา controller / service ที่เกี่ยวข้องใน `src/`
- อ่านโค้ดที่น่าจะเป็นสาเหตุ
- ระบุ root cause เท่าที่วิเคราะห์ได้

### ขั้น 3 — สร้าง Jira issue

ใช้ `mcp__atlassian__createJiraIssue` โดย:
- cloudId: `841a6653-6063-4f92-a747-fda44c92fb24`
- projectKey: `ECWC`
- issueTypeName: `Bug`
- **contentFormat: `adf` เสมอ** (ห้ามใช้ markdown string)
- description ต้องมีหัวข้อครบ: ปัญหา, root cause, แนวทางแก้ไข, ไฟล์ที่เกี่ยวข้อง
- labels: เลือกตามความเหมาะสม เช่น `bug`, `backend`, `frontend`, `UX`

ADF description structure:
```
heading(2): ปัญหา
paragraph: อาการที่เจอ
heading(2): Root Cause
paragraph: สาเหตุที่วิเคราะห์ได้
heading(2): แนวทางแก้ไข
bulletList: option 1, 2, ...
heading(2): ไฟล์ที่เกี่ยวข้อง
bulletList: path:line
```

### ขั้น 4 — สร้าง subtasks

สำหรับแต่ละแนวทางแก้ไข ให้สร้าง subtask แยก:
- parent: key ของ issue ที่สร้างในขั้น 3
- issueTypeName: `Subtask`
- contentFormat: `adf` เสมอ
- description: งาน, spec/เงื่อนไข, ไฟล์ที่ต้องแก้

### ขั้น 5 — สรุปให้ user

แสดง link ของ issue หลักและ subtask ทั้งหมดที่สร้าง
