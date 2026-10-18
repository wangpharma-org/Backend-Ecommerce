/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
/**
 * E2E: GET /ecom/internal/current-promotions — โปรที่เปิดอยู่วันนี้สำหรับทุกคน ให้แถบโปรบนหัวทุกหน้าของระบบขาย (Tim 18 ต.ค. 2569)
 *
 * โหมด local (SEED_DB=1, BASE_URL เป็น localhost เท่านั้น): ใส่ข้อมูลทดสอบ "E2E local แถบโปร …" (รหัส E2ES-) แล้วตรวจ
 *   Company Day (สินค้าตัวอย่าง ≤ 12 ตัว เรียงรหัส + จำนวนเต็ม), Wang Day (ทุกสินค้า = ไม่มีตัวอย่าง), โปรปิดไม่ส่ง,
 *   Hot Deal ทั้งหมด (ไม่รวมดีล L16) + จำนวนทั้งหมด, Flash Sale วันนี้, Bundle Set, ไม่มีส่วนของรายร้าน
 *   และ /ecom/internal/customer-promotions เดิมยังตอบเหมือนเดิม — จบแล้วลบข้อมูลทดสอบทั้งหมด
 * โหมด deployed (ไม่ตั้ง SEED_DB): อ่านอย่างเดียว — guard และรูปแบบคำตอบ
 *
 *   BASE_URL=http://localhost:3032/api INTERNAL_TOKEN=<INTERNAL_API_TOKEN> SEED_DB=1 DB_HOST=… DB_PORT=… DB_USERNAME=… DB_PASSWORD=… DB_NAME=… \
 *     npx ts-node scripts/e2e/current-promotions.e2e.ts
 *   BASE_URL=https://<api>/api E2E_ENV=prod INTERNAL_TOKEN=<…> npx ts-node scripts/e2e/current-promotions.e2e.ts
 *
 * ผลลัพธ์: docs/e2e/current-promotions-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as mysql from 'mysql2/promise';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3032/api';
const TOKEN = process.env.INTERNAL_TOKEN ?? '';
const SEED = process.env.SEED_DB === '1';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const GIT_SHA = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
})();

if (!TOKEN) {
  console.error(
    'ต้องตั้ง INTERNAL_TOKEN (= INTERNAL_API_TOKEN ของ environment ที่ยิง)',
  );
  process.exit(2);
}
if (!E2E_ENV || (E2E_ENV === 'local' && !IS_LOCAL)) {
  console.error(
    `BASE_URL=${BASE_URL} — ต้องตั้ง E2E_ENV ให้ตรง (local ใช้ได้กับ localhost เท่านั้น)`,
  );
  process.exit(2);
}
if (SEED && !IS_LOCAL) {
  console.error('SEED_DB=1 ใช้ได้กับ localhost เท่านั้น');
  process.exit(2);
}

const steps: { name: string; pass: boolean; observed: string }[] = [];
const check = (name: string, pass: unknown, observed: string) => {
  steps.push({ name, pass: !!pass, observed });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`);
};
const get = (
  path: string,
  token: string | null = TOKEN,
  params?: Record<string, string>,
) =>
  axios.get(`${BASE_URL}${path}`, {
    params,
    headers: token === null ? {} : { 'x-internal-token': token },
    validateStatus: () => true,
  });

const P = 'E2ES-';
const NAME = 'E2E local แถบโปร';
const condCodes = Array.from(
  { length: 14 },
  (_, i) => `${P}P${String(i + 1).padStart(2, '0')}`,
);
const otherCodes = ['G1', 'H1', 'H2', 'L1', 'F1', 'B1', 'M1', 'CR1'].map(
  (c) => P + c,
);
const allCodes = [...condCodes, ...otherCodes];
const pad = (n: number) => String(n).padStart(2, '0');
const bkk = (offsetDays: number) => {
  const d = new Date(Date.now() + 7 * 3600e3 + offsetDays * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

let db: mysql.Connection | null = null;
const q = async (sql: string, args: unknown[] = []) =>
  (await db!.query(sql, args))[0] as any;

async function clean() {
  await q('DELETE FROM bundle_set_item WHERE set_code LIKE ?', [`${P}%`]);
  await q('DELETE FROM bundle_set WHERE set_code LIKE ?', [`${P}%`]);
  const fs = (
    await q('SELECT promotion_id FROM flashsale WHERE promotion_name LIKE ?', [
      `${NAME}%`,
    ])
  ).map((r: any) => r.promotion_id);
  if (fs.length) {
    await q('DELETE FROM flashsale_products WHERE promotion_id IN (?)', [fs]);
    await q('DELETE FROM flashsale WHERE promotion_id IN (?)', [fs]);
  }
  await q('DELETE FROM hotdeal_entity WHERE pro_code1 LIKE ?', [`${P}%`]);
  await q('DELETE FROM promotion WHERE promo_name LIKE ?', [`${NAME}%`]); // tiers/conditions/rewards/creditors cascade
  await q('DELETE FROM product_unit WHERE pro_code IN (?)', [allCodes]);
  await q('DELETE FROM product WHERE pro_code IN (?)', [allCodes]);
  await q('DELETE FROM users WHERE mem_code IN (?)', [allCodes]);
  await q('DELETE FROM creditor WHERE creditor_code IN (?)', [allCodes]);
}

async function seed() {
  await clean();
  await q('INSERT INTO creditor (creditor_code, creditor_name) VALUES (?, ?)', [
    `${P}CR1`,
    `${NAME} บริษัทยา`,
  ]);
  await q(
    'INSERT INTO users (mem_code, mem_username, mem_password, mem_route, mem_nameSite) VALUES (?, ?, ?, ?, ?)',
    [`${P}M1`, 'e2e-local-strip-m1', 'x', 'L03', `${NAME} ร้านทดสอบ`],
  );
  const products: [string, string, number][] = [
    ...condCodes.map((c, i): [string, string, number] => [
      c,
      `${NAME} สินค้าในโปร ${i + 1}`,
      0,
    ]),
    [`${P}G1`, `${NAME} ของแถม`, 0],
    [`${P}H1`, `${NAME} สินค้า Hot Deal`, 0],
    [`${P}H2`, `${NAME} ของแถม Hot Deal`, 0],
    [`${P}L1`, `${NAME} สินค้าเฉพาะ L16`, 1],
    [`${P}F1`, `${NAME} สินค้า Flash Sale`, 0],
    [`${P}B1`, `${NAME} สินค้าในชุด`, 0],
  ];
  for (const [code, name, l16] of products) {
    await q(
      'INSERT INTO product (pro_code, pro_name, pro_nameTH, pro_l16_only) VALUES (?, ?, ?, ?)',
      [code, name, name, l16],
    );
    await q(
      'INSERT INTO product_unit (pro_code, unit_name, ratio, level) VALUES (?, ?, 1, 1)',
      [code, 'กล่อง'],
    );
  }
  const promo = async (name: string, creditor: string | null, status: number) =>
    (
      await q(
        'INSERT INTO promotion (promo_name, creditor_code, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
        [name, creditor, status, `${bkk(-2)} 00:00:00`, `${bkk(5)} 23:59:59`],
      )
    ).insertId as number;
  const tier = async (
    promoId: number,
    name: string,
    min: number,
    all: number,
    isUnit: number,
  ) =>
    (
      await q(
        'INSERT INTO promotion_tier (promo_id, tier_name, min_amount, all_products, is_unit) VALUES (?, ?, ?, ?, ?)',
        [promoId, name, min, all, isUnit],
      )
    ).insertId as number;

  const company = await promo(`${NAME} Company Day`, `${P}CR1`, 1);
  await q(
    'INSERT INTO promotion_creditor (promo_id, creditor_code) VALUES (?, ?)',
    [company, `${P}CR1`],
  );
  // ใส่สลับลำดับ เพื่อดูว่าตัวอย่างเรียงตามรหัส
  const t2 = await tier(company, 'ขั้น 2', 6000, 0, 0);
  const t1 = await tier(company, 'ขั้น 1', 3000, 0, 0);
  for (const c of [...condCodes].reverse())
    await q(
      'INSERT INTO promotion_condition (tier_id, product_code) VALUES (?, ?)',
      [t1, c],
    );
  await q(
    'INSERT INTO promotion_condition (tier_id, product_code) VALUES (?, ?)',
    [t2, condCodes[0]],
  );
  await q(
    'INSERT INTO promotion_reward (tier_id, product_gcode, qty, unit) VALUES (?, ?, 2, ?), (?, ?, 5, ?)',
    [t1, `${P}G1`, '1', t2, `${P}G1`, '1'],
  );

  const wang = await promo(`${NAME} Wang Day`, null, 1);
  const tw = await tier(wang, 'ทุกสินค้า', 10, 1, 1);
  await q(
    'INSERT INTO promotion_reward (tier_id, product_gcode, qty, unit) VALUES (?, ?, 1, ?)',
    [tw, `${P}G1`, '1'],
  );

  const closed = await promo(`${NAME} โปรปิด`, null, 0);
  await tier(closed, 'ขั้นปิด', 100, 1, 0);

  await q(
    'INSERT INTO hotdeal_entity (pro_code1, pro1_amount, pro1_unit, pro_code2, pro2_amount, pro2_unit, special_deal, promo_title) VALUES (?, 10, ?, ?, 1, ?, 1, ?), (?, 5, ?, ?, 1, ?, 0, ?)',
    [
      `${P}H1`,
      '1',
      `${P}H2`,
      '1',
      `${NAME} ซื้อ 10 แถม 1`,
      `${P}L1`,
      '1',
      `${P}H2`,
      '1',
      `${NAME} ดีลเฉพาะ L16`,
    ],
  );
  const fsId = (
    await q(
      'INSERT INTO flashsale (promotion_name, date, time_start, time_end, is_active) VALUES (?, ?, ?, ?, 1)',
      [`${NAME} Flash Sale`, bkk(0), '00:00:00', '23:59:00'],
    )
  ).insertId;
  await q(
    'INSERT INTO flashsale_products (promotion_id, pro_code, `limit`) VALUES (?, ?, 5)',
    [fsId, `${P}F1`],
  );
  await q(
    'INSERT INTO bundle_set (set_code, set_name, price, status, start_date, end_date) VALUES (?, ?, 990, 1, ?, ?)',
    [
      `${P}SET1`,
      `${NAME} ชุดหน้าฝน`,
      `${bkk(-1)} 00:00:00`,
      `${bkk(5)} 23:59:59`,
    ],
  );
  await q(
    'INSERT INTO bundle_set_item (set_code, pro_code, unit_level, qty, is_gift) VALUES (?, ?, 1, 2, 0), (?, ?, 1, 1, 1)',
    [`${P}SET1`, `${P}B1`, `${P}SET1`, `${P}G1`],
  );
}

async function main() {
  if (SEED) {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
    });
    await seed();
  }
  try {
    const [none, bad] = await Promise.all([
      get('/ecom/internal/current-promotions', null),
      get('/ecom/internal/current-promotions', 'wrong-token'),
    ]);
    check(
      'ไม่มี token / token ผิด → 403',
      none.status === 403 && bad.status === 403,
      `${none.status} / ${bad.status}`,
    );

    const res = await get('/ecom/internal/current-promotions');
    const d = res.data ?? {};
    const keys = [
      'generatedAt',
      'promotions',
      'hotDeals',
      'hotDealTotal',
      'flashSales',
      'happyHour',
      'bundleSets',
    ];
    const perShop = ['member', 'specialCollections', 'wangRebate'].filter(
      (k) => k in d,
    );
    check(
      '200 · มีทุกส่วนของแถบโปร · ไม่มีส่วนของรายร้าน (member/specialCollections/wangRebate)',
      res.status === 200 && keys.every((k) => k in d) && perShop.length === 0,
      `HTTP ${res.status} · ขาด ${keys.filter((k) => !(k in d)).join(',') || '-'} · ของรายร้าน ${perShop.join(',') || '-'}`,
    );

    if (SEED) {
      const company = (d.promotions ?? []).find(
        (p: any) => p.name === `${NAME} Company Day`,
      );
      const [t1, t2] = company?.tiers ?? [];
      const sample = (t1?.sampleProducts ?? []).map((s: any) => s.proCode);
      check(
        'Company Day: ขั้นเรียงตามยอด · ขั้น 1 มีสินค้า 14 ตัว ส่งตัวอย่าง 12 ตัวแรกตามรหัส พร้อมชื่อ · ของแถม',
        company?.type === 'company' &&
          company.creditors?.[0]?.code === `${P}CR1` &&
          t1?.minAmount === 3000 &&
          t2?.minAmount === 6000 &&
          t1.conditionCount === 14 &&
          sample.join() === condCodes.slice(0, 12).join() &&
          !!t1.sampleProducts[0]?.name &&
          t1.rewards?.[0]?.proCode === `${P}G1` &&
          t1.rewards[0].qty === 2 &&
          t2.sampleProducts.length === 1 &&
          t1.matchedProCodes?.length === 0,
        company
          ? `ขั้น ${t1?.minAmount}/${t2?.minAmount} · นับ ${t1?.conditionCount} · ตัวอย่าง ${sample.length} (${sample[0]}…${sample.at(-1)}) · แถม ${t1?.rewards?.[0]?.proCode}×${t1?.rewards?.[0]?.qty}`
          : 'ไม่พบ',
      );

      const wang = (d.promotions ?? []).find(
        (p: any) => p.name === `${NAME} Wang Day`,
      );
      check(
        'Wang Day: type=wang ทุกสินค้า → conditionCount null และไม่มีสินค้าตัวอย่าง',
        wang?.type === 'wang' &&
          wang.tiers?.[0]?.allProducts === true &&
          wang.tiers[0].conditionCount === null &&
          wang.tiers[0].sampleProducts.length === 0,
        wang
          ? `allProducts=${wang.tiers?.[0]?.allProducts} · ตัวอย่าง ${wang.tiers?.[0]?.sampleProducts?.length}`
          : 'ไม่พบ',
      );

      check(
        'โปรที่ปิด (status=0) ไม่ถูกส่งมา',
        !(d.promotions ?? []).some((p: any) => p.name === `${NAME} โปรปิด`),
        'ไม่มี',
      );

      const hot = (d.hotDeals ?? []).filter((h: any) =>
        String(h.proCode).startsWith(P),
      );
      check(
        'Hot Deal ทั้งหมดของร้านทั่วไป: มีดีล H1 (ซื้อ 10 แถม H2 1) · ไม่มีดีลสินค้าเฉพาะ L16 · hotDealTotal ≥ จำนวนที่ส่ง ≤ 60',
        hot.length === 1 &&
          hot[0].proCode === `${P}H1` &&
          hot[0].buyQty === 10 &&
          hot[0].giftProCode === `${P}H2` &&
          d.hotDealTotal >= d.hotDeals.length &&
          d.hotDeals.length <= 60,
        `ของทดสอบ ${hot.map((h: any) => h.proCode).join(',') || '-'} · ส่ง ${d.hotDeals?.length} / ทั้งหมด ${d.hotDealTotal}`,
      );

      const flash = (d.flashSales ?? []).find(
        (f: any) => f.name === `${NAME} Flash Sale`,
      );
      check(
        'Flash Sale วันนี้: live พร้อมสินค้า F1 จำกัด 5 (สินค้าทุกตัว ไม่กรองตามร้าน)',
        flash?.live === true &&
          flash.date === bkk(0) &&
          flash.products?.some(
            (p: any) => p.proCode === `${P}F1` && p.limit === 5,
          ),
        flash
          ? `${flash.date} ${flash.timeStart}-${flash.timeEnd} live=${flash.live} · ${flash.products?.map((p: any) => `${p.proCode}×${p.limit}`).join(',')}`
          : 'ไม่พบ',
      );

      const set = (d.bundleSets ?? []).find(
        (b: any) => b.setCode === `${P}SET1`,
      );
      check(
        'Bundle Set ที่เปิด: ราคา 990 · 2 รายการ (มีของแถม)',
        set?.price === 990 &&
          set.items?.length === 2 &&
          set.items.some((i: any) => i.isGift),
        set
          ? `${set.name} ${set.price} · ${set.items?.length} รายการ`
          : 'ไม่พบ',
      );

      const cust = await get('/ecom/internal/customer-promotions', TOKEN, {
        mem_code: `${P}M1`,
        pro_codes: `${P}H1,${condCodes[0]}`,
      });
      const cc = (cust.data?.promotions ?? []).find(
        (p: any) => p.name === `${NAME} Company Day`,
      );
      check(
        '/customer-promotions เดิมยังตอบเหมือนเดิม (Hot Deal ของสินค้าที่ส่ง · matchedProCodes · ไม่มี sampleProducts)',
        cust.status === 200 &&
          cust.data?.hotDeals?.some((h: any) => h.proCode === `${P}H1`) &&
          cc?.tiers?.[0]?.matchedProCodes?.includes(condCodes[0]) &&
          !('sampleProducts' in (cc?.tiers?.[0] ?? {})),
        `HTTP ${cust.status} · hot ${cust.data?.hotDeals?.length} · matched ${cc?.tiers?.[0]?.matchedProCodes?.join(',')}`,
      );
    } else {
      check(
        'รูปแบบ: promotions[].tiers[].sampleProducts เป็น array',
        (d.promotions ?? []).every((p: any) =>
          p.tiers.every((t: any) => Array.isArray(t.sampleProducts)),
        ),
        `โปร ${d.promotions?.length}`,
      );
    }
  } finally {
    if (db) {
      await clean();
      const left = await q(
        'SELECT COUNT(*) n FROM product WHERE pro_code LIKE ?',
        [`${P}%`],
      );
      check(
        'เก็บกวาด: ลบข้อมูลทดสอบหมด',
        Number(left[0].n) === 0,
        `เหลือ ${left[0].n}`,
      );
      await db.end();
    }
  }
}

main()
  .catch((e) =>
    check(
      'สคริปต์ทำงานจนจบ',
      false,
      e instanceof Error ? e.message : String(e),
    ),
  )
  .finally(() => {
    const passed = steps.filter((s) => s.pass).length;
    const ts = new Date(Date.now() + 7 * 3600e3)
      .toISOString()
      .replace(/[-:]/g, '')
      .slice(0, 13)
      .replace('T', '-');
    const dir = join(process.cwd(), 'docs', 'e2e');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `current-promotions-${E2E_ENV}-${ts}.md`);
    writeFileSync(
      file,
      [
        '# E2E — GET /ecom/internal/current-promotions (แถบโปรบนหัวระบบขาย)',
        '',
        `- **environment:** \`${E2E_ENV}\`${E2E_ENV === 'local' ? ' (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)' : ''}`,
        `- **commit:** \`${GIT_SHA}\` · **base:** ${BASE_URL}`,
        `- โหมด: ${SEED ? 'ใส่ข้อมูลทดสอบ "E2E local แถบโปร …" (รหัส E2ES-) แล้วลบเมื่อจบ' : 'อ่านอย่างเดียว'}`,
        '',
        `## ผล ${passed}/${steps.length}`,
        '',
        '| | ขั้น | ที่เห็น |',
        '|---|---|---|',
        ...steps.map(
          (s) =>
            `| ${s.pass ? 'PASS' : 'FAIL'} | ${s.name} | ${s.observed.replace(/\|/g, '\\|')} |`,
        ),
        '',
      ].join('\n'),
    );
    console.log(`\n${passed}/${steps.length} → ${file}`);
    process.exit(passed === steps.length ? 0 : 1);
  });
