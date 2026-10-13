/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * E2E: ECWC-685 Company Day หลายบริษัท + ห้ามสินค้าซ้ำระหว่างสินค้าเข้าร่วมรายการกับของแถม (ทุก tier ในโปรเดียวกัน)
 *
 * ใช้:
 *   BASE_URL=http://localhost:3021/api ADMIN_TOKEN=<jwt admin> CREDITOR_CODES=059,079 \
 *   npx ts-node scripts/e2e/promotion-multi-creditor.e2e.ts
 *
 * CREDITOR_CODES: รหัสเจ้าหนี้ 2 ตัวที่มีสินค้าในระบบ (คั่นด้วย comma)
 * E2E_ENV: ถ้า BASE_URL ไม่ใช่ localhost ต้องระบุเอง (dev / staging / prod) ไม่งั้นสคริปต์ไม่รัน
 *
 * สคริปต์สร้าง Company Day ชื่อขึ้นต้น "E2E <env>" สถานะปิด (status=false) แล้วลบ (soft delete) เมื่อจบ
 * ต้องไม่ล็อกประเภทกิจกรรมเป็น Wang Day (GET /ecom/promotion/type-policy)
 * อัปโหลดรูปโปสเตอร์ tier ขนาด 1x1 px ขึ้น storage จริง 2 รูป
 * ผลลัพธ์เขียนลง docs/e2e/promotion-multi-creditor-<env>-<timestamp>.md
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const CREDITOR_CODES = (process.env.CREDITOR_CODES ?? '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);
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

if (!ADMIN_TOKEN || CREDITOR_CODES.length < 2) {
  console.error(
    'ต้องตั้ง ADMIN_TOKEN และ CREDITOR_CODES (อย่างน้อย 2 รหัส คั่นด้วย comma)',
  );
  process.exit(2);
}
if (!E2E_ENV) {
  console.error(
    `BASE_URL=${BASE_URL} ไม่ใช่ localhost ต้องตั้ง E2E_ENV=dev|staging|prod ให้ชัดว่ายิงที่ไหน`,
  );
  process.exit(2);
}
if (E2E_ENV === 'local' && !IS_LOCAL) {
  console.error(`E2E_ENV=local แต่ BASE_URL=${BASE_URL} ไม่ใช่ localhost`);
  process.exit(2);
}

const admin: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  validateStatus: () => true,
  timeout: 20000,
});

interface StepResult {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
}
const results: StepResult[] = [];

async function step(
  name: string,
  fn: () => Promise<{ status: number; ok: boolean; detail?: string }>,
) {
  try {
    const r = await fn();
    results.push({ step: name, ok: r.ok, status: r.status, detail: r.detail });
    console.log(
      `${r.ok ? 'PASS' : 'FAIL'}  ${name}  [${r.status}] ${r.detail ?? ''}`,
    );
  } catch (e) {
    const err = e as AxiosError;
    results.push({ step: name, ok: false, detail: err.message });
    console.log(`FAIL  ${name}  ${err.message}`);
  }
}

const msg = (data: any): string =>
  typeof data?.message === 'string'
    ? data.message
    : JSON.stringify(data ?? '').slice(0, 160);

// รูป PNG 1x1 px สำหรับโปสเตอร์ tier (add-tier บังคับต้องมีไฟล์)
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const isoDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

async function addPromotion(name: string, creditorCode: string) {
  const form = new FormData();
  form.append('promo_name', name);
  form.append('start_date', isoDate(30));
  form.append('end_date', isoDate(31));
  form.append('status', 'false');
  form.append('creditor_code', creditorCode);
  return admin.post('/ecom/promotion/add', form);
}

async function addTier(promoId: number, tierName: string, minAmount: number) {
  const form = new FormData();
  form.append('promo_id', String(promoId));
  form.append('tier_name', tierName);
  form.append('min_amount', String(minAmount));
  form.append('is_unit_based', 'false');
  form.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'e2e.png');
  return admin.post('/ecom/promotion/add-tier', form);
}

