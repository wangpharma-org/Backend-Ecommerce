#!/usr/bin/env node
/**
 * E2E: หน้า "สถานะออเดอร์" แบบเว็บร้านค้าเดิม (shopping-status-so-2.php) — แหล่งเดียวให้ลูกค้าและระบบขาย
 *   GET /api/ecom/v2/order-status-table (JWT ลูกค้า — เห็นแค่ร้านตัวเอง)
 *   GET /api/ecom/internal/order-status-table/:memCode (x-internal-token — ระบบขาย)
 *   POST /api/ecom/internal/order-status/batch (x-internal-token — สถานะหลายใบหลายร้าน)
 *
 *   1. ไม่มี token → 403 ทั้ง internal และลูกค้า
 *   2. ร้านทดสอบ ช่วงค่าเริ่ม (30 วัน): ครบ 7 บิล ไม่รวมบิลเก่า 60 วันและบิลร้านอื่น · สถานะ/ป้ายตรงตาราง legacy
 *   3. รายการสินค้า: RT = สินค้าขาดชั่วคราว · ตรวจนับขาด = short · เลขที่ใบกำกับของบิลที่ผ่าน QC · บิลที่ยังไม่ถึงคลังใช้รายการตอนสั่ง
 *   4. ช่วงวันที่ย้อนหลัง → ได้เฉพาะบิลเก่า · ช่วงเกิน 92 วัน → truncated
 *   5. ลูกค้า (JWT) ได้ชุดเดียวกับ internal · ร้านอื่น login → ไม่เห็นบิลของร้านนี้
 *   6. batch หลายร้าน → สถานะ/ป้ายถูกต่อใบ
 *   7. คลังล่ม → ไม่ 500 · partial=true
 *
 *   E2E_ENV=local E2E_BASE_URL=http://127.0.0.1:3037 E2E_INTERNAL_TOKEN=… E2E_FAKE_URL=http://127.0.0.1:5741
 *   E2E_SEED_DB=1 DB_HOST=127.0.0.1 DB_PORT DB_USERNAME DB_PASSWORD DB_NAME   node scripts/e2e/order-status-table.e2e.mjs
 * ผล: docs/e2e/order-status-table-<env>-<timestamp>.md
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const env = (process.env.E2E_ENV || '').trim();
const base = (process.env.E2E_BASE_URL || '').replace(/\/+$/, '');
const token = process.env.E2E_INTERNAL_TOKEN || '';
const fake = (process.env.E2E_FAKE_URL || '').replace(/\/+$/, '');
if (!['local', 'dev', 'staging', 'prod'].includes(env) || !base || !token) {
  console.error('ต้องตั้ง E2E_ENV, E2E_BASE_URL, E2E_INTERNAL_TOKEN');
  process.exit(2);
}
const seed = process.env.E2E_SEED_DB === '1';
if (seed && !/^(localhost|127\.0\.0\.1)$/.test(process.env.DB_HOST ?? '')) {
  console.error('E2E_SEED_DB ใช้ได้กับ localhost เท่านั้น');
  process.exit(2);
}
const MEM = 'E2E-OS1', MEM2 = 'E2E-OS2';
const bkk = (n) => new Date(Date.now() + 7 * 3600e3 - n * 864e5).toISOString().slice(0, 10);

const steps = [];
const check = (name, pass, observed) => { steps.push({ name, pass: !!pass, observed }); console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`); };
const call = async (method, path, { headers = {}, body } = {}) => {
  const res = await fetch(`${base}/api${path}`, { method, headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: res.status, data };
};
const I = { 'x-internal-token': token };
const jwtFor = (mem) => {
  const jwt = require('jsonwebtoken');
  // ใช้ secret ชุดเดียวกับที่ e-commerce ในเครื่องรันอยู่ (ACCESS_TOKEN_SECRET จาก env — ไม่พิมพ์ออก)
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error('ต้องตั้ง ACCESS_TOKEN_SECRET (ค่าเดียวกับ e-commerce ในเครื่อง)');
  return jwt.sign({ username: `e2e-${mem}`, name: `E2E local ${mem}`, mem_code: mem, permission: 'user' }, secret, { expiresIn: '10m' });
};

let db;
async function seedDb() {
  const mysql = require('mysql2/promise');
  db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  await cleanDb();
  for (const m of [MEM, MEM2]) await db.query('INSERT INTO users (mem_code, mem_username, mem_password, mem_nameSite) VALUES (?, ?, ?, ?)', [m, `e2e-local-${m}`, 'x', `E2E local ร้าน ${m}`]);
  for (const [c, n] of [['E2E-OSP1', 'E2E local พาราเซตามอล'], ['E2E-OSP4', 'E2E local หน้ากากอนามัย']]) await db.query('INSERT INTO product (pro_code, pro_name) VALUES (?, ?)', [c, n]);
  const dt = new Date(`${bkk(1)}T09:30:00+07:00`);
  await db.query('INSERT INTO shopping_head (soh_running, soh_datetime, soh_sumprice, mem_code) VALUES (?, ?, ?, ?)', ['E2E-SO-OPEN', dt, 260, MEM]);
  await db.query('INSERT INTO shopping_order (soh_running, pro_code, spo_qty, spo_unit, spo_price_unit, spo_total_decimal) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)', ['E2E-SO-OPEN', 'E2E-OSP1', 2, 'กล่อง', 100, 200, 'E2E-SO-OPEN', 'E2E-OSP4', 3, 'กล่อง', 20, 60]);
}
async function cleanDb() {
  if (!db) return;
  await db.query("DELETE FROM shopping_order WHERE soh_running LIKE 'E2E-SO%'");
  await db.query("DELETE FROM shopping_head WHERE soh_running LIKE 'E2E-SO%'");
  await db.query("DELETE FROM product WHERE pro_code LIKE 'E2E-OSP%'");
  await db.query("DELETE FROM users WHERE mem_code IN ('E2E-OS1', 'E2E-OS2')");
}

const EXPECT = {
  'E2E-SO-OPEN': ['opened', 'รับใบสั่งจอง'],
  'E2E-SO-PICK': ['picking', 'กำลังจัดออเดอร์'],
  'E2E-SO-CHK': ['checking', 'จัดเสร็จแล้ว'],
  'E2E-SO-BLK': ['blocked', 'รอบัญชีอนุมัติ'],
  'E2E-SO-RDY': ['waiting_load', 'เตรียมส่ง'],
  'E2E-SO-DLV': ['delivering', 'กำลังส่ง'],
  'E2E-SO-DONE': ['done', 'จัดส่งสำเร็จ'],
};
let failure;
try {
  if (seed) await seedDb();
  if (fake) await fetch(`${fake}/__down?on=0`);
  const noTok = await call('GET', `/ecom/internal/order-status-table/${MEM}`);
  const noJwt = await call('GET', '/ecom/v2/order-status-table');
  const noTokB = await call('POST', '/ecom/internal/order-status/batch', { body: { items: [] } });
  check('ไม่มี token → 403 (internal ตาราง / ลูกค้า / batch)', [noTok.status, noJwt.status, noTokB.status].every((s) => s === 403 || s === 401), `${noTok.status} / ${noJwt.status} / ${noTokB.status}`);

  const t = await call('GET', `/ecom/internal/order-status-table/${MEM}`, { headers: I });
  const runs = (t.data?.orders ?? []).map((o) => o.soh_running);
  const wrong = Object.entries(EXPECT).filter(([r, [s, l]]) => { const o = t.data?.orders?.find((x) => x.soh_running === r); return !o || o.status !== s || o.status_label !== l; }).map(([r]) => r);
  check('ช่วงค่าเริ่ม: ครบ 7 บิล สถานะ/ป้ายตรงตาราง legacy · ไม่มีบิลเก่า 60 วัน / บิลร้านอื่น', t.status === 200 && wrong.length === 0 && runs.length === 7 && !runs.includes('E2E-SO-OLD') && !runs.includes('E2E-SO2-PICK') && t.data.labels?.blocked === 'รอบัญชีอนุมัติ',
    `HTTP ${t.status} · ${runs.length} บิล · ผิด: ${wrong.join(',') || '-'} · ช่วง ${t.data?.date_from}→${t.data?.date_to}`);
  const sorted = runs.join(',') === [...runs].sort((a, b) => { const A = t.data.orders.find((o) => o.soh_running === a).soh_datetime, B = t.data.orders.find((o) => o.soh_running === b).soh_datetime; return B.localeCompare(A); }).join(',');
  check('เรียงใหม่→เก่า', sorted && runs[0] === 'E2E-SO-OPEN', runs.join(' → '));

  const rdy = t.data?.orders?.find((o) => o.soh_running === 'E2E-SO-RDY');
  const l2 = rdy?.lines?.find((l) => l.pro_code === 'E2E-OSP2'), l3 = rdy?.lines?.find((l) => l.pro_code === 'E2E-OSP3');
  const done = t.data?.orders?.find((o) => o.soh_running === 'E2E-SO-DONE');
  const open = t.data?.orders?.find((o) => o.soh_running === 'E2E-SO-OPEN');
  check('รายการ: RT = ขาดชั่วคราว · ตรวจนับขาด = short · เลขที่ใบกำกับ · บิลที่ยังไม่ถึงคลังใช้รายการตอนสั่ง',
    l2?.out_of_stock === true && l2.qc_price_total === 0 && l3?.short === true && l3.out_of_stock === false && rdy.out_of_stock_count === 1 && rdy.bill_number === 'E2E-IV-0005' && done?.bill_number === 'E2E-IV-0007' &&
      (!seed || (open?.lines?.length === 2 && open.sumprice === 260 && open.lines.some((l) => l.pro_name === 'E2E local หน้ากากอนามัย' && l.qty === 3))),
    `RDY: P2 rt=${l2?.out_of_stock} P3 short=${l3?.short} ขาด ${rdy?.out_of_stock_count} บิล ${rdy?.bill_number} · DONE ${done?.bill_number} · OPEN ${open?.lines?.length} รายการ ${open?.sumprice}`);

  const old = await call('GET', `/ecom/internal/order-status-table/${MEM}?date_from=${bkk(65)}&date_to=${bkk(55)}`, { headers: I });
  const far = await call('GET', `/ecom/internal/order-status-table/${MEM}?date_from=${bkk(400)}&date_to=${bkk(0)}`, { headers: I });
  check('ช่วงย้อนหลัง → เฉพาะบิลเก่า · เกิน 92 วัน → truncated', old.status === 200 && old.data.orders.map((o) => o.soh_running).join() === 'E2E-SO-OLD' && far.data?.truncated === true,
    `${old.data?.orders?.map((o) => o.soh_running).join() || '-'} · truncated=${far.data?.truncated} (${far.data?.date_from})`);

  const c1 = await call('GET', '/ecom/v2/order-status-table', { headers: { authorization: `Bearer ${jwtFor(MEM)}` } });
  const c2 = await call('GET', `/ecom/v2/order-status-table?mem_code=${MEM}`, { headers: { authorization: `Bearer ${jwtFor(MEM2)}` } });
  check('ลูกค้า: ได้ชุดเดียวกับ internal · ร้านอื่น login ไม่เห็นบิลร้านนี้', c1.status === 200 && c1.data.orders.length === 7 && c2.status === 200 && c2.data.mem_code === MEM2 && c2.data.orders.every((o) => o.soh_running === 'E2E-SO2-PICK'),
    `ร้าน ${MEM}: ${c1.status} ${c1.data?.orders?.length} บิล · ร้าน ${MEM2}: ${c2.data?.orders?.map((o) => o.soh_running).join() || '-'}`);

  const b = await call('POST', '/ecom/internal/order-status/batch', { headers: I, body: { items: [{ sh_running: 'E2E-SO-BLK', mem_code: MEM }, { sh_running: 'E2E-SO2-PICK', mem_code: MEM2 }, { sh_running: 'E2E-SO-DONE', mem_code: MEM }, { sh_running: 'E2E-SO-DONE', mem_code: MEM2 }] } });
  const bf = (r, m) => (Array.isArray(b.data) ? b.data : []).find((x) => x.sh_running === r && x.mem_code === m);
  check('batch หลายร้าน: สถานะ/ป้ายถูกต่อใบต่อร้าน (เลขบิลที่ไม่ใช่ของร้าน = ยังไม่ถึงคลัง)', (b.status === 201 || b.status === 200) &&
    bf('E2E-SO-BLK', MEM)?.status_label === 'รอบัญชีอนุมัติ' && bf('E2E-SO2-PICK', MEM2)?.status === 'picking' && bf('E2E-SO-DONE', MEM)?.status_label === 'จัดส่งสำเร็จ' && bf('E2E-SO-DONE', MEM2)?.status === 'opened',
    `HTTP ${b.status} · ${(Array.isArray(b.data) ? b.data : []).map((x) => `${x.mem_code}/${x.sh_running}=${x.status}`).join(' ')}`);

  if (fake) {
    await fetch(`${fake}/__down?on=1`);
    const d = await call('GET', `/ecom/internal/order-status-table/${MEM}`, { headers: I });
    await fetch(`${fake}/__down?on=0`);
    check('คลังล่ม → ไม่ 500 · partial=true · บิลจาก ecommerce ยังแสดง', d.status === 200 && d.data.partial === true && (!seed || d.data.orders.some((o) => o.soh_running === 'E2E-SO-OPEN')),
      `HTTP ${d.status} · partial=${d.data?.partial} · ${d.data?.orders?.length} บิล`);
  }
} catch (e) { failure = e; check('สคริปต์ทำงานจนจบ', false, e instanceof Error ? e.message : String(e)); }
finally { try { await cleanDb(); await db?.end(); } catch {} }

const passed = steps.filter((s) => s.pass).length;
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return '?'; } })();
const ts = new Date(Date.now() + 7 * 3600e3).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
mkdirSync('docs/e2e', { recursive: true });
const file = `docs/e2e/order-status-table-${env}-${ts}.md`;
writeFileSync(file, ['# E2E — สถานะออเดอร์แบบเว็บร้านค้าเดิม (ลูกค้า + ระบบขาย)', '',
  `- **environment:** \`${env}\`${env === 'local' ? ' (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)' : ''}`,
  `- **commit:** \`${commit}\` · **base:** ${base}${fake ? ` · คลัง/ขนส่งจำลอง ${fake}` : ''}`,
  `- ข้อมูลทดสอบ "E2E local" ${seed ? 'สร้างและลบในสคริปต์' : 'ไม่สร้าง (อ่านอย่างเดียว)'}`, '',
  `## ผล ${passed}/${steps.length}`, '', '| | ขั้น | ที่เห็น |', '|---|---|---|',
  ...steps.map((s) => `| ${s.pass ? 'PASS' : 'FAIL'} | ${s.name} | ${String(s.observed).replace(/\|/g, '\\|')} |`), ''].join('\n'));
console.log(`\n${passed}/${steps.length} → ${file}`);
process.exit(failure || passed !== steps.length ? 1 : 0);
