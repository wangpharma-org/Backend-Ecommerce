// เคลียร์ตัวนับ Innodb_row_lock_* — ตัวนับเป็นค่าสะสมระดับ engine ล้างด้วย SQL ไม่ได้
// ต้อง restart MySQL เท่านั้น: script นี้ restart container → รอจนพร้อม → ยืนยันค่าเป็น 0
// รันจาก root: node loadtest/reset-stats.js
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');
require('dotenv').config();

const CONTAINER = process.env.LOADTEST_DB_CONTAINER || 'ecommerce-db';

function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3311,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ecommerce-db',
    connectTimeout: 3000,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`restarting container: ${CONTAINER} ...`);
  execSync(`docker restart ${CONTAINER}`, { stdio: 'inherit' });

  // รอจน MySQL รับ connection ได้ (ปกติ 5-15 วิ)
  process.stdout.write('waiting for MySQL ');
  let db;
  for (let i = 0; i < 60; i++) {
    try {
      db = await connect();
      await db.query('SELECT 1');
      break;
    } catch {
      process.stdout.write('.');
      await sleep(1000);
    }
  }
  console.log('');
  if (!db) throw new Error('MySQL ไม่ตอบภายใน 60 วินาที');

  const [rows] = await db.query("SHOW GLOBAL STATUS LIKE 'Innodb_row_lock%'");
  console.table(rows.map((r) => ({ metric: r.Variable_name, value: r.Value })));
  await db.end();

  console.log('พร้อมเทสแล้ว — อย่าลืม restart backend ถ้า connection pool ตาย');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
