## 📋 PR Information

### 🔗 Jira Task
<!-- ใส่ link ไปยัง task ใน Jira (ถ้ามี) -->
- 

### 📌 ประเภทของ PR
<!-- เลือกข้อที่ตรง ลบที่ไม่เกี่ยวออก -->
- [ ] ✨ Feature ใหม่
- [ ] 🐛 แก้ Bug
- [ ] ♻️ Refactor
- [ ] 🚀 Release version ใหม่
- [ ] 📝 Documentation
- [ ] 🔧 Config / Infra

### 🎯 PR นี้เปิดเพื่ออะไร / แก้ปัญหาอะไร
<!-- อธิบายสั้นๆ ว่า PR นี้ทำอะไร และ merge แล้วจะช่วยแก้ปัญหาอะไร -->


### 🛠️ แก้ปัญหานั้นอย่างไร
<!-- อธิบายวิธีที่ใช้แก้ปัญหา -->


### 🧪 วิธี Test
<!-- อธิบายวิธี test PR นี้ เช่น เรียก API อะไร / เข้า URL อะไร / ขั้นตอนทดสอบ -->
1. 
2. 
3. 

### 🔑 Environment Variables ใหม่
<!-- ถ้ามี env ใหม่ ให้ระบุชื่อและคำอธิบาย ถ้าไม่มีเขียน "ไม่มี" -->
- 

### 🧪 E2E (บังคับตาม R-003 ใน .ai/rules.md)
<!-- ทุก feature/fix ที่จะขึ้น production ต้องมีสคริปต์ e2e ยิง API จริง และรายงานต้องระบุ environment -->
- [ ] สคริปต์: `scripts/e2e/<feature>.e2e.ts`
- [ ] ผล **local** (ผ่านก่อน merge): `docs/e2e/<feature>-local-<timestamp>.md` — ผล: __/__
- [ ] ผล **deployed** (dev/prod หลัง deploy = Definition of Done): `docs/e2e/<feature>-<env>-<timestamp>.md` — ผล: __/__ (ถ้ายังไม่ deploy ให้เขียน "รอ deploy" และกลับมาอัปเดต)
- [ ] Confluence: Test Report — <feature> ใต้ "E2E Testing Playbook — Backend-Ecommerce" + แถวในทะเบียน E2E Suites — ลิงก์: 

