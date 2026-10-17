/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
/**
 * E2E: GET /ecom/internal/customer-promotions — โปรทั้งหมดที่ร้านร่วมได้ ให้หน้า Key ขายของระบบขาย (Tim 17 ต.ค. 2569)
 *
 * โหมด local (SEED_DB=1, BASE_URL เป็น localhost เท่านั้น):
 *   สคริปต์ใส่ข้อมูลทดสอบ "E2E local …" (รหัสขึ้นต้น E2EL-) ลงฐานผ่าน DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME
 *   — Company Day, Wang Day (all_products + ยกเว้น), โปรปิด/หมดอายุ, Hot Deal, Flash Sale เปิด/ปิด, Happy Hour,
 *     Special Collection เฉพาะร้าน/ของร้านอื่น, Bundle Set เปิด/ปิด, Wang Rebate — แล้วตรวจค่าทุกส่วนตรงตามที่ใส่
 *   จบแล้วลบข้อมูลทดสอบทั้งหมดและคืนค่า happy_hour_config เดิม
 * โหมด deployed (ไม่ตั้ง SEED_DB): อ่านอย่างเดียว — guard, ตรวจ input, 404 และรูปแบบคำตอบของร้าน MEM_CODE
 *
 *   BASE_URL=http://localhost:3031/api INTERNAL_TOKEN=<INTERNAL_API_TOKEN> SEED_DB=1 DB_HOST=… DB_PORT=… DB_USERNAME=… DB_PASSWORD=… DB_NAME=… \
 *     npx ts-node scripts/e2e/customer-promotions.e2e.ts
 *   BASE_URL=https://<api>/api E2E_ENV=prod INTERNAL_TOKEN=<…> MEM_CODE=<ร้านจริง> [PRO_CODES=A,B] npx ts-node scripts/e2e/customer-promotions.e2e.ts
 *
 * ผลลัพธ์: docs/e2e/customer-promotions-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as mysql from 'mysql2/promise';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3031/api';
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
if (!E2E_ENV) {
  console.error(
    `BASE_URL=${BASE_URL} ไม่ใช่ localhost ต้องตั้ง E2E_ENV=dev|staging|prod`,
  );
  process.exit(2);
}
if (E2E_ENV === 'local' && !IS_LOCAL) {
  console.error(`E2E_ENV=local แต่ BASE_URL=${BASE_URL} ไม่ใช่ localhost`);
  process.exit(2);
}
if (SEED && !IS_LOCAL) {
  console.error(
    'SEED_DB=1 ใช้ได้กับ localhost เท่านั้น (ห้ามใส่ข้อมูลทดสอบลงฐานจริงตรงๆ)',
  );
  process.exit(2);
}
if (!SEED && !process.env.MEM_CODE) {
  console.error('โหมดอ่านอย่างเดียวต้องตั้ง MEM_CODE');
  process.exit(2);
}

const http = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true,
  timeout: 20000,
});
const PATH = '/ecom/internal/customer-promotions';
const call = (params: Record<string, string>, token: string | null = TOKEN) =>
  http.get(PATH, {
    params,
    headers: token === null ? {} : { 'x-internal-token': token },
  });

interface StepResult {
  step: string;
  ok: boolean;
  detail: string;
}
const results: StepResult[] = [];
const check = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step} — ${detail}`);
};

// ---------------- ข้อมูลทดสอบ (local) ----------------
const P = 'E2EL-';
const C = {
  creditor: `${P}CR1`,
  m1: `${P}M1`,
  m16: `${P}M16`,
  mOther: `${P}M2`,
  p1: `${P}P1`,
  p2: `${P}P2`,
  p3: `${P}P3`,
  g1: `${P}G1`,
  g16: `${P}G16`,
  h2: `${P}H2`,
  set1: `${P}S1`,
  set2: `${P}S2`,
};
const ids: Record<string, number> = {};
let db: mysql.Connection | null = null;
let happyHourBefore: any[] | null = null;
const q = async (sql: string, params: unknown[] = []): Promise<any> => {
  if (!db) throw new Error('no db');
  const [rows] = await db.query(sql, params);
  return rows;
};

const today = () => new Date().toLocaleDateString('sv-SE');
const dt = (days: number) => {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

async function seed() {
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });
  await cleanup(false);

  await q('INSERT INTO creditor (creditor_code, creditor_name) VALUES (?, ?)', [
    C.creditor,
    'E2E local บริษัททดสอบ',
  ]);
  for (const [code, route] of [
    [C.m1, 'L03'],
    [C.m16, 'L16'],
    [C.mOther, 'L03'],
  ]) {
    await q(
      'INSERT INTO users (mem_code, mem_username, mem_password, mem_route, mem_nameSite) VALUES (?, ?, ?, ?, ?)',
      [code, `e2e-local-${code}`, 'x', route, `E2E local ร้าน ${code}`],
    );
  }
  const products: [string, string, number][] = [
    [C.p1, 'E2E local สินค้าในขั้น Company Day', 0],
    [C.p2, 'E2E local สินค้าที่ถูกยกเว้น', 0],
    [C.p3, 'E2E local สินค้า Flash Sale/Bundle', 0],
    [C.g1, 'E2E local ของแถมทั่วไป', 0],
    [C.g16, 'E2E local ของแถมเฉพาะ L16', 1],
    [C.h2, 'E2E local ของแถม Hot Deal', 0],
  ];
  for (const [code, name, l16] of products) {
    await q(
      'INSERT INTO product (pro_code, pro_name, pro_nameTH, pro_l16_only) VALUES (?, ?, ?, ?)',
      [code, name, name, l16],
    );
    await q(
      'INSERT INTO product_unit (pro_code, unit_name, ratio, level) VALUES (?, ?, 1, 1), (?, ?, 10, 2)',
      [code, 'กล่อง', code, 'แผง'],
    );
  }

  const promo = async (
    name: string,
    creditor: string | null,
    status: number,
    start: number,
    end: number,
  ) => {
    const r = await q(
      'INSERT INTO promotion (promo_name, creditor_code, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [name, creditor, status, dt(start), dt(end)],
    );
    return r.insertId as number;
  };
  ids.company = await promo('E2E local Company Day', C.creditor, 1, -1, 1);
  await q(
    'INSERT INTO promotion_creditor (promo_id, creditor_code) VALUES (?, ?)',
    [ids.company, C.creditor],
  );
  ids.wang = await promo('E2E local Wang Day', null, 1, -1, 1);
  ids.off = await promo('E2E local โปรปิดอยู่', null, 0, -1, 1);
  ids.expired = await promo('E2E local โปรหมดอายุ', C.creditor, 1, -10, -3);

  const tier = async (
    promoId: number,
    name: string,
    min: number,
    allProducts: number,
    isUnit: number,
  ) => {
    const r = await q(
      'INSERT INTO promotion_tier (promo_id, tier_name, min_amount, all_products, is_unit) VALUES (?, ?, ?, ?, ?)',
      [promoId, name, min, allProducts, isUnit],
    );
    return r.insertId as number;
  };
  ids.tCompany = await tier(ids.company, 'E2E ขั้น 1', 5000, 0, 0);
  ids.tWang = await tier(ids.wang, 'E2E ทุกสินค้า', 3, 1, 1);
  ids.tOff = await tier(ids.off, 'E2E ปิด', 100, 0, 0);
  ids.tExpired = await tier(ids.expired, 'E2E หมดอายุ', 100, 0, 0);
  await q(
    'INSERT INTO promotion_condition (tier_id, product_code) VALUES (?, ?), (?, ?), (?, ?)',
    [ids.tCompany, C.p1, ids.tOff, C.p1, ids.tExpired, C.p1],
  );
  await q(
    'INSERT INTO promotion_tier_exclusion (tier_id, product_code) VALUES (?, ?)',
    [ids.tWang, C.p2],
  );
  await q(
    'INSERT INTO promotion_reward (tier_id, product_gcode, qty, unit) VALUES (?, ?, 2, ?), (?, ?, 1, ?), (?, ?, 1, ?)',
    [ids.tCompany, C.g1, '1', ids.tCompany, C.g16, '2', ids.tWang, C.g1, '2'],
  );

  const hd = await q(
    'INSERT INTO hotdeal_entity (pro_code1, pro1_amount, pro1_unit, pro_code2, pro2_amount, pro2_unit, special_deal, promo_title) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    [C.p1, '10', '1', C.h2, '1', '2', 'E2E local ซื้อ 10 แถม 1'],
  );
  ids.hotdeal = hd.insertId;

  const fs = async (name: string, active: number) =>
    (
      await q(
        'INSERT INTO flashsale (promotion_name, date, time_start, time_end, is_active) VALUES (?, ?, ?, ?, ?)',
        [name, today(), '00:00:00', '23:59:59', active],
      )
    ).insertId as number;
  ids.flashOn = await fs('E2E local Flash Sale วันนี้', 1);
  ids.flashOff = await fs('E2E local Flash Sale ปิด', 0);
  await q(
    'INSERT INTO flashsale_products (promotion_id, pro_code, `limit`) VALUES (?, ?, 5), (?, ?, 3)',
    [ids.flashOn, C.p3, ids.flashOff, C.p3],
  );

  happyHourBefore = await q('SELECT * FROM happy_hour_config WHERE id = 1');
  await q(
    'INSERT INTO happy_hour_config (id, is_enabled, start_date, end_date) VALUES (1, 1, NULL, NULL) ON DUPLICATE KEY UPDATE is_enabled = 1, start_date = NULL, end_date = NULL',
  );

  const coll = async (name: string, scope: string) =>
    (
      await q(
        'INSERT INTO special_collection (name, status, audience_scope, start_date, end_date) VALUES (?, 1, ?, ?, ?)',
        [name, scope, dt(-1), dt(1)],
      )
    ).insertId as number;
  ids.collMine = await coll('E2E local คอลเลกชันเฉพาะร้านนี้', 'selected');
  ids.collOther = await coll('E2E local คอลเลกชันของร้านอื่น', 'selected');
  await q(
    'INSERT INTO special_collection_audience (collection_id, mem_code) VALUES (?, ?), (?, ?)',
    [ids.collMine, C.m1, ids.collOther, C.mOther],
  );
  await q(
    'INSERT INTO special_collection_item (collection_id, ref_type, ref_id, title_override) VALUES (?, ?, ?, ?)',
    [
      ids.collMine,
      'promotion',
      String(ids.company),
      'E2E local ป้ายในคอลเลกชัน',
    ],
  );

  await q(
    'INSERT INTO bundle_set (set_code, set_name, price, status, start_date, end_date) VALUES (?, ?, 990, 1, ?, ?), (?, ?, 500, 0, NULL, NULL)',
    [C.set1, 'E2E local ชุดเปิดขาย', dt(-1), dt(1), C.set2, 'E2E local ชุดปิด'],
  );
  await q(
    'INSERT INTO bundle_set_item (set_code, pro_code, unit_level, qty, is_gift) VALUES (?, ?, 1, 2, 0), (?, ?, 1, 1, 1), (?, ?, 1, 1, 0)',
    [C.set1, C.p3, C.set1, C.g1, C.set2, C.p3],
  );

  await q(
    'INSERT INTO wangday_sumprice (wang_code, wang_yo, wang_tgpm, wang_tg9, wang_gif) VALUES (?, 120000, 15000, 135000, 2000)',
    [C.m1],
  );
  const year =
    new Date().getMonth() < 3
      ? new Date().getFullYear() - 1
      : new Date().getFullYear();
  await q(
    'INSERT INTO wangday (date, sh_running, wang_code, sumprice) VALUES (?, ?, ?, 14000), (?, ?, ?, 9000)',
    [`04/15/${year}`, `${P}SH1`, C.m1, `10/02/${year}`, `${P}SH2`, C.m1],
  );
  ids.seasonYear = year;
}

async function cleanup(log = true) {
  if (!db) return;
  const codes = Object.values(C);
  await q("DELETE FROM wangday WHERE sh_running LIKE 'E2EL-%'");
  await q("DELETE FROM wangday_sumprice WHERE wang_code LIKE 'E2EL-%'");
  await q("DELETE FROM bundle_set_item WHERE set_code LIKE 'E2EL-%'");
  await q("DELETE FROM bundle_set WHERE set_code LIKE 'E2EL-%'");
  await q(
    "DELETE i FROM special_collection_item i JOIN special_collection c ON c.collection_id = i.collection_id WHERE c.name LIKE 'E2E local %'",
  );
  await q(
    "DELETE a FROM special_collection_audience a JOIN special_collection c ON c.collection_id = a.collection_id WHERE c.name LIKE 'E2E local %'",
  );
  await q("DELETE FROM special_collection WHERE name LIKE 'E2E local %'");
  await q(
    "DELETE p FROM flashsale_products p JOIN flashsale f ON f.promotion_id = p.promotion_id WHERE f.promotion_name LIKE 'E2E local %'",
  );
  await q("DELETE FROM flashsale WHERE promotion_name LIKE 'E2E local %'");
  await q("DELETE FROM hotdeal_entity WHERE pro_code1 LIKE 'E2EL-%'");
  await q("DELETE FROM promotion WHERE promo_name LIKE 'E2E local %'"); // tiers/conditions/rewards/exclusions/creditors cascade
  await q('DELETE FROM product_unit WHERE pro_code IN (?)', [codes]);
  await q('DELETE FROM product WHERE pro_code IN (?)', [codes]);
  await q('DELETE FROM users WHERE mem_code IN (?)', [codes]);
  await q('DELETE FROM creditor WHERE creditor_code IN (?)', [codes]);
  if (happyHourBefore) {
    if (happyHourBefore.length) {
      const h = happyHourBefore[0];
      await q(
        'UPDATE happy_hour_config SET is_enabled = ?, start_date = ?, end_date = ? WHERE id = 1',
        [h.is_enabled, h.start_date, h.end_date],
      );
    } else {
      await q('DELETE FROM happy_hour_config WHERE id = 1');
    }
  }
  if (log) {
    const left = await q(
      "SELECT (SELECT COUNT(*) FROM promotion WHERE promo_name LIKE 'E2E local %') + (SELECT COUNT(*) FROM product WHERE pro_code LIKE 'E2EL-%') + (SELECT COUNT(*) FROM users WHERE mem_code LIKE 'E2EL-%') AS n",
    );
    check('ล้างข้อมูลทดสอบ', Number(left[0].n) === 0, `เหลือ ${left[0].n} แถว`);
  }
}

// ---------------- ขั้นตอน ----------------
async function guardAndInput(memCode: string) {
  const none = await call({ mem_code: memCode }, null);
  const wrong = await call({ mem_code: memCode }, 'wrong-token');
  check(
    'ไม่มี token / token ผิด → 403',
    none.status === 403 && wrong.status === 403,
    `${none.status} / ${wrong.status}`,
  );

  const noMem = await call({});
  const badMem = await call({ mem_code: "x'; --" });
  const tooMany = await call({
    mem_code: memCode,
    pro_codes: Array.from({ length: 201 }, (_, i) => `P${i}`).join(','),
  });
  const unknown = await call({ mem_code: 'E2E-NOPE-404' });
  check(
    'ไม่ส่ง mem_code / mem_code ผิดรูป / pro_codes เกิน 200 → 400 · ร้านที่ไม่มี → 404',
    noMem.status === 400 &&
      badMem.status === 400 &&
      tooMany.status === 400 &&
      unknown.status === 404,
    `${noMem.status} / ${badMem.status} / ${tooMany.status} / ${unknown.status}`,
  );
}

function shapeOk(d: any): boolean {
  return (
    d &&
    typeof d.generatedAt === 'string' &&
    d.member &&
    Array.isArray(d.promotions) &&
    Array.isArray(d.hotDeals) &&
    Array.isArray(d.flashSales) &&
    'happyHour' in d &&
    Array.isArray(d.specialCollections) &&
    Array.isArray(d.bundleSets) &&
    'wangRebate' in d
  );
}

async function seededChecks() {
  const r = await call({
    mem_code: C.m1,
    pro_codes: [C.p1, C.p2, C.p3].join(','),
  });
  const d = r.data;
  check(
    'ร้านทดสอบ → 200 และมีทุกส่วนตามสัญญา',
    r.status === 200 && shapeOk(d),
    `HTTP ${r.status} · route ${d?.member?.memRoute}`,
  );

  const company = d.promotions?.find((p: any) => p.promoId === ids.company);
  const wang = d.promotions?.find((p: any) => p.promoId === ids.wang);
  const leaked =
    d.promotions?.filter((p: any) =>
      [ids.off, ids.expired].includes(p.promoId),
    ) ?? [];
  const ct = company?.tiers?.[0];
  check(
    'Company Day: type=company มีบริษัท · ขั้นนับยอด P1 เท่านั้น · conditionCount=1 · ของแถมพร้อมชื่อหน่วย (รวมของ L16 เพราะร้านไม่ใช่ L16)',
    company?.type === 'company' &&
      company.creditors?.[0]?.code === C.creditor &&
      ct?.minAmount === 5000 &&
      ct?.isUnit === false &&
      ct?.conditionCount === 1 &&
      JSON.stringify(ct?.matchedProCodes) === JSON.stringify([C.p1]) &&
      ct?.rewards?.some(
        (x: any) => x.proCode === C.g1 && x.qty === 2 && x.unit === 'กล่อง',
      ) &&
      ct?.rewards?.some((x: any) => x.proCode === C.g16 && x.unit === 'แผง'),
    `${company?.name} · ${company?.creditors?.map((c: any) => c.code)} · matched ${ct?.matchedProCodes} · rewards ${ct?.rewards?.map((x: any) => `${x.proCode}×${x.qty}${x.unit}`)}`,
  );
  const wt = wang?.tiers?.[0];
  check(
    'Wang Day: type=wang ไม่มีบริษัท · all_products นับทุกตัวยกเว้น P2 · conditionCount=null · isUnit',
    wang?.type === 'wang' &&
      wang.creditors?.length === 0 &&
      wt?.allProducts === true &&
      wt?.isUnit === true &&
      wt?.conditionCount === null &&
      JSON.stringify(wt?.matchedProCodes) === JSON.stringify([C.p1, C.p3]),
    `${wang?.name} · matched ${wt?.matchedProCodes} · conditionCount ${wt?.conditionCount}`,
  );
  check(
    'โปรที่ปิด (status=0) และโปรหมดอายุ ไม่ถูกส่งมา',
    leaked.length === 0,
    `หลุดมา ${leaked.length}`,
  );

  const hd = d.hotDeals?.find((h: any) => h.proCode === C.p1);
  check(
    'Hot Deal ของ P1: ซื้อ 10 กล่อง แถม H2 1 แผง (หน่วยของแถมใช้หน่วยของสินค้าแถม) · kind product-pro',
    hd?.buyQty === 10 &&
      hd?.buyUnit === 'กล่อง' &&
      hd?.giftProCode === C.h2 &&
      hd?.giftQty === 1 &&
      hd?.giftUnit === 'แผง' &&
      hd?.kind === 'product-pro',
    JSON.stringify(hd),
  );

  const fOn = d.flashSales?.find((f: any) => f.id === ids.flashOn);
  const fOff = d.flashSales?.find((f: any) => f.id === ids.flashOff);
  check(
    'Flash Sale วันนี้: ตัวที่เปิด live=true มี P3 จำกัด 5 · ตัวที่ปิดไม่ส่งมา',
    fOn?.live === true &&
      fOn?.timeStart === '00:00' &&
      fOn?.products?.[0]?.proCode === C.p3 &&
      fOn?.products?.[0]?.limit === 5 &&
      !fOff,
    `เปิด ${JSON.stringify(fOn)} · ปิด ${fOff ? 'หลุด' : 'ไม่มี'}`,
  );

  const activeSlots = await q(
    'SELECT COUNT(*) AS n FROM happy_hour_slot WHERE is_active = 1',
  );
  check(
    'Happy Hour: เปิดอยู่ (ไม่จำกัดวัน) → ส่ง slot ที่เปิดครบ',
    d.happyHour !== null &&
      d.happyHour?.slots?.length === Number(activeSlots[0].n),
    `slots ${d.happyHour?.slots?.length} / ใน DB ${activeSlots[0].n}`,
  );

  const mine = d.specialCollections?.find((c: any) => c.id === ids.collMine);
  const other = d.specialCollections?.find((c: any) => c.id === ids.collOther);
  check(
    'Special Collection: เห็นของที่เลือกร้านนี้ (พร้อมป้ายรายการ) · ไม่เห็นของร้านอื่น',
    !!mine &&
      mine.items?.[0]?.refType === 'promotion' &&
      mine.items?.[0]?.label === 'E2E local ป้ายในคอลเลกชัน' &&
      !other,
    `ของร้านนี้ ${mine ? mine.name : '-'} · ของร้านอื่น ${other ? 'หลุด' : 'ไม่มี'}`,
  );

  const s1 = d.bundleSets?.find((s: any) => s.setCode === C.set1);
  const s2 = d.bundleSets?.find((s: any) => s.setCode === C.set2);
  check(
    'Bundle Set: ชุดที่เปิดและมี P3 ส่งมา (ราคา 990, มีของแถม) · ชุดที่ปิดไม่ส่ง',
    s1?.price === 990 &&
      s1?.items?.some((i: any) => i.isGift && i.proCode === C.g1) &&
      !s2,
    `S1 ${s1 ? s1.price : '-'} · S2 ${s2 ? 'หลุด' : 'ไม่มี'}`,
  );

  const w = d.wangRebate;
  const apr = w?.monthly?.find((m: any) => m.month === `${ids.seasonYear}-04`);
  const oct = w?.monthly?.find((m: any) => m.month === `${ids.seasonYear}-10`);
  check(
    'Wang Rebate: เป้า/ยอดปีก่อน/rebate ตรง · ยอด เม.ย. 14,000 ต.ค. 9,000 รวม 23,000 · 9 เดือน',
    w?.seasonTarget === 135000 &&
      w?.monthlyTarget === 15000 &&
      w?.lastYear === 120000 &&
      w?.rebate === 2000 &&
      apr?.amount === 14000 &&
      oct?.amount === 9000 &&
      w?.total === 23000 &&
      w?.monthly?.length === 9,
    `${w?.seasonStart}–${w?.seasonEnd} · รวม ${w?.total} · เป้า ${w?.seasonTarget}`,
  );

  const r16 = await call({ mem_code: C.m16, pro_codes: C.p1 });
  const t16 = r16.data?.promotions?.find((p: any) => p.promoId === ids.company)
    ?.tiers?.[0];
  check(
    'ร้าน L16: ไม่เห็นของแถมที่เป็น pro_l16_only (แบบเดียวกับหน้าร้าน) · ไม่มี Wang Rebate',
    r16.status === 200 &&
      !!t16 &&
      !t16.rewards.some((x: any) => x.proCode === C.g16) &&
      r16.data?.wangRebate === null,
    `rewards ${t16?.rewards?.map((x: any) => x.proCode)} · rebate ${r16.data?.wangRebate}`,
  );

  const rNone = await call({ mem_code: C.m1 });
  const anyMatched = (rNone.data?.promotions ?? []).some((p: any) =>
    p.tiers.some((t: any) => t.matchedProCodes.length),
  );
  check(
    'ไม่ส่ง pro_codes: ยังเห็นโปรทั้งหมด แต่ matchedProCodes ว่าง และ hotDeals ว่าง',
    rNone.status === 200 &&
      (rNone.data?.promotions ?? []).some(
        (p: any) => p.promoId === ids.company,
      ) &&
      !anyMatched &&
      rNone.data?.hotDeals?.length === 0,
    `โปร ${rNone.data?.promotions?.length} · hotDeals ${rNone.data?.hotDeals?.length}`,
  );
}

async function readOnlyChecks(memCode: string) {
  const r = await call({
    mem_code: memCode,
    ...(process.env.PRO_CODES ? { pro_codes: process.env.PRO_CODES } : {}),
  });
  check(
    `ร้าน ${memCode} → 200 และมีทุกส่วนตามสัญญา`,
    r.status === 200 && shapeOk(r.data),
    `HTTP ${r.status} · โปร ${r.data?.promotions?.length} · hotDeals ${r.data?.hotDeals?.length} · flash ${r.data?.flashSales?.length} · collection ${r.data?.specialCollections?.length} · bundle ${r.data?.bundleSets?.length} · rebate ${r.data?.wangRebate ? 'มี' : 'ไม่มี'}`,
  );
}

async function main() {
  console.log(
    `E2E customer-promotions · env=${E2E_ENV} · ${BASE_URL} · commit ${GIT_SHA}`,
  );
  let failure: unknown;
  try {
    if (SEED) {
      await seed();
      await guardAndInput(C.m1);
      await seededChecks();
    } else {
      await guardAndInput(String(process.env.MEM_CODE));
      await readOnlyChecks(String(process.env.MEM_CODE));
    }
  } catch (error) {
    failure = error;
    const e = error as { message?: string; sqlMessage?: string; code?: string };
    check(
      'สคริปต์ทำงานจนจบ',
      false,
      e.sqlMessage || e.message || e.code || String(error),
    );
  } finally {
    if (SEED) {
      await cleanup().catch((e) => check('ล้างข้อมูลทดสอบ', false, String(e)));
      await db?.end();
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const ts = new Date(Date.now() + 7 * 3600e3)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, '')
    .replace(/^(\d{8})/, '$1-');
  const dir = join(__dirname, '..', '..', 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `customer-promotions-${E2E_ENV}-${ts}.md`);
  writeFileSync(
    file,
    [
      '# E2E — GET /ecom/internal/customer-promotions (โปรที่ร้านร่วมได้ สำหรับหน้า Key ขาย)',
      '',
      `- **environment:** \`${E2E_ENV}\`${E2E_ENV === 'local' ? ' (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)' : ''}`,
      `- **commit:** \`${GIT_SHA}\` · **base:** ${BASE_URL}`,
      `- โหมด: ${SEED ? 'ใส่ข้อมูลทดสอบ "E2E local …" (รหัส E2EL-) แล้วลบเมื่อจบ' : `อ่านอย่างเดียว ร้าน ${process.env.MEM_CODE}`}`,
      '',
      `## ผล ${passed}/${results.length}`,
      '',
      '| | ขั้น | ที่เห็น |',
      '|---|---|---|',
      ...results.map(
        (r) =>
          `| ${r.ok ? 'PASS' : 'FAIL'} | ${r.step} | ${r.detail.replace(/\|/g, '\\|')} |`,
      ),
      '',
    ].join('\n'),
  );
  console.log(`\n${passed}/${results.length} → ${file}`);
  process.exit(failure || passed !== results.length ? 1 : 0);
}

void main();
