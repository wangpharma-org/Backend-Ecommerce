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
    const { code, email, refKey } = req.body;

    if (!code || !email || !refKey) {
      return res.status(400).json({ message: 'code, email และ refKey ต้องถูกส่งมาด้วย' });
    }

    // สร้างข้อความ (ทั้ง text และ html)
    const subject = 'Your verification code';
    const text = `Your code is: ${code}`;
    const html = `
     <div style="margin:0; padding:0; background:#f4f6f8; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; line-height:1.6;">
  <!-- Header -->
  <div style="background:#0f172a; padding:20px 24px; text-align:center; border-top-left-radius:8px; border-top-right-radius:8px;">
    <img src="D:/WP/Wang-E-commerce/Backend-Ecommerce/src/change-password/items/LOGO.png" 
       alt="Wang Pharmaceutical" 
       height="28" 
       style="display:inline-block; vertical-align:middle;">
  </div>

  <!-- Card -->
  <div style="background:#ffffff; padding:32px 28px; border-bottom-left-radius:8px; border-bottom-right-radius:8px; 
              box-shadow:0 1px 3px rgba(233, 121, 121, 0.08); max-width:600px; margin:0 auto;">
    
    <div style="margin:0 0 16px; font-size:20px; line-height:28px; color:#111827; text-align:center; font-weight:bold;">
      รหัสยืนยัน (Verification code)
    </div>

    <div style="text-align:center; margin:16px 0 6px;">
      <div style="display:inline-block; font-weight:700; font-size:42px; line-height:52px; letter-spacing:3px; color:#111827;">
        ${code}
      </div>
    </div>

    <div style="text-align:center; margin:12px 0 6px;">
      <div style="font-size:12px; line-height:18px; color:#6b7280; margin-bottom:4px;">
        หมายเลขอ้างอิง (Reference Key)
      </div>
      <div style="display:inline-block; font-weight:600; font-size:16px; line-height:24px; letter-spacing:1px; color:#374151; 
        background:#f9fafb; padding:8px 16px;">
        ${refKey}
      </div>
    </div>

    <div style="margin:6px 0 20px; font-size:12px; line-height:18px; color:#6b7280; text-align:center;">
      รหัสนี้จะหมดอายุภายใน 15 นาทีหลังจากส่ง
    </div>

    <div style="border-top:1px solid #e5e7eb; margin:20px 0;"></div>

    <div style="margin:0 0 10px; font-size:14px; line-height:22px; color:#374151;">
      บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด จะไม่ส่งอีเมลเพื่อขอให้คุณเปิดเผยรหัสผ่าน หมายเลขบัตรเครดิต 
      หรือข้อมูลบัญชีธนาคารของคุณ หากคุณได้รับอีเมลที่น่าสงสัยพร้อมลิงก์ให้กดเพื่ออัปเดตข้อมูลบัญชี 
      กรุณาอย่าคลิกลิงก์นั้น
    </div>

    <div style="margin:0 0 10px; font-size:14px; line-height:22px; color:#374151;">
      หากคุณไม่ได้ร้องขอรหัสยืนยันนี้ โปรดเพิกเฉยอีเมลฉบับนี้ หรือแจ้งให้เราทราบที่ 
      <a href="mailto:{{SUPPORT_EMAIL}}" style="color:#2563eb; text-decoration:none;">{{SUPPORT_EMAIL}}</a>
      เพื่อให้เราตรวจสอบ
    </div>

    <div style="margin:18px 0 0; font-size:12px; line-height:18px; color:#6b7280;">
      หากปุ่ม/รหัสไม่แสดงอย่างถูกต้อง กรุณาคัดลอกและวางรหัสด้านบนในหน้ายืนยันตัวตนของ บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 12px 40px; text-align:center; color:#9ca3af; font-size:11px; line-height:18px;">
    บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด เป็นเครื่องหมายการค้าจดทะเบียนของบริษัทเจ้าของแบรนด์ (ถ้ามี).<br>
    ที่อยู่: เลขที่ 23 ซ.พัฒโน ถ.อนุสรณ์อาจารย์ทอง ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา 90110
  </div>
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
