/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
/**
 * E2E: POST /ecom/internal/checkout-preview (หน้ากิมมิคหลังหน้า Key ขายของระบบขาย)
 *
 * พิสูจน์ว่า preview คิดเหมือนตะกร้าจริงทุกประการ: ใส่บรรทัดชุดเดียวกันลงตะกร้าของร้านทดสอบผ่าน
 * POST /ecom/product-add-cart (token ลูกค้าที่เซ็นด้วย ACCESS_TOKEN_SECRET ของ server ทดสอบ) แล้วเทียบ
 * ยอดตะกร้า / บรรทัดของแถมโปร (is_reward) / ของแถม Hot Deal (hotdeal_free) กับคำตอบของ preview
 *
 *   E2E_ENV=local BASE_URL=http://127.0.0.1:3036/api INTERNAL_API_TOKEN=... ACCESS_TOKEN_SECRET=... \
 *   DB_HOST=127.0.0.1 DB_PORT=... DB_USERNAME=... DB_PASSWORD=... DB_NAME=ecommerce_e2e_gimmick \
 *   npx ts-node scripts/e2e/checkout-preview.e2e.ts
 *
 * ข้อมูลทดสอบ: ร้าน E2E-C01 (ราคา C) และ E2E-L16 (เส้น L16), สินค้า/โปร "E2E local" จาก seed-ecom-promos + seed-gimmick-ecom
 * จบแล้วล้างตะกร้าของสองร้านทดสอบ · ผล: docs/e2e/checkout-preview-<env>-<timestamp>.md
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { JwtService } from '@nestjs/jwt';
import {
  createConnection,
  type Connection,
  type RowDataPacket,
} from 'mysql2/promise';

const BASE = (process.env.BASE_URL ?? '').replace(/\/+$/, '');
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE);
const ENV = process.env.E2E_ENV ?? '';
if (!BASE || ENV !== 'local' || !IS_LOCAL) {
  console.error(
    'สคริปต์นี้เขียนตะกร้าของร้านทดสอบ — รันได้เฉพาะ E2E_ENV=local กับ BASE_URL localhost',
  );
  process.exit(2);
}
const INTERNAL = process.env.INTERNAL_API_TOKEN ?? '';
const jwt = new JwtService({ secret: process.env.ACCESS_TOKEN_SECRET });

type Line = { pro_code: string; unit: string; qty: number };
const steps: { name: string; pass: boolean; observed: string }[] = [];
const check = (name: string, pass: boolean, observed: string) => {
  steps.push({ name, pass, observed });
  console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`);
};

async function preview(
  mem_code: string,
  lines: Line[],
  redeem?: { pro_code: string; amount: number }[],
  token = INTERNAL,
) {
  const res = await fetch(`${BASE}/ecom/internal/checkout-preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': token },
    body: JSON.stringify({ mem_code, lines, ...(redeem ? { redeem } : {}) }),
  });
  return {
    status: res.status,
    data: await res.json().catch(() => null),
  };
}

/** ใส่บรรทัดลงตะกร้าจริงทีละบรรทัด แล้วอ่านยอด + ของแถมที่ตะกร้าสร้าง */
let db: Connection;
const clearCart = (mem: string) =>
  db.query('DELETE FROM shopping_cart WHERE mem_code = ?', [mem]);

