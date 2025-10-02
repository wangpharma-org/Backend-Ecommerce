require('dotenv').config();
const express = require('express');
const Mailgun = require('mailgun.js');
const formData = require('form-data');

const app = express();
app.use(express.json());

// ---- ตั้งค่า Mailgun ----
const mg = new Mailgun(formData);
const mailgun = mg.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
  // url: 'https://api.mailgun.net',     // ปกติไม่ต้องเปลี่ยน
});
const MG_DOMAIN = process.env.MAILGUN_DOMAIN
// ---- Hardcode ผู้ส่ง ----
const FROM_EMAIL = 'Wang System <no-reply@yourdomain.com>'; 
// *ควรเป็นโดเมนที่ยืนยันกับ Mailgun แล้ว

// ---- API: รับ code + email แล้วส่งเมล ----
app.post('/send-code', async (req, res) => {
  try {
    const { code, email } = req.body;

    if (!code || !email) {
      return res.status(400).json({ message: 'code และ email ต้องถูกส่งมาด้วย' });
    }

    // สร้างข้อความ (ทั้ง text และ html)
    const subject = 'Your verification code';
    const text = `Your code is: ${code}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Verification Code</h2>
        <p>นี่คือโค้ดยืนยันของคุณ:</p>
        <div style="font-size:24px;font-weight:bold;padding:8px 12px;border:1px solid #ddd;display:inline-block;">
          ${code}
        </div>
        <p style="color:#666">โค้ดจะหมดอายุภายใน 10 นาที</p>
      </div>
    `;

    // เรียก Mailgun ส่งอีเมล
    const result = await mailgun.messages.create(MG_DOMAIN, {
      from: FROM_EMAIL,     // hardcode ผู้ส่ง
      to: [email],          // ผู้รับจาก request
      subject,
      text,
      html,
    });

    return res.json({ ok: true, id: result.id, message: 'ส่งอีเมลสำเร็จ' });
  } catch (err) {
    console.error('Mailgun error:', err);
    // ข้อความจาก Mailgun มักอยู่ใน err.details หรือ err.message
    return res.status(500).json({ ok: false, error: err.message || 'ส่งอีเมลไม่สำเร็จ' });
  }
});

// start server
const PORT = process.env.PORT || 3080;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
