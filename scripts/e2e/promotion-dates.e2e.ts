/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * E2E: ช่วงวันที่โปร Company Day / Wang Day — วันเริ่ม 00:00:00 ถึงวันสิ้นสุด 23:59:59 เวลาไทย
 *
 * ใช้:
 *   BASE_URL=http://localhost:3021/api ADMIN_TOKEN=<jwt admin> \
 *   npx ts-node scripts/e2e/promotion-dates.e2e.ts
 *
 * E2E_ENV: ถ้า BASE_URL ไม่ใช่ localhost ต้องระบุเอง (dev / staging / prod) ไม่งั้นสคริปต์ไม่รัน
 *
 * สคริปต์สร้าง Wang Day ชื่อขึ้นต้น "E2E <env>" สถานะปิด (status=false) แล้วลบ (soft delete) เมื่อจบ
 * ต้องไม่ล็อกประเภทกิจกรรมเป็น Company Day (GET /ecom/promotion/type-policy)
 * ผลลัพธ์เขียนลง docs/e2e/promotion-dates-<env>-<timestamp>.md
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
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

if (!ADMIN_TOKEN) {
  console.error('ต้องตั้ง ADMIN_TOKEN');
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

// วันที่ในอนาคต (เวลาไทย) — ไม่ชนโปรที่ใช้งานจริง และ status=false ลูกค้าไม่เห็น
const thaiDate = (offsetDays: number) =>
  new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000)
    .toISOString()
    .slice(0, 10);

// เวลาไทยของ YYYY-MM-DD → instant UTC ที่ควรเก็บใน DB
const bkkStartIso = (d: string) =>
  new Date(`${d}T00:00:00.000+07:00`).toISOString();
const bkkEndIso = (d: string) =>
  new Date(`${d}T23:59:59.000+07:00`).toISOString();

async function addPromotion(name: string, start: string, end: string) {
  const form = new FormData();
  form.append('promo_name', name);
  form.append('start_date', start);
  form.append('end_date', end);
  form.append('status', 'false');
  return admin.post('/ecom/promotion/add', form);
}

const detailRange = async (promoId: number) => {
  const r = await admin.get(`/ecom/promotion/detail/${promoId}`);
  return `${r.data?.start_date}→${r.data?.end_date}`;
};

async function main() {
  const tag = `E2E ${E2E_ENV}`;
  const createdPromoIds: number[] = [];
  const day = thaiDate(60);
  const dayAfter = thaiDate(61);
  const fourDayEnd = thaiDate(63);
  let sameDayId = 0;
  let multiDayId = 0;

  await step('P0 ระบบไม่ได้ล็อกประเภทกิจกรรมเป็น Company Day', async () => {
    const r = await admin.get('/ecom/promotion/type-policy');
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.locked_type !== 'company',
      detail: `locked_type=${r.data?.locked_type ?? 'null'}`,
    };
  });

  // ---------- add ----------
  await step(
    `A1 add วันเดียว ${day}–${day} → 00:00:00–23:59:59 เวลาไทย`,
    async () => {
      const r = await addPromotion(`${tag} วันเดียว ${Date.now()}`, day, day);
      sameDayId = Number(r.data?.promo_id ?? 0);
      if (sameDayId) createdPromoIds.push(sameDayId);
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          r.data?.start_date === bkkStartIso(day) &&
          r.data?.end_date === bkkEndIso(day),
        detail: `promo_id=${sameDayId} start=${r.data?.start_date} end=${r.data?.end_date}`,
      };
    },
  );

  await step('A2 /detail แสดงวันเดียวกันทั้งสองฝั่ง', async () => {
    const range = await detailRange(sameDayId);
    return { status: 200, ok: range === `${day}→${day}`, detail: range };
  });

  await step(
    'A3 add ด้วย ISO มี Z (เที่ยงคืนไทย) → ไม่เพี้ยนเป็นวันก่อนหน้า',
    async () => {
      const r = await addPromotion(
        `${tag} ISO Z ${Date.now()}`,
        bkkStartIso(day),
        bkkEndIso(day),
      );
      const id = Number(r.data?.promo_id ?? 0);
      if (id) createdPromoIds.push(id);
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          r.data?.start_date === bkkStartIso(day) &&
          r.data?.end_date === bkkEndIso(day),
        detail: `promo_id=${id} start=${r.data?.start_date} end=${r.data?.end_date}`,
      };
    },
  );

  await step(`A4 add 4 วัน ${day}–${fourDayEnd}`, async () => {
    const r = await addPromotion(`${tag} 4 วัน ${Date.now()}`, day, fourDayEnd);
    multiDayId = Number(r.data?.promo_id ?? 0);
    if (multiDayId) createdPromoIds.push(multiDayId);
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        r.data?.start_date === bkkStartIso(day) &&
        r.data?.end_date === bkkEndIso(fourDayEnd),
      detail: `promo_id=${multiDayId} start=${r.data?.start_date} end=${r.data?.end_date}`,
    };
  });

  await step('A5 add วันสิ้นสุดก่อนวันเริ่ม → 400', async () => {
    const r = await addPromotion(`${tag} กลับด้าน`, dayAfter, day);
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('A6 add วันที่ผิดรูปแบบ → 400 (ไม่ใช่ 500)', async () => {
    const r = await addPromotion(`${tag} ผิดรูปแบบ`, 'abc', day);
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  // ---------- duplicate ----------
  await step(`D1 duplicate เป็นวันเดียว ${dayAfter}–${dayAfter}`, async () => {
    const r = await admin.post('/ecom/promotion/duplicate', {
      promo_id: sameDayId,
      start_date: dayAfter,
      end_date: dayAfter,
    });
    const newId = Number(r.data?.promo_id ?? 0);
    if (newId) createdPromoIds.push(newId);
    const range = newId ? await detailRange(newId) : '-';
    return {
      status: r.status,
      ok: r.status === 201 && range === `${dayAfter}→${dayAfter}`,
      detail: `new promo_id=${newId} ${range}`,
    };
  });

  await step('D2 duplicate วันสิ้นสุดก่อนวันเริ่ม → 400', async () => {
    const r = await admin.post('/ecom/promotion/duplicate', {
      promo_id: sameDayId,
      start_date: dayAfter,
      end_date: day,
    });
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  // ---------- update-dates ----------
  await step(`U1 update-dates โปร 4 วัน → วันเดียว ${dayAfter}`, async () => {
    const r = await admin.post('/ecom/promotion/update-dates', {
      promo_id: multiDayId,
      start_date: dayAfter,
      end_date: dayAfter,
    });
    const range = await detailRange(multiDayId);
    return {
      status: r.status,
      ok:
        (r.status === 200 || r.status === 201) &&
        range === `${dayAfter}→${dayAfter}`,
      detail: range,
    };
  });

  await step('U2 update-dates วันสิ้นสุดก่อนวันเริ่ม → 400', async () => {
    const r = await admin.post('/ecom/promotion/update-dates', {
      promo_id: multiDayId,
      start_date: dayAfter,
      end_date: day,
    });
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
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
    `# Promotion date range E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- วันที่ทดสอบ (เวลาไทย): ${day}, ${dayAfter}, ${fourDayEnd}`,
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
  const file = join(dir, `promotion-dates-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