async function viaCart(mem: string, route: string, lines: Line[]) {
  await clearCart(mem);
  const token = jwt.sign(
    {
      username: `e2e-${mem}`,
      mem_code: mem,
      price_option: 'C',
      mem_route: route,
    },
    { expiresIn: '10m' },
  );
  let total = 0;
  for (const l of lines) {
    // หน้าเว็บส่ง flashsale_end ("วันที่ เวลาจบ") เมื่อสินค้าอยู่ใน Flash Sale ที่กำลังเปิด — ทำแบบเดียวกัน
    const [fs] = await db.query<RowDataPacket[]>(
      "SELECT DATE_FORMAT(f.date, '%Y-%m-%d') AS d, f.time_end AS t FROM flashsale f JOIN flashsale_products p ON p.promotion_id = f.promotion_id WHERE p.pro_code = ? AND f.is_active = 1 AND f.date = CURDATE() AND CURTIME() >= f.time_start AND CURTIME() < f.time_end LIMIT 1",
      [l.pro_code],
    );
    const flashsale_end = fs[0] ? `${fs[0].d} ${fs[0].t}` : undefined;
    const res = await fetch(`${BASE}/ecom/product-add-cart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        mem_code: mem,
        pro_code: l.pro_code,
        pro_unit: l.unit,
        amount: l.qty,
        flashsale_end,
      }),
    });
    const body: any = await res.json().catch(() => null);
    if (res.status >= 300)
      throw new Error(
        `add-cart ${l.pro_code} HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`,
      );
    total = Number(body?.summaryCart ?? total);
  }
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT c.pro_code, c.spc_amount, c.spc_unit_enum, c.is_reward, c.hotdeal_free, c.promo_id FROM shopping_cart c WHERE c.mem_code = ? AND (c.is_reward = 1 OR c.hotdeal_free = 1)',
    [mem],
  );
  const promo = rows
    .filter((r) => r.is_reward)
    .map((r) => `${r.pro_code}|${Number(r.spc_amount)}|${r.promo_id}`)
    .sort();
  const hot = rows
    .filter((r) => r.hotdeal_free)
    .map((r) => `${r.pro_code}|${Number(r.spc_amount)}`)
    .sort();
  return { total, promo, hot };
}
const fromPreview = (d: any) => ({
  total: Number(d.total),
  promo: d.gifts
    .filter((g: any) => g.kind === 'promotion')
    .map((g: any) => `${g.pro_code}|${g.qty}|${g.promo_id}`)
    .sort(),
  hot: d.gifts
    .filter((g: any) => g.kind === 'hotdeal')
    .map((g: any) => `${g.pro_code}|${g.qty}`)
    .sort(),
});
const same = (
  a: ReturnType<typeof fromPreview>,
  b: Awaited<ReturnType<typeof viaCart>>,
) =>
  Math.abs(a.total - b.total) < 0.005 &&
  JSON.stringify(a.promo) === JSON.stringify(b.promo) &&
  JSON.stringify(a.hot) === JSON.stringify(b.hot);
const show = (x: { total: number; promo: string[]; hot: string[] }) =>
  `ยอด ${x.total} · โปร [${x.promo.join(', ')}] · hotdeal [${x.hot.join(', ')}]`;

async function main() {
  db = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });

  let failure: unknown;
  try {
    // 1. guard + body
    const noToken = await preview(
      'E2E-C01',
      [{ pro_code: 'E2E-P01', unit: 'กล่อง', qty: 1 }],
      undefined,
      'wrong',
    );
    const bad = await fetch(`${BASE}/ecom/internal/checkout-preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': INTERNAL,
      },
      body: JSON.stringify({ lines: [] }),
    });
    check(
      'token ผิด → 403 · body ไม่มีร้าน → 400',
      noToken.status === 403 && bad.status === 400,
      `${noToken.status} / ${bad.status}`,
    );

    // 2. ขั้น 1 + Wang Day หลายเท่า + Hot Deal — ตรงกับตะกร้าจริง
    const lines1: Line[] = [
      { pro_code: 'E2E-P01', unit: 'กล่อง', qty: 35 },
      { pro_code: 'E2E-P02', unit: 'กล่อง', qty: 4 },
    ];
    const p1 = await preview('E2E-C01', lines1);
    const c1 = await viaCart('E2E-C01', 'L03', lines1);
    check(
      '35+4 กล่อง: preview = ตะกร้าจริง (ยอด, ของแถมโปร, Hot Deal)',
      p1.status === 200 && same(fromPreview(p1.data), c1),
      `preview ${show(fromPreview(p1.data))} | ตะกร้า ${show(c1)}`,
    );

    // 3. ขั้น 2 (หลายขั้น) + หน่วยลัง (×10) — ตรงกับตะกร้าจริง
    const lines2: Line[] = [{ pro_code: 'E2E-P01', unit: 'ลัง', qty: 7 }];
    const p2 = await preview('E2E-C01', lines2);
    const c2 = await viaCart('E2E-C01', 'L03', lines2);
    const tiers2 = (p2.data?.promotions ?? []).flatMap((p: any) =>
      p.tiers.map((t: any) => `${t.tier_name}×${t.multiplier}`),
    );
    check(
      '7 ลัง (= 70 กล่อง, ยอด 7,000) ถึงขั้น 2: preview = ตะกร้าจริง',
      p2.status === 200 &&
        same(fromPreview(p2.data), c2) &&
        tiers2.some((t: string) => t.startsWith('ขั้น 2')),
      `ขั้นที่ถึง ${tiers2.join(', ')} · preview ${show(fromPreview(p2.data))} | ตะกร้า ${show(c2)}`,
    );

    // 4. L16: ของแถม pro_l16_only ไม่ได้ — ตรงกับตะกร้าจริง
    const pL = await preview('E2E-L16', lines1);
    const cL = await viaCart('E2E-L16', 'L16', lines1);
    const hasG02 = (pL.data?.gifts ?? []).some(
      (g: any) => g.pro_code === 'E2E-G02',
    );
    check(
      'ร้าน L16: ไม่มี E2E-G02 (pro_l16_only) และ preview = ตะกร้าจริง',
      pL.data?.is_l16 === true && !hasG02 && same(fromPreview(pL.data), cL),
      `is_l16=${pL.data?.is_l16} · มี G02=${hasG02} · preview ${show(fromPreview(pL.data))} | ตะกร้า ${show(cL)}`,
    );

    // 5. Happy Hour (ช่วงทั้งวันในฐานทดสอบ): ครบ 3,000 → การ์ด = floor(ยอด/3000)
    const hh = p2.data?.happy_hour;
    const hhGift = (p2.data?.gifts ?? []).find(
      (g: any) => g.kind === 'happy_hour',
    );
    check(
      'Happy Hour: ยอด 7,000 → 2 การ์ด ได้ E2E-G01 × 2',
      hh?.num_cards === 2 && hhGift?.qty === 2,
      `num_cards=${hh?.num_cards} · ของแถม ${hhGift?.pro_code} × ${hhGift?.qty}`,
    );

    // 6. แต้ม = ยอด × 1% มีทศนิยม (สูตรหน้า /list-free)
    const p3 = await preview('E2E-C01', [
      { pro_code: 'E2E-P01', unit: 'กล่อง', qty: 3 },
      { pro_code: 'E2E-P02', unit: 'กล่อง', qty: 1 },
    ]);
    check(
      'แต้ม = ยอด × 1% มีทศนิยม (3 กล่อง×100 + Flash Sale 1 กล่อง×40 = 340 → 3.4 แต้ม)',
      p3.data?.total === 340 && p3.data?.points === 3.4,
      `ยอด ${p3.data?.total} → ${p3.data?.points} แต้ม`,
    );

    // 7. ขั้นถัดไป: ยอด 3,500 ขาดอีก 2,500 ถึงขั้น 2
    const prog = (p1.data?.progress ?? []).find(
      (p: any) => p.promo_name === 'E2E local DRUG FESTIVAL',
    );
    check(
      'ขั้นถัดไป: DRUG FESTIVAL ยอด 3,500 ขาดอีก 2,500 ถึงขั้น 2',
      prog?.next_tier?.need === 2500 && prog?.next_tier?.tier_name === 'ขั้น 2',
      JSON.stringify(prog?.next_tier ?? null),
    );

    // 8. ตรวจของแลกแต้ม: 36.6 แต้ม → R02(20)+R01×2(10) ผ่าน · R02×2 แต้มไม่พอ · R01×4 เกินจำนวน · สินค้าไม่ใช่ของแลก
    const ok = await preview('E2E-C01', lines1, [
      { pro_code: 'E2E-R02', amount: 1 },
      { pro_code: 'E2E-R01', amount: 2 },
    ]);
    const over = await preview('E2E-C01', lines1, [
      { pro_code: 'E2E-R02', amount: 2 },
    ]);
    const limit = await preview('E2E-C01', lines1, [
      { pro_code: 'E2E-R01', amount: 4 },
    ]);
    const notRedeem = await preview('E2E-C01', lines1, [
      { pro_code: 'E2E-P01', amount: 1 },
    ]);
    check(
      'ของแลกแต้ม: ผ่าน 30/36.6 · แต้มไม่พอ · เกินจำนวน · ไม่ใช่ของแลก',
      ok.data?.redeem?.valid === true &&
        ok.data.redeem.used_points === 30 &&
        ok.data.redeem.remaining_points === 6.6 &&
        over.data?.redeem?.valid === false &&
        limit.data?.redeem?.valid === false &&
        notRedeem.data?.redeem?.valid === false,
      `ok ${ok.data?.redeem?.used_points}/${ok.data?.points} · over ${over.data?.redeem?.errors?.[0]?.message} · limit ${limit.data?.redeem?.errors?.[0]?.message} · not ${notRedeem.data?.redeem?.errors?.[0]?.message}`,
    );

    // 9. บรรทัดที่สินค้า/หน่วยไม่รู้จัก → skipped ไม่ล้ม
    const sk = await preview('E2E-C01', [
      { pro_code: 'E2E-NOPE', unit: 'กล่อง', qty: 1 },
      { pro_code: 'E2E-P01', unit: 'ถัง', qty: 1 },
    ]);
    check(
      'สินค้า/หน่วยที่ไม่รู้จัก → 200 และรายงานใน skipped',
      sk.status === 200 && sk.data?.skipped?.length === 2,
      JSON.stringify(sk.data?.skipped),
    );
  } catch (e) {
    failure = e;
    check(
      'สคริปต์ทำงานจนจบ',
      false,
      e instanceof Error ? e.message : String(e),
    );
  } finally {
    await clearCart('E2E-C01');
    await clearCart('E2E-L16');
    await db.end();
  }

  const passed = steps.filter((s) => s.pass).length;
  const commit = (() => {
    try {
      return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      return '?';
    }
  })();
  const dirty = (() => {
    try {
      return execSync('git status --porcelain -- src').toString().trim()
        ? ' (+ แก้ยังไม่ commit)'
        : '';
    } catch {
      return '';
    }
  })();
  const ts = new Date(Date.now() + 7 * 3600e3)
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 13)
    .replace('T', '-');
  mkdirSync('docs/e2e', { recursive: true });
  const file = `docs/e2e/checkout-preview-${ENV}-${ts}.md`;
  writeFileSync(
    file,
    [
      '# E2E — POST /ecom/internal/checkout-preview (หน้ากิมมิคของ Key ขาย)',
      '',
      `- **environment:** \`${ENV}\` (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)`,
      `- **commit:** \`${commit}\`${dirty} · **base:** ${BASE} · ฐาน \`${process.env.DB_NAME}\``,
      '- เทียบกับตะกร้าจริงของร้านทดสอบ E2E-C01 / E2E-L16 · ล้างตะกร้าเมื่อจบ',
      '',
      `## ผล ${passed}/${steps.length}`,
      '',
      '| | ขั้น | ที่เห็น |',
      '|---|---|---|',
      ...steps.map(
        (s) =>
          `| ${s.pass ? 'PASS' : 'FAIL'} | ${s.name} | ${String(s.observed).replace(/\|/g, '\\|')} |`,
      ),
      '',
    ].join('\n'),
  );
  console.log(`\n${passed}/${steps.length} → ${file}`);
  process.exit(failure || passed !== steps.length ? 1 : 0);
}

void main();