async function main() {
  const tag = `E2E ${E2E_ENV}`;
  const [codeA, codeB] = CREDITOR_CODES;
  const createdPromoIds: number[] = [];
  let promoId = 0;
  let tier1 = 0;
  let tier2 = 0;
  let proA = '';
  let proB = '';

  await step('P0 ระบบไม่ได้ล็อกประเภทกิจกรรมเป็น Wang Day', async () => {
    const r = await admin.get('/ecom/promotion/type-policy');
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.locked_type !== 'wang',
      detail: `locked_type=${r.data?.locked_type ?? 'null'}`,
    };
  });

  // ---------- ดึงสินค้าหลายบริษัท ----------
  const countOf = async (body: unknown) => {
    const r = await admin.post('/ecom/promotion/product/creditor', body);
    return {
      status: r.status,
      list: Array.isArray(r.data) ? (r.data as { pro_code: string }[]) : [],
    };
  };

  await step(
    'C1 product/creditor รับหลายรหัส = ผลรวมของแต่ละรหัส',
    async () => {
      const [a, b, both] = await Promise.all([
        countOf({ creditor_code: codeA }),
        countOf({ creditor_code: codeB }),
        countOf({ creditor_code: [codeA, codeB] }),
      ]);
      proA = a.list[0]?.pro_code ?? '';
      proB = b.list[0]?.pro_code ?? '';
      return {
        status: both.status,
        ok:
          both.status === 201 &&
          a.list.length > 0 &&
          b.list.length > 0 &&
          both.list.length === a.list.length + b.list.length,
        detail: `${codeA}=${a.list.length} ${codeB}=${b.list.length} รวม=${both.list.length}`,
      };
    },
  );

  await step('C2 product/creditor รับ JSON string ได้', async () => {
    const r = await countOf({ creditor_code: JSON.stringify([codeA, codeB]) });
    return {
      status: r.status,
      ok: r.status === 201 && r.list.length > 0,
      detail: `${r.list.length} รายการ`,
    };
  });

  await step('C3 product/creditor ไม่ส่งรหัส → 400', async () => {
    const r = await admin.post('/ecom/promotion/product/creditor', {
      creditor_code: [],
    });
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  // ---------- สร้าง Company Day หลายบริษัท ----------
  await step('A1 สร้าง Company Day 2 บริษัท (JSON string)', async () => {
    const r = await addPromotion(
      `${tag} multi-creditor ${Date.now()}`,
      JSON.stringify([codeA, codeB]),
    );
    promoId = Number(r.data?.promo_id ?? 0);
    if (promoId) createdPromoIds.push(promoId);
    return {
      status: r.status,
      ok: r.status === 201 && promoId > 0,
      detail: `promo_id=${promoId}`,
    };
  });

  await step('A2 รหัสเจ้าหนี้ที่ไม่มีจริง → 400 บอกรหัส', async () => {
    const fake = `E2E-NOPE-${Date.now()}`;
    const r = await addPromotion(
      `${tag} invalid creditor`,
      JSON.stringify([codeA, fake]),
    );
    if (r.data?.promo_id) createdPromoIds.push(Number(r.data.promo_id));
    return {
      status: r.status,
      ok: r.status === 400 && msg(r.data).includes(fake),
      detail: msg(r.data),
    };
  });

  await step('A3 detail คืนบริษัทครบ + บริษัทหลักคือตัวแรก', async () => {
    const r = await admin.get(`/ecom/promotion/detail/${promoId}`);
    const codes = ((r.data?.creditors ?? []) as { creditor_code: string }[])
      .map((c) => c.creditor_code)
      .sort();
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        r.data?.creditor?.creditor_code === codeA &&
        JSON.stringify(codes) === JSON.stringify([codeA, codeB].sort()),
      detail: `creditor=${r.data?.creditor?.creditor_code} creditors=${codes.join(',')}`,
    };
  });

  await step('A4 list คืน creditors ของโปรที่สร้าง', async () => {
    const r = await admin.get('/ecom/promotion/list');
    const promo = (r.data as any[] | undefined)?.find(
      (p) => p.promo_id === promoId,
    );
    return {
      status: r.status,
      ok: r.status === 200 && promo?.creditors?.length === 2,
      detail: `creditors=${promo?.creditors?.length ?? 'ไม่พบโปร'}`,
    };
  });

  // ---------- กฎห้ามซ้ำ ----------
  await step('B0 เพิ่ม Tier 1 + Tier 2', async () => {
    const r1 = await addTier(promoId, `${tag} Tier 1`, 1000);
    const r2 = await addTier(promoId, `${tag} Tier 2`, 2000);
    const detail = await admin.get(`/ecom/promotion/detail/${promoId}`);
    const tiers = (detail.data?.tiers ?? []) as {
      tier_id: number;
      tier_name: string;
    }[];
    tier1 = tiers.find((t) => t.tier_name === `${tag} Tier 1`)?.tier_id ?? 0;
    tier2 = tiers.find((t) => t.tier_name === `${tag} Tier 2`)?.tier_id ?? 0;
    return {
      status: r2.status,
      ok: r1.status === 201 && r2.status === 201 && tier1 > 0 && tier2 > 0,
      detail: `tier1=${tier1} tier2=${tier2}`,
    };
  });

  await step(`B1 เพิ่มสินค้าเข้าร่วมรายการ ${proA} ใน Tier 1`, async () => {
    const r = await admin.post('/ecom/promotion/condition/add', {
      tier_id: tier1,
      product_gcode: proA,
    });
    return { status: r.status, ok: r.status === 201, detail: msg(r.data) };
  });

  await step(`B2 ${proA} เป็นของแถม tier เดียวกัน → 400`, async () => {
    const r = await admin.post('/ecom/promotion/reward/add', {
      tier_id: tier1,
      product_gcode: proA,
      qty: 1,
      unit: '',
    });
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step(`B3 ${proA} เป็นของแถมข้าม tier (Tier 2) → 400`, async () => {
    const r = await admin.post('/ecom/promotion/reward/add', {
      tier_id: tier2,
      product_gcode: proA,
      qty: 1,
      unit: '',
    });
    return {
      status: r.status,
      ok: r.status === 400 && msg(r.data).includes('Tier 1'),
      detail: msg(r.data),
    };
  });

  await step(`B4 เพิ่มของแถม ${proB} ใน Tier 2`, async () => {
    const r = await admin.post('/ecom/promotion/reward/add', {
      tier_id: tier2,
      product_gcode: proB,
      qty: 1,
      unit: '',
    });
    return { status: r.status, ok: r.status === 201, detail: msg(r.data) };
  });

  await step(
    `B5 ${proB} เป็นสินค้าเข้าร่วมรายการข้าม tier (Tier 1) → 400`,
    async () => {
      const r = await admin.post('/ecom/promotion/condition/add', {
        tier_id: tier1,
        product_gcode: proB,
      });
      return {
        status: r.status,
        ok: r.status === 400 && msg(r.data).includes('Tier 2'),
        detail: msg(r.data),
      };
    },
  );

  await step(
    'B6 tiers/:id คืน other_tier_usage ของ tier อื่นเท่านั้น',
    async () => {
      const r = await admin.get(`/ecom/promotion/tiers/${tier1}`);
      const usage = r.data?.other_tier_usage;
      const rewardCodes = (
        (usage?.rewards ?? []) as { pro_code: string }[]
      ).map((u) => u.pro_code);
      const condCodes = (
        (usage?.conditions ?? []) as { pro_code: string }[]
      ).map((u) => u.pro_code);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          rewardCodes.includes(proB) &&
          !condCodes.includes(proA),
        detail: `rewards=${rewardCodes.join(',')} conditions=${condCodes.join(',') || '-'}`,
      };
    },
  );

  await step(
    'B7 tier_id ไม่ใช่ตัวเลข → 400 (ไม่ใช่ SQL error 500)',
    async () => {
      const [a, b, c] = await Promise.all([
        admin.get('/ecom/promotion/tiers/abc'),
        admin.get('/ecom/promotion/condition/list/abc'),
        admin.get('/ecom/promotion/reward/list/undefined'),
      ]);
      return {
        status: a.status,
        ok: a.status === 400 && b.status === 400 && c.status === 400,
        detail: `tiers=${a.status} condition/list=${b.status} reward/list=${c.status}`,
      };
    },
  );

  // ---------- duplicate ----------
  await step('D1 duplicate โปรหลายบริษัท → บริษัทติดไปครบ', async () => {
    const r = await admin.post('/ecom/promotion/duplicate', {
      promo_id: promoId,
      start_date: isoDate(40),
      end_date: isoDate(41),
    });
    const newId = Number(r.data?.promo_id ?? 0);
    if (newId) createdPromoIds.push(newId);
    const detail = newId
      ? await admin.get(`/ecom/promotion/detail/${newId}`)
      : null;
    return {
      status: r.status,
      ok: r.status === 201 && detail?.data?.creditors?.length === 2,
      detail: `new promo_id=${newId} creditors=${detail?.data?.creditors?.length ?? '-'}`,
    };
  });

  // ---------- cleanup ----------
  await step('Z cleanup: ลบ (soft delete) โปรทดสอบทั้งหมด', async () => {
    const rs = await Promise.all(
      createdPromoIds.map((id) =>
        admin.post('/ecom/promotion/delete', { promo_id: id }),
      ),
    );
    return {
      status: rs[0]?.status ?? 0,
      ok: rs.every((r) => r.status === 201),
      detail: `deleted promo_id=${createdPromoIds.join(',')}`,
    };
  });

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Promotion multi-creditor (ECWC-685) E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- creditors: ${codeA}, ${codeB} · products: A=${proA} B=${proB}`,
    `- promo_id ที่สร้าง (ลบแล้ว): ${createdPromoIds.join(', ')}`,
    `- result: **${passed}/${results.length} passed**`,
    ``,
    `| # | step | status | ok | detail |`,
    `|---|------|--------|----|--------|`,
    ...results.map(
      (r, i) =>
        `| ${i + 1} | ${r.step} | ${r.status ?? ''} | ${r.ok ? 'PASS' : 'FAIL'} | ${(r.detail ?? '').replace(/\|/g, '\\|')} |`,
    ),
  ].join('\n');
  const dir = join(process.cwd(), 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(
    dir,
    `promotion-multi-creditor-${E2E_ENV}-${Date.now()}.md`,
  );
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
