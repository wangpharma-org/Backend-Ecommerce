#!/usr/bin/env node
/**
 * E2E: ตะกร้าลูกค้าให้ระบบขาย — GET /api/ecom/internal/customer-cart/:mem_code (x-internal-token)
 *
 *   1. ไม่มี token / token ผิด → 403 · mem_code ยาวเกิน → 400
 *   2. ร้านทดสอบ: ได้บรรทัดสินค้าในตะกร้า ไม่รวมของแถม (is_reward / hotdeal_free) · หน่วย/จำนวน/เวลาใส่
 *   3. ราคา: ระดับราคาร้าน × ratio หน่วย · ถึงขั้นโปรเดือน → ราคา A · ธง monthly / flash_sale
 *   4. ร้านที่ตะกร้าว่าง → lines = []
 *   (E2E_SEED_DB=1 เท่านั้น — แก้ตะกร้า) POST .../consume และ .../restore (ระบบขายลด/คืนของในตะกร้า):
 *   5. ไม่มี token 403 · ไม่มี order_ref / qty ≤ 0 → 400
 *   6. ลดพอดี (P1 1 กล่อง จาก 2) · ส่งซ้ำ order_ref เดิม = replay ไม่ลดซ้ำ · ไม่แตะของแถม
 *   7. ลดบางส่วนเป็นหน่วยเล็ก (P2 15 ชิ้น จาก 3 กล่อง=30) → เหลือ 2 กล่อง (เศษปัดขึ้น ไม่ลดเกินที่สั่ง)
 *   8. สั่งเกินของในตะกร้า → ลบแถว + not_in_cart บอกส่วนเกิน
 *   9. คืน (ยกเลิกใบ) → คืนเฉพาะที่ order_ref นั้นลด · ส่งซ้ำไม่คืนซ้ำ · ลูกค้าใส่เพิ่มระหว่างนั้น = บวกเพิ่ม · ref ที่ไม่เคยลด = ไม่คืนอะไร
 *
 *   E2E_ENV=local|dev|staging|prod E2E_BASE_URL=http://127.0.0.1:3033 E2E_INTERNAL_TOKEN=<INTERNAL_API_TOKEN>
 *   [E2E_SEED_DB=1 + DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME — localhost เท่านั้น: สร้าง/ลบข้อมูล "E2E local" เอง]
 *   node scripts/e2e/customer-cart.e2e.mjs
 * ผล: docs/e2e/customer-cart-<env>-<timestamp>.md + exit code 0/1
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const env = (process.env.E2E_ENV || '').trim();
const base = (process.env.E2E_BASE_URL || '').replace(/\/+$/, '');
const token = process.env.E2E_INTERNAL_TOKEN || '';
if (!['local', 'dev', 'staging', 'prod'].includes(env) || !base || !token) {
  console.error('ต้องตั้ง E2E_ENV, E2E_BASE_URL, E2E_INTERNAL_TOKEN');
  process.exit(2);
}
const seed = process.env.E2E_SEED_DB === '1';
if (seed && !/^(localhost|127\.0\.0\.1)$/.test(process.env.DB_HOST ?? '')) {
  console.error('E2E_SEED_DB ใช้ได้กับ DB_HOST=localhost เท่านั้น');
  process.exit(2);
}
const MEM = 'E2E-CART1', EMPTY = 'E2E-CART0';
const P1 = 'E2E-CP1', P2 = 'E2E-CP2', G1 = 'E2E-CG1';
const month = new Date(Date.now() + 7 * 3600e3).getUTCMonth() + 1;
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

let db;
const q = async (sql, args = []) => (await db.query(sql, args))[0];
async function clean() {
  const fs = (await q("SELECT promotion_id FROM flashsale WHERE promotion_name = 'E2E local Flash ตะกร้า'")).map((r) => r.promotion_id);
  if (fs.length) { await q('DELETE FROM flashsale_products WHERE promotion_id IN (?)', [fs]); await q('DELETE FROM flashsale WHERE promotion_id IN (?)', [fs]); }
  await q('DELETE FROM shopping_cart WHERE mem_code IN (?, ?)', [MEM, EMPTY]);
  await q("DELETE FROM internal_cart_adjustment WHERE order_ref LIKE 'E2E-CART-%'").catch(() => {});
  await q('DELETE FROM product_unit WHERE pro_code IN (?, ?, ?)', [P1, P2, G1]);
  await q('DELETE FROM product WHERE pro_code IN (?, ?, ?)', [P1, P2, G1]);
  await q('DELETE FROM users WHERE mem_code IN (?, ?)', [MEM, EMPTY]);
}
async function doSeed() {
  await clean();
  for (const m of [MEM, EMPTY]) await q('INSERT INTO users (mem_code, mem_username, mem_password, mem_route, mem_nameSite, mem_price) VALUES (?, ?, ?, ?, ?, ?)', [m, `e2e-local-${m}`, 'x', 'L03', `E2E local ร้าน ${m}`, 'B']);
  for (const [code, name, a, b, c, pm, pa] of [
    [P1, 'E2E local ยาตะกร้า 1', 5, 6, 7, null, null],
    [P2, 'E2E local ยาตะกร้า 2 (โปรเดือน)', 9, 10, 11, month, 20],
    [G1, 'E2E local ของแถม', 0, 0, 0, null, null],
  ]) {
    await q('INSERT INTO product (pro_code, pro_name, pro_nameTH, pro_l16_only, pro_priceA, pro_priceB, pro_priceC, pro_promotion_month, pro_promotion_amount) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)', [code, name, name, a, b, c, pm, pa]);
    await q("INSERT INTO product_unit (pro_code, unit_name, ratio, level) VALUES (?, 'ชิ้น', 1, 1), (?, 'กล่อง', 10, 2)", [code, code]);
  }
  const fsId = (await q("INSERT INTO flashsale (promotion_name, date, time_start, time_end, is_active) VALUES ('E2E local Flash ตะกร้า', ?, '00:00:00', '23:59:00', 1)", [today])).insertId;
  await q('INSERT INTO flashsale_products (promotion_id, pro_code, `limit`) VALUES (?, ?, 5)', [fsId, P1]);
  const ins = (code, qty, unit, at, extra = {}) => q('INSERT INTO shopping_cart (spc_amount, pro_code, mem_code, spc_checked, is_reward, hotdeal_free, spc_unit_enum, spc_datetime) VALUES (?, ?, ?, 1, ?, ?, ?, ?)', [qty, code, MEM, extra.reward ? 1 : 0, extra.hotdeal ? 1 : 0, unit, at]);
  await ins(P1, 2, '2', '2026-10-15 09:00:00');
  await ins(P2, 3, '2', '2026-10-17 10:30:00');
  await ins(G1, 2, '1', '2026-10-17 10:30:00', { reward: true });
  await ins(G1, 1, '1', '2026-10-17 10:31:00', { hotdeal: true });
}

const steps = [];
const check = (name, pass, observed) => { steps.push({ name, pass: !!pass, observed }); console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`); };
const post = async (path, body, tok = token) => {
  const res = await fetch(`${base}/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { 'x-internal-token': tok } : {}) }, body: JSON.stringify(body) });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
};
const cartNow = async () => Object.fromEntries((await q('SELECT pro_code, spc_unit_enum, SUM(spc_amount) AS qty FROM shopping_cart WHERE mem_code = ? AND is_reward = 0 AND hotdeal_free = 0 GROUP BY pro_code, spc_unit_enum', [MEM])).map((r) => [`${r.pro_code}@${r.spc_unit_enum}`, Number(r.qty)]));
const get = async (path, tok = token) => {
  const res = await fetch(`${base}/api${path}`, { headers: tok ? { 'x-internal-token': tok } : {} });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

let failure;
try {
  if (seed) {
    const require = createRequire(import.meta.url);
    const mysql = require('mysql2/promise');
    db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
    await doSeed();
  }
  const [noTok, badTok, longCode] = await Promise.all([get(`/ecom/internal/customer-cart/${MEM}`, ''), get(`/ecom/internal/customer-cart/${MEM}`, 'wrong'), get(`/ecom/internal/customer-cart/${'X'.repeat(31)}`)]);
  check('ไม่มี token / token ผิด → 403 · mem_code ยาวเกิน → 400', noTok.status === 403 && badTok.status === 403 && longCode.status === 400, `${noTok.status} / ${badTok.status} / ${longCode.status}`);

  const r = await get(`/ecom/internal/customer-cart/${MEM}`);
  const lines = r.data?.lines ?? [];
  const codes = lines.map((l) => l.pro_code);
  check('ร้านทดสอบ: 2 บรรทัด ไม่รวมของแถม (is_reward / hotdeal_free) · เรียงใส่ล่าสุดก่อน', r.status === 200 && codes.join() === `${P2},${P1}`, `HTTP ${r.status} · ${codes.join() || '-'}`);
  const l1 = lines.find((l) => l.pro_code === P1), l2 = lines.find((l) => l.pro_code === P2);
  check('หน่วย/จำนวน/เวลาใส่ ครบ', l1?.unit === 'กล่อง' && l1?.qty === 2 && l1?.unit_level === 2 && String(l1?.added_at).startsWith('2026-10-15'), `${l1?.unit} × ${l1?.qty} (level ${l1?.unit_level}) · ${l1?.added_at}`);
  check('ราคา: ระดับ B × ratio 10 = 60/กล่อง · ธง flash_sale', l1?.unit_price === 60 && l1?.line_total === 120 && l1?.promo?.flash_sale === true && l1?.promo?.monthly === false, `P1 ${l1?.unit_price}/${l1?.line_total} · ${JSON.stringify(l1?.promo)}`);
  check('ถึงขั้นโปรเดือน (30 ≥ 20 ชิ้น) → ราคา A × 10 = 90 · ธง monthly', l2?.unit_price === 90 && l2?.line_total === 270 && l2?.promo?.monthly === true, `P2 ${l2?.unit_price}/${l2?.line_total} · ${JSON.stringify(l2?.promo)}`);
  check('price_option ของร้าน = B', r.data?.price_option === 'B', `${r.data?.price_option}`);
  const empty = await get(`/ecom/internal/customer-cart/${EMPTY}`);
  check('ร้านตะกร้าว่าง → lines = []', empty.status === 200 && Array.isArray(empty.data?.lines) && empty.data.lines.length === 0, `HTTP ${empty.status} · ${empty.data?.lines?.length}`);
  if (seed) {
    const C = `/ecom/internal/customer-cart/${MEM}`;
    const [nt, noRef, zero] = await Promise.all([post(`${C}/consume`, { order_ref: 'E2E-CART-X', lines: [] }, ''), post(`${C}/consume`, { lines: [{ pro_code: P1, qty: 1 }] }), post(`${C}/consume`, { order_ref: 'E2E-CART-X', lines: [{ pro_code: P1, qty: 0 }] })]);
    check('consume: ไม่มี token 403 · ไม่มี order_ref 400 · qty ≤ 0 → 400', nt.status === 403 && noRef.status === 400 && zero.status === 400, `${nt.status} / ${noRef.status} / ${zero.status}`);
    const a = await post(`${C}/consume`, { order_ref: 'E2E-CART-A', lines: [{ pro_code: P1, unit: 'กล่อง', qty: 1 }] });
    const afterA = await cartNow();
    const a2 = await post(`${C}/consume`, { order_ref: 'E2E-CART-A', lines: [{ pro_code: P1, unit: 'กล่อง', qty: 1 }] });
    const afterA2 = await cartNow();
    check('ลดพอดี P1 1 กล่อง (2→1) · ส่งซ้ำ ref เดิม = replay ไม่ลดซ้ำ · ไม่แตะของแถม', a.status === 200 && afterA[`${P1}@2`] === 1 && a.data?.rows?.length === 1 && a.data.rows[0].qty === 1 && !a.data.rows.some((r) => r.pro_code === G1) && a2.data?.replay === true && afterA2[`${P1}@2`] === 1, `HTTP ${a.status} · ${JSON.stringify(a.data?.rows)} · หลังส่งซ้ำ replay=${a2.data?.replay} P1=${afterA2[`${P1}@2`]}`);
    const b = await post(`${C}/consume`, { order_ref: 'E2E-CART-B', lines: [{ pro_code: P2, unit: 'ชิ้น', qty: 15 }] });
    const afterB = await cartNow();
    check('ลดบางส่วนเป็นหน่วยเล็ก: P2 15 ชิ้น จาก 3 กล่อง (30) → เหลือ 2 กล่อง (เศษปัดขึ้น)', b.status === 200 && afterB[`${P2}@2`] === 2 && b.data?.rows?.[0]?.qty === 1, `HTTP ${b.status} · P2=${afterB[`${P2}@2`]} · ${JSON.stringify(b.data?.rows)}`);
    const c = await post(`${C}/consume`, { order_ref: 'E2E-CART-C', lines: [{ pro_code: P1, unit: 'กล่อง', qty: 5 }] });
    const afterC = await cartNow();
    check('สั่งเกินของในตะกร้า: P1 5 กล่อง (มี 1) → ลบแถว · not_in_cart 40 ชิ้น', c.status === 200 && afterC[`${P1}@2`] === undefined && c.data?.not_in_cart?.[0]?.base_qty === 40, `HTTP ${c.status} · P1=${afterC[`${P1}@2`]} · ${JSON.stringify(c.data?.not_in_cart)}`);
    const rc = await post(`${C}/restore`, { order_ref: 'E2E-CART-C' });
    const afterRc = await cartNow();
    const rc2 = await post(`${C}/restore`, { order_ref: 'E2E-CART-C' });
    const afterRc2 = await cartNow();
    check('คืน ref C → P1 กลับ 1 กล่อง (ใส่แถวใหม่) · ส่งซ้ำไม่คืนซ้ำ', rc.status === 200 && afterRc[`${P1}@2`] === 1 && rc2.data?.replay === true && afterRc2[`${P1}@2`] === 1, `HTTP ${rc.status} · P1=${afterRc[`${P1}@2`]} · replay=${rc2.data?.replay} → ${afterRc2[`${P1}@2`]}`);
    const ra = await post(`${C}/restore`, { order_ref: 'E2E-CART-A' });
    const afterRa = await cartNow();
    const rn = await post(`${C}/restore`, { order_ref: 'E2E-CART-NEVER' });
    check('คืน ref A ขณะตะกร้ามีของอยู่แล้ว → บวกเพิ่ม (1→2) · ref ที่ไม่เคยลด = ไม่คืนอะไร', ra.status === 200 && afterRa[`${P1}@2`] === 2 && rn.status === 200 && rn.data?.rows?.length === 0, `P1=${afterRa[`${P1}@2`]} · never=${rn.status} rows ${rn.data?.rows?.length}`);
  }
} catch (e) {
  failure = e; check('สคริปต์ทำงานจนจบ', false, e instanceof Error ? e.message : String(e));
} finally {
  if (db) { try { await clean(); check('เก็บกวาด: ลบข้อมูล E2E local ที่สร้าง', true, 'ok'); } catch (e) { check('เก็บกวาด', false, String(e)); } await db.end(); }
}

const passed = steps.filter((s) => s.pass).length;
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return '?'; } })();
const ts = new Date(Date.now() + 7 * 3600e3).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
mkdirSync('docs/e2e', { recursive: true });
const file = `docs/e2e/customer-cart-${env}-${ts}.md`;
writeFileSync(file, ['# E2E — ตะกร้าลูกค้าให้ระบบขาย (internal customer-cart)', '', `- **environment:** \`${env}\`${env === 'local' ? ' (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)' : ''}`, `- **commit:** \`${commit}\` · **base:** ${base}`, `- ข้อมูลทดสอบ: ${seed ? 'สร้าง "E2E local" เองแล้วลบตอนจบ' : 'ใช้ข้อมูลที่มีอยู่ (อ่านอย่างเดียว)'}`, '', `## ผล ${passed}/${steps.length}`, '', '| | ขั้น | ที่เห็น |', '|---|---|---|', ...steps.map((s) => `| ${s.pass ? 'PASS' : 'FAIL'} | ${s.name} | ${String(s.observed).replace(/\|/g, '\\|')} |`), ''].join('\n'));
console.log(`\n${passed}/${steps.length} → ${file}`);
process.exit(failure || passed !== steps.length ? 1 : 0);
