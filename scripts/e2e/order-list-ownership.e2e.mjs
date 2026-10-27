#!/usr/bin/env node
/**
 * E2E: สิทธิ์ดูคำสั่งจอง/สถานะของร้าน — ร้านดูได้เฉพาะของตัวเอง (mem_code ใน URL ต้องตรงกับ token)
 * admin ดูได้ทุกร้าน · เซลล์ดูได้เฉพาะร้านในความดูแล · endpoint legacy ต้องมี token
 *
 *   E2E_ENV=local E2E_BASE_URL=http://127.0.0.1:3038 \
 *   E2E_DB_HOST=127.0.0.1 E2E_DB_PORT=… E2E_DB_USER=… E2E_DB_PASS=… E2E_DB_NAME=… \
 *   E2E_JWT_SECRET=<ACCESS_TOKEN_SECRET ของ backend ที่ยิง> E2E_INTERNAL_TOKEN=<INTERNAL_API_TOKEN> \
 *   node scripts/e2e/order-list-ownership.e2e.mjs
 *
 * สร้างร้าน/บิลทดสอบชื่อขึ้นต้น E2E-ID แล้วลบเมื่อจบ · ผล: docs/e2e/order-list-ownership-<env>-<ts>.md
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const env = process.env.E2E_ENV;
const base = (process.env.E2E_BASE_URL || '').replace(/\/+$/, '');
if (!['local', 'dev', 'staging', 'prod'].includes(env) || !base || !process.env.E2E_JWT_SECRET) {
  console.error('ต้องตั้ง E2E_ENV, E2E_BASE_URL, E2E_JWT_SECRET และ E2E_DB_*');
  process.exit(2);
}
if (env !== 'local') { console.error('สคริปต์นี้สร้างข้อมูลทดสอบในฐานตรง ๆ — ใช้กับ local เท่านั้น'); process.exit(2); }
const db = await mysql.createConnection({
  host: process.env.E2E_DB_HOST, port: Number(process.env.E2E_DB_PORT), user: process.env.E2E_DB_USER,
  password: process.env.E2E_DB_PASS, database: process.env.E2E_DB_NAME, charset: 'utf8mb4',
});
const q = (sql, a = []) => db.query(sql, a);
const SHOPS = ['E2E-ID1', 'E2E-ID2', 'E2E-IDADM', 'E2E-IDSALE'];
async function clean() {
  await q("DELETE FROM shopping_head WHERE soh_running LIKE 'E2E-IDSO%'");
  await q('DELETE FROM users WHERE mem_code IN (?)', [SHOPS]);
  await q("DELETE FROM employee WHERE emp_code='E2E-IDEMP'").catch(() => {});
}
const sign = (p) => jwt.sign({ username: p.mem_code, name: `E2E local ${p.mem_code}`, ...p }, process.env.E2E_JWT_SECRET, { expiresIn: '1h' });
const steps = [];
const check = (name, pass, observed) => { steps.push({ name, pass: !!pass, observed }); console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`); };
const get = async (path, token, headers = {}) => {
  const r = await fetch(`${base}/api${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });
  await r.text();
  return r.status;
};

let failure;
try {
  await clean();
  for (const [m, role, perm, ref] of [['E2E-ID1', 'User', 0, '0313'], ['E2E-ID2', 'User', 0, '0743'], ['E2E-IDADM', 'Admin', 1, null], ['E2E-IDSALE', 'Sales', 0, '0313']])
    await q('INSERT INTO users (mem_code, mem_username, mem_password, mem_nameSite, role, permision_admin, emp_id_ref) VALUES (?, ?, ?, ?, ?, ?, NULL)', [m, `e2e-local-${m}`, 'x', `E2E local ${m}`, role, perm]).then(() => ref);
  // emp_id_ref เป็น FK ไป employee.emp_code — สร้างพนักงานทดสอบ E2E-IDEMP แล้วให้ร้าน E2E-ID1 อยู่ในความดูแลของเซลล์
  let careByRef = false;
  try {
    await q("INSERT INTO employee (emp_code, emp_nickname) VALUES ('E2E-IDEMP', 'E2E local เซลล์') ON DUPLICATE KEY UPDATE emp_nickname=VALUES(emp_nickname)");
    await q("UPDATE users SET emp_id_ref='E2E-IDEMP' WHERE mem_code IN ('E2E-ID1','E2E-IDSALE')");
    careByRef = true;
  } catch { /* ไม่มีตาราง employee */ }
  if (!careByRef) await q("UPDATE users SET emp_id_ref=NULL WHERE mem_code IN (?)", [SHOPS]);
  for (const [so, m] of [['E2E-IDSO-1', 'E2E-ID1'], ['E2E-IDSO-2', 'E2E-ID2']])
    await q('INSERT INTO shopping_head (soh_running, soh_datetime, soh_sumprice, mem_code) VALUES (?, NOW(), 100, ?)', [so, m]);
  await q("INSERT INTO feature_flag (feature_key, is_enabled) VALUES ('new_order_list_api',1),('new_order_detail_api',1) ON DUPLICATE KEY UPDATE is_enabled=1");

  const t1 = sign({ mem_code: 'E2E-ID1', role: 'User', permission: false });
  const tAdmin = sign({ mem_code: 'E2E-IDADM', role: 'Admin', permission: true });
  const tAdminRole = sign({ mem_code: 'E2E-IDADM', role: 'Admin', permission: false });
  const tSales = sign({ mem_code: 'E2E-IDSALE', role: 'Sales', permission: false });

  check('ไม่มี token → 401 (v2/order-list)', (await get('/ecom/v2/order-list/E2E-ID1')) === 401, '');
  const own = await get('/ecom/v2/order-list/E2E-ID1', t1);
  const other = await get('/ecom/v2/order-list/E2E-ID2', t1);
  const ownLower = await get('/ecom/v2/order-list/e2e-id1', t1);
  check('v2/order-list: ร้านตัวเอง 200 · ร้านอื่น 403 · ตัวพิมพ์เล็กของร้านตัวเองยังได้', own === 200 && other === 403 && ownLower === 200, `${own} / ${other} / ${ownLower}`);
  const adm = await get('/ecom/v2/order-list/E2E-ID2', tAdmin);
  const admRole = await get('/ecom/v2/order-list/E2E-ID2', tAdminRole);
  check('v2/order-list: admin (permission) และ role Admin ดูร้านอื่นได้ 200', adm === 200 && admRole === 200, `${adm} / ${admRole}`);
  if (careByRef) {
    const sIn = await get('/ecom/v2/order-list/E2E-ID1', tSales);
    const sOut = await get('/ecom/v2/order-list/E2E-ID2', tSales);
    check('v2/order-list: เซลล์ ร้านในความดูแล 200 · ร้านนอกความดูแล 403', sIn === 200 && sOut === 403, `${sIn} / ${sOut}`);
  } else {
    const sOut = await get('/ecom/v2/order-list/E2E-ID2', tSales);
    check('v2/order-list: เซลล์ ร้านนอกความดูแล 403 (ฐานทดสอบไม่มีตาราง employee — ข้ามกรณีในความดูแล)', sOut === 403, `${sOut}`);
  }
  const aOwn = await get('/ecom/all-order-member/E2E-ID1', t1);
  const aOther = await get('/ecom/all-order-member/E2E-ID2', t1);
  check('all-order-member (แอป): ร้านตัวเอง 200 · ร้านอื่น 403', aOwn === 200 && aOther === 403, `${aOwn} / ${aOther}`);
  const sOwnO = await get('/ecom/some-order/E2E-IDSO-1', t1);
  const sOtherO = await get('/ecom/some-order/E2E-IDSO-2', t1);
  check('some-order: บิลตัวเอง ไม่ 403 · บิลร้านอื่น 403', sOwnO !== 403 && sOtherO === 403, `${sOwnO} / ${sOtherO}`);
  const dOther = await get('/ecom/v2/order-detail/E2E-IDSO-2', t1);
  const dOwn = await get('/ecom/v2/order-detail/E2E-IDSO-1', t1);
  const dAdm = await get('/ecom/v2/order-detail/E2E-IDSO-2', tAdmin);
  check('v2/order-detail: บิลร้านอื่น 403 · บิลตัวเอง ไม่ 403 · admin ไม่ 403', dOther === 403 && dOwn !== 403 && dAdm !== 403, `${dOther} / ${dOwn} / ${dAdm}`);
  const lNo = await get('/ecom/legacy/order-list?mem_code=E2E-ID1');
  const lOwn = await get('/ecom/legacy/order-list?mem_code=E2E-ID1', t1);
  const lOther = await get('/ecom/legacy/order-list?mem_code=E2E-ID2', t1);
  check('legacy/order-list: ไม่มี token 401 · ร้านตัวเอง 200 · ร้านอื่น 403', lNo === 401 && lOwn === 200 && lOther === 403, `${lNo} / ${lOwn} / ${lOther}`);
  const ldNo = await get('/ecom/legacy/order-detail?soh_runing=E2E-IDSO-2&mem_code=E2E-ID2');
  const ldOther = await get('/ecom/legacy/order-detail?soh_runing=E2E-IDSO-2', t1);
  const ldSpoof = await get('/ecom/legacy/order-detail?soh_runing=E2E-IDSO-2&mem_code=E2E-ID2', t1);
  check('legacy/order-detail: ไม่มี token 401 · บิลร้านอื่น 403 · ใส่ mem_code ร้านอื่นเอง 403', ldNo === 401 && ldOther === 403 && ldSpoof === 403, `${ldNo} / ${ldOther} / ${ldSpoof}`);
  const st = await get('/ecom/v2/order-status/E2E-IDSO-2', t1);
  check('v2/order-status ของบิลร้านอื่น ไม่คืนข้อมูล (เดิมกรองด้วย token อยู่แล้ว: 404)', st === 404 || st === 403, `${st}`);
  if (process.env.E2E_INTERNAL_TOKEN) {
    const it = await get('/ecom/internal/product-coin', null, { 'x-internal-token': process.env.E2E_INTERNAL_TOKEN });
    check('internal token ยังใช้ได้ (ecom/internal/product-coin) 200', it === 200, `${it}`);
  }
} catch (e) {
  failure = e;
  check('สคริปต์ทำงานจนจบ', false, e instanceof Error ? e.message : String(e));
} finally {
  await clean().catch(() => {});
  await db.end();
}
const passed = steps.filter((s) => s.pass).length;
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return '?'; } })();
const ts = new Date(Date.now() + 7 * 3600e3).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
mkdirSync('docs/e2e', { recursive: true });
const file = `docs/e2e/order-list-ownership-${env}-${ts}.md`;
writeFileSync(file, [
  '# E2E — สิทธิ์ดูคำสั่งจอง/สถานะของร้าน (order-list ownership)', '',
  `- **environment:** \`${env}\`${env === 'local' ? ' (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)' : ''}`,
  `- **commit:** \`${commit}\` · **base:** ${base}`,
  '- ข้อมูลทดสอบ: ร้าน/บิลขึ้นต้น `E2E-ID` สร้างตอนเริ่ม ลบเมื่อจบ · token ลงนามด้วย secret ของ backend ทดสอบ', '',
  `## ผล ${passed}/${steps.length}`, '',
  '| | ขั้น | ที่เห็น |', '|---|---|---|',
  ...steps.map((s) => `| ${s.pass ? 'PASS' : 'FAIL'} | ${s.name} | ${String(s.observed).replace(/\|/g, '\\|')} |`), '',
].join('\n'));
console.log(`\n${passed}/${steps.length} → ${file}`);
process.exit(failure || passed !== steps.length ? 1 : 0);
