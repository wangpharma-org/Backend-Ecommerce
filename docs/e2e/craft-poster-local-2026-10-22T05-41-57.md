# E2E: Company Day poster ผ่านบริการเทมเพลต (local)

- **Environment:** `local`
- **API:** http://localhost:3021/api
- **Commit:** d8374d5 + การแก้ที่ยังไม่ commit (branch feature/craft-poster-renderer)
- **วันที่:** 2026-10-22T05:41:57.154Z
- **ผล:** 15/15 ผ่าน
- **ข้อมูลทดสอบ:** ไม่เขียน DB · ชื่อโปรโมชัน "E2E local แฟงโก้"

| Check | ผล | รายละเอียด |
|---|---|---|
| generate-poster 1:1 คืน request_id | ผ่าน | HTTP 201 craft-a1a8fa1aa09443e8a0ba34e81be98236 ใน 4323 ms |
| get-response-id 1:1 คืน url ทันที | ผ่าน | HTTP 201 http://127.0.0.1:18080/poster/a1a8fa1aa09443e8a0ba34e81be98236.png |
| ภาพ 1:1 เปิดได้และขนาดถูก | ผ่าน | HTTP 200 2160x2160 (คาด 2160x2160) |
| generate-poster 16:9 คืน request_id | ผ่าน | HTTP 201 craft-3c519514361d444885ffe0812ec3c4af ใน 81 ms |
| get-response-id 16:9 คืน url ทันที | ผ่าน | HTTP 201 http://127.0.0.1:18080/poster/3c519514361d444885ffe0812ec3c4af.png |
| ภาพ 16:9 เปิดได้และขนาดถูก | ผ่าน | HTTP 200 3840x2160 (คาด 3840x2160) |
| generate-poster 9:16 คืน request_id | ผ่าน | HTTP 201 craft-b758879ddc634e59b1df01be8ef7be66 ใน 87 ms |
| get-response-id 9:16 คืน url ทันที | ผ่าน | HTTP 201 http://127.0.0.1:18080/poster/b758879ddc634e59b1df01be8ef7be66.png |
| ภาพ 9:16 เปิดได้และขนาดถูก | ผ่าน | HTTP 200 2160x3840 (คาด 2160x3840) |
| generate-poster 3:4 คืน request_id | ผ่าน | HTTP 201 craft-6d638af681e24bf09dfd4edc94f7322c ใน 69 ms |
| get-response-id 3:4 คืน url ทันที | ผ่าน | HTTP 201 http://127.0.0.1:18080/poster/6d638af681e24bf09dfd4edc94f7322c.png |
| ภาพ 3:4 เปิดได้และขนาดถูก | ผ่าน | HTTP 200 2160x2880 (คาด 2160x2880) |
| proxy-image ดาวน์โหลดโปสเตอร์ได้ (ปุ่มดาวน์โหลด) | ผ่าน | HTTP 200 attachment; filename="poster.png" |
| proxy-image ไม่ยอมดึง URL อื่นบนบริการเทมเพลต | ผ่าน | HTTP 400 |
| get-response-id ที่ id ผิดรูปไม่สร้าง url | ผ่าน | HTTP 201 {"message":"response_id not found","requestId":"craft-not-a-real-id"} |

ผล `local` นับแค่ "ผ่านก่อน merge" ต้องรันซ้ำกับ deployed code หลัง deploy
