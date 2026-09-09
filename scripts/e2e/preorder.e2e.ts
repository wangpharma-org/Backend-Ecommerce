/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
/**
 * E2E: ฟีเจอร์สั่งจองสินค้า (pre-order) ยิง API จริงตาม flow ลูกค้า + admin
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod ADMIN_TOKEN=<jwt admin> USER_TOKEN=<jwt ลูกค้า> \
 *   PRO_CODE=<รหัสสินค้าที่มีในระบบ> npx ts-node scripts/e2e/preorder.e2e.ts
 *
 * E2E_ENV: ป้าย environment ที่ยิง ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ
 *          ถ้าไม่ใช่ localhost ต้องระบุเอง (dev / staging / prod) ไม่งั้นสคริปต์ไม่รัน
 *          รายงานและชื่อไฟล์จะติดป้ายนี้เสมอ เพื่อแยกผล local ออกจากผลบนของจริง
 *
 * ต้องเปิด feature flag `preorder` ก่อน (POST /ecom/feature-flag/update-flag)
 * สคริปต์สร้างรอบทดสอบชื่อขึ้นต้น "E2E " แล้วยกเลิกรอบเมื่อจบ (ข้อมูลยังอยู่ใน DB สถานะ cancelled)
 * ผลลัพธ์เขียนลง docs/e2e/preorder-<timestamp>.md
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const PRO_CODE = process.env.PRO_CODE ?? '';
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

if (!ADMIN_TOKEN || !USER_TOKEN || !PRO_CODE) {
  console.error('ต้องตั้ง ADMIN_TOKEN, USER_TOKEN, PRO_CODE');
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

const client = (token: string): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
    timeout: 15000,
  });
const admin = client(ADMIN_TOKEN);
const user = client(USER_TOKEN);

interface StepResult {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
}
const results: StepResult[] = [];
let campaignId = 0;
let preorderProductId = 0;
let itemId = 0;

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

async function main() {
  const tag = `E2E ${E2E_ENV} ${new Date().toISOString()}`;
  console.log(
    `env=${E2E_ENV}  base=${BASE_URL}  commit=${GIT_SHA}  product=${PRO_CODE}`,
  );

  await step(
    'admin สร้างรอบจอง (draft, allocation, allow_cancel=false)',
    async () => {
      const r = await admin.post('/ecom/admin/preorder/campaigns', {
        name: tag,
        mode: 'allocation',
        terms: 'เงื่อนไขทดสอบ e2e',
        allow_cancel: false,
      });
      campaignId = r.data?.id ?? 0;
      return {
        status: r.status,
        ok: r.status === 201 && campaignId > 0,
        detail: `campaign_id=${campaignId}`,
      };
    },
  );

  await step('admin เพิ่มสินค้า limit 5 supply 8', async () => {
    const r = await admin.post(
      `/ecom/admin/preorder/campaigns/${campaignId}/products`,
      {
        pro_code: PRO_CODE,
        limit_per_member: 5,
        supply_qty: 8,
        note: 'e2e',
      },
    );
    preorderProductId = r.data?.id ?? 0;
    return {
      status: r.status,
      ok: r.status === 201 && preorderProductId > 0,
      detail: `preorder_product_id=${preorderProductId}`,
    };
  });

  await step('ลูกค้าจองตอนรอบยัง draft → ต้องถูกปฏิเสธ', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 2, accept_terms: true },
    );
    return { status: r.status, ok: r.status === 403 || r.status === 404 };
  });

  await step('admin เปิดรอบ', async () => {
    const r = await admin.patch(
      `/ecom/admin/preorder/campaigns/${campaignId}/status`,
      { status: 'open' },
    );
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.status === 'open',
    };
  });

  await step('ลูกค้าเห็นรอบที่เปิดและสินค้า', async () => {
    const r = await user.get('/ecom/preorder/campaigns');
    const found =
      Array.isArray(r.data) &&
      r.data.some(
        (c: any) =>
          c.id === campaignId &&
          c.products?.some((p: any) => p.pro_code === PRO_CODE),
      );
    return { status: r.status, ok: r.status === 200 && found };
  });

  await step('ลูกค้าจองโดยไม่ยอมรับเงื่อนไข → 400', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 2 },
    );
    return { status: r.status, ok: r.status === 400 };
  });

  await step('ลูกค้าจองเกิน limit (6 > 5) → 400', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 6, accept_terms: true },
    );
    return { status: r.status, ok: r.status === 400 };
  });

  let orderedAt = '';
  await step('ลูกค้าจอง 2 → สร้างแถว ได้ลำดับคิว', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 2, accept_terms: true },
    );
    itemId = r.data?.id ?? 0;
    orderedAt = r.data?.ordered_at ?? '';
    return {
      status: r.status,
      ok: r.status === 200 && itemId > 0 && r.data?.position >= 1,
      detail: `item_id=${itemId} position=${r.data?.position}`,
    };
  });

  await step('ลูกค้าแก้จำนวนเป็น 4 → ordered_at ต้องไม่เปลี่ยน', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 4 },
    );
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        r.data?.amount === 4 &&
        r.data?.ordered_at === orderedAt,
      detail: `ordered_at same=${r.data?.ordered_at === orderedAt}`,
    };
  });

  await step('ลูกค้าจอง 0 → 400 (ยกเลิกด้วยการกรอก 0 ไม่ได้)', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 0 },
    );
    return { status: r.status, ok: r.status === 400 };
  });

  await step('ลูกค้ายกเลิกเองในรอบ allow_cancel=false → 403', async () => {
    const r = await user.delete(`/ecom/preorder/items/${itemId}`);
    return { status: r.status, ok: r.status === 403 };
  });

  await step('ลูกค้าดูประวัติของตัวเอง', async () => {
    const r = await user.get('/ecom/preorder/my');
    const found =
      Array.isArray(r.data) && r.data.some((i: any) => i.id === itemId);
    return { status: r.status, ok: r.status === 200 && found };
  });

  await step('admin ดูคิว มีร้านนี้ลำดับ 1', async () => {
    const r = await admin.get(
      `/ecom/admin/preorder/products/${preorderProductId}/queue`,
    );
    const row = r.data?.items?.find((i: any) => i.id === itemId);
    return {
      status: r.status,
      ok: r.status === 200 && row?.position === 1,
      detail: `total_qty=${r.data?.total_qty}`,
    };
  });

  await step('admin export CSV', async () => {
    const r = await admin.get(
      `/ecom/admin/preorder/products/${preorderProductId}/queue.csv`,
    );
    return {
      status: r.status,
      ok: r.status === 200 && String(r.data).includes('รหัสร้าน'),
    };
  });

  await step('admin ล็อคแถว', async () => {
    const r = await admin.patch(`/ecom/admin/preorder/items/${itemId}`, {
      status: 'locked',
    });
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.status === 'locked',
    };
  });

  await step('ลูกค้าแก้จำนวนหลังล็อค → 403 (server บังคับ)', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 3 },
    );
    return { status: r.status, ok: r.status === 403 };
  });

  await step('admin preview จัดสรร fifo supply 3', async () => {
    const r = await admin.post(
      `/ecom/admin/preorder/products/${preorderProductId}/allocate`,
      { strategy: 'fifo', supply_qty: 3, apply: false },
    );
    const row = r.data?.items?.find((i: any) => i.id === itemId);
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        r.data?.applied === false &&
        row?.allocated_qty === 3,
    };
  });

  await step('admin apply จัดสรร', async () => {
    const r = await admin.post(
      `/ecom/admin/preorder/products/${preorderProductId}/allocate`,
      { strategy: 'fifo', supply_qty: 3, apply: true },
    );
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.applied === true,
      detail: `notified=${r.data?.notified}`,
    };
  });

  await step('admin ยิง arrivals → จับคู่ได้ 1', async () => {
    const r = await admin.post('/ecom/admin/preorder/arrivals', {
      pro_codes: [PRO_CODE],
    });
    return {
      status: r.status,
      ok: r.status === 201 && r.data?.matched === 1,
      detail: `notified=${r.data?.notified}`,
    };
  });

  await step(
    'admin ดู log ของแถว (create, update, lock, allocate, arrived_notify)',
    async () => {
      const r = await admin.get(`/ecom/admin/preorder/items/${itemId}/logs`);
      const actions = (r.data ?? []).map((l: any) => l.action);
      const ok = [
        'create',
        'update',
        'lock',
        'allocate',
        'arrived_notify',
      ].every((a) => actions.includes(a));
      return {
        status: r.status,
        ok: r.status === 200 && ok,
        detail: actions.join(','),
      };
    },
  );

  await step('ลูกค้าธรรมดาเรียก admin endpoint → 403', async () => {
    const r = await user.get('/ecom/admin/preorder/campaigns');
    return { status: r.status, ok: r.status === 403 };
  });

  await step('admin ยกเลิกรอบ (cleanup)', async () => {
    const r = await admin.patch(
      `/ecom/admin/preorder/campaigns/${campaignId}/status`,
      { status: 'cancelled' },
    );
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.status === 'cancelled',
    };
  });

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Pre-order E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- product: ${PRO_CODE}`,
    `- campaign_id: ${campaignId}`,
    `- result: **${passed}/${results.length} passed**`,
    ``,
    `| # | step | status | ok | detail |`,
    `|---|------|--------|----|--------|`,
    ...results.map(
      (r, i) =>
        `| ${i + 1} | ${r.step} | ${r.status ?? ''} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail ?? ''} |`,
    ),
  ].join('\n');
  const dir = join(process.cwd(), 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `preorder-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
