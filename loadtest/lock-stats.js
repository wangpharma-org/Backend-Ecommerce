// ดู InnoDB lock stats — รันก่อน/หลังยิง k6 แล้วเทียบ delta
// รันจาก root: node loadtest/lock-stats.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3311,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ecommerce-db',
  });

  const [rows] = await db.query("SHOW GLOBAL STATUS LIKE 'Innodb_row_lock%'");
  console.log(new Date().toISOString());
  console.table(rows.map((r) => ({ metric: r.Variable_name, value: r.Value })));

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
