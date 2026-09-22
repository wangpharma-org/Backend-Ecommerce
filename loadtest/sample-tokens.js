// สุ่ม session_token จริงจากตาราง user-sessions + gen JWT สำหรับผ่าน JwtAuthGuard
// รันจาก root: node loadtest/sample-tokens.js
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SAMPLE = 2000;

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3311,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ecommerce-db',
  });

  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `user-sessions`',
  );
  const [[{ active }]] = await db.query(
    'SELECT COUNT(*) AS active FROM `user-sessions` WHERE is_active = 1',
  );
  console.log(`user-sessions: ${total} rows (active: ${active})`);
  if (active < SAMPLE) {
    throw new Error(`active session ไม่พอ (ต้องการ ${SAMPLE}) — เช็คว่า import dump แล้ว`);
  }

  const [rows] = await db.query(
    'SELECT session_token FROM `user-sessions` WHERE is_active = 1 ORDER BY RAND() LIMIT ?',
    [SAMPLE],
  );

  // expiresIn ยาวกว่าของจริง (15m) กัน token หมดอายุกลางเทส
  // backend local ใช้ 'fallback-secret' เพราะ constants.ts อ่าน env ก่อน ConfigModule โหลด .env
  const secret = process.env.LOADTEST_JWT_SECRET || 'fallback-secret';
  const token = jwt.sign(
    { username: 'loadtest', name: 'loadtest', mem_code: 'M999999' },
    secret,
    { expiresIn: '12h' },
  );

  fs.writeFileSync(
    path.join(__dirname, 'seed-tokens.json'),
    JSON.stringify(rows),
  );
  fs.writeFileSync(path.join(__dirname, 'seed-jwt.txt'), token);
  console.log(`เขียน loadtest/seed-tokens.json (${rows.length} tokens) + seed-jwt.txt แล้ว`);

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
