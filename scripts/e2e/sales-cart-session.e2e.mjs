#!/usr/bin/env node
/**
 * E2E: พนักงานขายขออนุญาตเข้าดูแลตะกร้าลูกค้า (Tim 18 ต.ค. 2569)
 *   ระบบขาย (x-internal-token): POST /api/ecom/internal/sales-cart-session · GET/:id · /:id/touch · /:id/phone-consent · /:id/end
 *   ลูกค้า (JWT): GET /api/ecom/sales-cart-session/current · POST /api/ecom/sales-cart-session/consent/:id · /api/ecom/sales-cart-consent(/withdraw)
 *
 *   1. ไม่มี internal token → 403 · ลูกค้าไม่มี JWT → 401
 *   2. ร้านยังไม่เคยอนุญาต → รอบ awaiting_consent + ลูกค้าเห็นคำขอ (ชื่อ/ชื่อเล่นเซลส์)
 *   3. ลูกค้ากดอนุญาต → active · ลูกค้าเห็นแถบกำลังดูแล + รายการ · ตอบซ้ำ 409
 *   4. ใบใหม่ของร้านเดิมใน 90 วัน → active ทันที (ไม่ถามซ้ำ)
 *   5. touch อัปเดตรายการ · end saved → ลูกค้าเห็น "สั่งให้แล้ว" · end ซ้ำไม่เปลี่ยน
 *   6. ร้านที่ 2: ลูกค้าไม่อนุญาต → denied · เซลส์กดยืนยันทางโทรศัพท์ → active (channel phone)
 *   7. ลูกค้าถอนความยินยอม → รอบที่ดูแลอยู่กลายเป็น denied · consent.granted=false
 *   8. ไม่มีความเคลื่อนไหว 30 นาที → จบเอง (idle) · ความยินยอมหมดอายุ (เกิน 90 วัน) → ถามใหม่
 *   9. ลูกค้าตอบคำขอของร้านอื่น → 404 · end discarded
 *
 *   E2E_ENV=local E2E_BASE_URL=http://127.0.0.1:3033 E2E_INTERNAL_TOKEN=<INTERNAL_API_TOKEN> ACCESS_TOKEN_SECRET=<…>
 *   DB_HOST=localhost DB_PORT DB_USERNAME DB_PASSWORD DB_NAME   (สร้าง/ลบข้อมูล "E2E local" เอง — localhost เท่านั้น)
 * ผล: docs/e2e/sales-cart-session-<env>-<timestamp>.md
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const env = (process.env.E2E_ENV || '').trim();
const base = (process.env.E2E_BASE_URL || '').replace(/\/+$/, '');
const token = process.env.E2E_INTERNAL_TOKEN || process.env.INTERNAL_API_TOKEN || '';
const secret = process.env.ACCESS_TOKEN_SECRET || '';
if (env !== 'local' || !base || !token || !secret || !/^(localhost|127\.0\.0\.1)$/.test(process.env.DB_HOST ?? '')) {
  console.error('ต้องตั้ง E2E_ENV=local, E2E_BASE_URL, E2E_INTERNAL_TOKEN, ACCESS_TOKEN_SECRET, DB_* (localhost)');
  process.exit(2);
}
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
const q = async (sql, args = []) => (await db.query(sql, args))[0];

const M1 = 'E2E-SCS1', M2 = 'E2E-SCS2', M3 = 'E2E-SCS3';
const cust = (m) => jwt.sign({ username: `e2e-local-${m}`, name: `E2E local ${m}`, mem_code: m }, secret, { expiresIn: '1h' });
const SALES = { emp_code: 'E2E-0743', sales_name: 'E2E นุช', sales_nick: 'นุช' };

const steps = [];
const check = (name, pass, observed) => { steps.push({ name, pass: !!pass, observed }); console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`); };
const call = async (method, path, { body, internal = true, as } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (internal === true) headers['x-internal-token'] = token;
  if (as) headers.authorization = `Bearer ${as}`;
  const res = await fetch(`${base}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: res.status, data };
};
const clean = async () => {
  await q('DELETE FROM sales_cart_session WHERE mem_code IN (?)', [[M1, M2, M3]]);
  await q('DELETE FROM sales_cart_consent WHERE mem_code IN (?)', [[M1, M2, M3]]);
};
const start = (mem, draft, lines = [{ pro_code: 'E2E-CP1', unit: 'กล่อง', qty: 2, name: 'E2E local พารา' }]) =>
  call('POST', '/ecom/internal/sales-cart-session', { body: { mem_code: mem, draft_ref: draft, lines, ...SALES } });

let failure;
try {
  await clean();
  const noTok = await call('POST', '/ecom/internal/sales-cart-session', { body: { mem_code: M1 }, internal: false });
  const noJwt = await call('GET', '/ecom/sales-cart-session/current', { internal: false });
  check('ไม่มี internal token → 403 · ลูกค้าไม่มี JWT → 401', noTok.status === 403 && noJwt.status === 401, `${noTok.status} / ${noJwt.status}`);

  const s1 = await start(M1, 'E2E-SO-1');
  const cur1 = await call('GET', '/ecom/sales-cart-session/current', { internal: false, as: cust(M1) });
  check('ยังไม่เคยอนุญาต → awaiting_consent · ลูกค้าเห็นคำขอพร้อมชื่อ/ชื่อเล่น',
    s1.status === 200 && s1.data.status === 'awaiting_consent' && cur1.data?.request?.sales_name === 'E2E นุช' && cur1.data.request.sales_nick === 'นุช' && !cur1.data.session,
    `${s1.data?.status} · request ${JSON.stringify(cur1.data?.request)}`);

  const allow = await call('POST', `/ecom/sales-cart-session/consent/${cur1.data.request.id}`, { internal: false, as: cust(M1), body: { decision: 'allow', channel: 'web' } });
  const g1 = await call('GET', `/ecom/internal/sales-cart-session/${s1.data.id}`);
  const again = await call('POST', `/ecom/sales-cart-session/consent/${cur1.data.request.id}`, { internal: false, as: cust(M1), body: { decision: 'deny' } });
  check('ลูกค้าอนุญาต → active · ลูกค้าเห็นแถบดูแล + รายการ · ตอบซ้ำ 409',
    allow.status === 200 && allow.data.session?.lines?.[0]?.pro_code === 'E2E-CP1' && allow.data.consent.granted && allow.data.consent.expires_in_days >= 89 &&
      g1.data.status === 'active' && g1.data.consent?.channel === 'web' && again.status === 409,
    `session ${allow.data?.session?.id?.slice(0, 8)} · sale เห็น ${g1.data?.status}/${g1.data?.consent?.channel} · อายุ ${allow.data?.consent?.expires_in_days} วัน · ซ้ำ ${again.status}`);

  const touch = await call('POST', `/ecom/internal/sales-cart-session/${s1.data.id}/touch`, { body: { lines: [{ pro_code: 'E2E-CP1', unit: 'กล่อง', qty: 2 }, { pro_code: 'E2E-CP2', unit: 'ขวด', qty: 1 }] } });
  const ended = await call('POST', `/ecom/internal/sales-cart-session/${s1.data.id}/end`, { body: { reason: 'saved' } });
  const endAgain = await call('POST', `/ecom/internal/sales-cart-session/${s1.data.id}/end`, { body: { reason: 'discarded' } });
  const cur2 = await call('GET', '/ecom/sales-cart-session/current', { internal: false, as: cust(M1) });
  check('touch อัปเดตรายการ · end saved → ลูกค้าเห็น "สั่งให้แล้ว" · end ซ้ำไม่เปลี่ยน',
    touch.data.lines.length === 2 && ended.data.status === 'ended' && ended.data.end_reason === 'saved' && endAgain.data.end_reason === 'saved' && cur2.data.saved?.sales_nick === 'นุช' && !cur2.data.session,
    `lines ${touch.data?.lines?.length} · ${ended.data?.end_reason}/${endAgain.data?.end_reason} · saved ${!!cur2.data?.saved}`);

  const s2 = await start(M1, 'E2E-SO-2');
  check('ใบใหม่ของร้านเดิมใน 90 วัน → active ทันที ไม่ถามซ้ำ', s2.data.status === 'active' && s2.data.consent?.status === 'granted', `${s2.data?.status}`);
  const replaced = await start(M1, 'E2E-SO-3');
  const oldS2 = await call('GET', `/ecom/internal/sales-cart-session/${s2.data.id}`);
  check('เปิดใบอื่นของร้านเดิม → รอบเก่าจบแบบ replaced', replaced.data.id !== s2.data.id && oldS2.data.end_reason === 'replaced', `${oldS2.data?.end_reason}`);

  const d1 = await start(M2, 'E2E-SO-4');
  const curD = await call('GET', '/ecom/sales-cart-session/current', { internal: false, as: cust(M2) });
  const deny = await call('POST', `/ecom/sales-cart-session/consent/${curD.data.request.id}`, { internal: false, as: cust(M2), body: { decision: 'deny', channel: 'app' } });
  const gD = await call('GET', `/ecom/internal/sales-cart-session/${d1.data.id}`);
  const phone = await call('POST', `/ecom/internal/sales-cart-session/${d1.data.id}/phone-consent`, { body: { emp_code: 'E2E-0743' } });
  const rowPhone = (await q("SELECT channel, decided_by FROM sales_cart_consent WHERE mem_code = ? AND status = 'granted'", [M2]))[0];
  check('ลูกค้าไม่อนุญาต → denied · เซลส์กดยืนยันทางโทรศัพท์ → active (phone, บันทึกผู้กด)',
    deny.status === 200 && !deny.data.session && gD.data.status === 'denied' && phone.data.status === 'active' && phone.data.consent?.channel === 'phone' && rowPhone?.decided_by === 'E2E-0743',
    `${gD.data?.status} → ${phone.data?.status} · ${rowPhone?.channel}/${rowPhone?.decided_by}`);

  const wd = await call('POST', '/ecom/sales-cart-consent/withdraw', { internal: false, as: cust(M2) });
  const gW = await call('GET', `/ecom/internal/sales-cart-session/${d1.data.id}`);
  const s5 = await start(M2, 'E2E-SO-5');
  check('ลูกค้าถอนความยินยอม → รอบที่ดูแลอยู่เป็น denied · ใบต่อไปต้องถามใหม่',
    wd.data.consent.granted === false && gW.data.status === 'denied' && s5.data.status === 'awaiting_consent', `${gW.data?.status} · ใบใหม่ ${s5.data?.status}`);

  await q('UPDATE sales_cart_session SET last_activity_at = NOW(6) - INTERVAL 31 MINUTE WHERE id = ?', [s5.data.id]);
  const idle = await call('GET', `/ecom/internal/sales-cart-session/${s5.data.id}`);
  const curIdle = await call('GET', '/ecom/sales-cart-session/current', { internal: false, as: cust(M2) });
  await q("UPDATE sales_cart_consent SET expires_at = NOW(6) - INTERVAL 1 DAY WHERE mem_code = ? AND status = 'granted'", [M1]);
  const s6 = await start(M1, 'E2E-SO-6');
  check('ไม่มีความเคลื่อนไหว 30 นาที → จบเอง (คำขอหายจากลูกค้า) · ความยินยอมเกิน 90 วัน → ถามใหม่',
    idle.data.status === 'ended' && idle.data.end_reason === 'idle' && !curIdle.data.request && s6.data.status === 'awaiting_consent',
    `${idle.data?.end_reason} · ร้าน1 ใบใหม่ ${s6.data?.status}`);

  const s7 = await start(M3, 'E2E-SO-7');
  const req7 = (await q("SELECT id FROM sales_cart_consent WHERE mem_code = ? AND status = 'pending'", [M3]))[0];
  const cross = await call('POST', `/ecom/sales-cart-session/consent/${req7.id}`, { internal: false, as: cust(M1), body: { decision: 'allow' } });
  const disc = await call('POST', `/ecom/internal/sales-cart-session/${s7.data.id}/end`, { body: { reason: 'discarded' } });
  const st7 = (await q('SELECT status FROM sales_cart_consent WHERE id = ?', [req7.id]))[0];
  const badReason = await call('POST', `/ecom/internal/sales-cart-session/${s7.data.id}/end`, { body: { reason: 'x' } });
  check('ตอบคำขอของร้านอื่น → 404 · ทิ้งใบร่าง → discarded + คำขอหมดอายุ · reason ผิด 400',
    cross.status === 404 && disc.data.end_reason === 'discarded' && st7.status === 'expired' && badReason.status === 400,
    `${cross.status} · ${disc.data?.end_reason} · คำขอ ${st7.status} · ${badReason.status}`);
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
const file = `docs/e2e/sales-cart-session-${env}-${ts}.md`;
writeFileSync(file, [
  '# E2E — พนักงานขายขออนุญาตเข้าดูแลตะกร้าลูกค้า', '',
  `- **environment:** \`${env}\` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)`,
  `- **commit:** \`${commit}\` · **base:** ${base}`,
  '- ข้อมูลทดสอบ E2E-SCS1..3 (สร้าง/ลบเอง)', '',
  `## ผล ${passed}/${steps.length}`, '',
  '| | ขั้น | ที่เห็น |', '|---|---|---|',
  ...steps.map((s) => `| ${s.pass ? 'PASS' : 'FAIL'} | ${s.name} | ${String(s.observed).replace(/\|/g, '\\|')} |`), '',
].join('\n'));
console.log(`\n${passed}/${steps.length} → ${file}`);
process.exit(failure || passed !== steps.length ? 1 : 0);
