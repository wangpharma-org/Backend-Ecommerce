# E2E — POST /ecom/internal/checkout-preview (หน้ากิมมิคของ Key ขาย)

- **environment:** `local` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)
- **commit:** `8574c24` · **base:** http://localhost:3021/api · ฐาน `ecommerce-db`
- เทียบกับตะกร้าจริงของร้านทดสอบ E2E-C01 / E2E-L16 · ล้างตะกร้าเมื่อจบ

## ผล 1/2

| | ขั้น | ที่เห็น |
|---|---|---|
| PASS | token ผิด → 403 · body ไม่มีร้าน → 400 | 403 / 400 |
| FAIL | สคริปต์ทำงานจนจบ | add-cart E2E-P01 HTTP 400 {"message":"Product not found","error":"Bad Request","statusCode":400} |
