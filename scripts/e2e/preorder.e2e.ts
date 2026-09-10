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
/** ร้านที่สองสำหรับทดสอบ "จองแทนร้าน" (ต้องมีใน users และไม่ใช่ร้านของ USER_TOKEN) */
const MEM2 = process.env.MEM2 ?? '';
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

/** อ่าน payload ของ JWT โดยไม่ตรวจลายเซ็น เพื่อเช็คว่า token ใส่ถูกช่อง */
function decodeJwt(token: string): { mem_code?: string; permission?: boolean } {
  try {
    const part = token.split('.')[1] ?? '';
    return JSON.parse(
      Buffer.from(
        part.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    );
  } catch {
    return {};
  }
}

async function main() {
  const adminJwt = decodeJwt(ADMIN_TOKEN);
  const userJwt = decodeJwt(USER_TOKEN);
  if (adminJwt.permission !== true || userJwt.permission === true) {
    console.error(
      `token ไม่ตรงบทบาท: ADMIN_TOKEN=${adminJwt.mem_code ?? '?'} (permission=${String(adminJwt.permission)}) USER_TOKEN=${userJwt.mem_code ?? '?'} (permission=${String(userJwt.permission)})\n` +
        'ADMIN_TOKEN ต้องเป็น token ของ user ที่ permission=true และ USER_TOKEN ต้องเป็นร้านธรรมดา (น่าจะใส่สลับกัน)',
    );
    process.exit(2);
  }
  if (!MEM2 || MEM2 === userJwt.mem_code) {
    console.error(
      'ต้องตั้ง MEM2 = รหัสร้านที่สอง (มีใน users และไม่ใช่ร้านของ USER_TOKEN) สำหรับรอบ C "จองแทนร้าน"',
    );
    process.exit(2);
  }
  console.log(
    `admin=${adminJwt.mem_code}  user=${userJwt.mem_code}  mem2=${MEM2}`,
  );
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
        increase_policy: 'split',
        increase_grace_hours: 0,
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

  await step(
    'ลูกค้าแก้จำนวนเป็น 4 (นโยบาย split) → ordered_at เดิม ส่วนที่เพิ่มเป็นล็อตใหม่ท้ายคิว',
    async () => {
      const r = await user.put(
        `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
        { amount: 4 },
      );
      const lots = r.data?.lots ?? [];
      const ok =
        r.status === 200 &&
        r.data?.amount === 4 &&
        r.data?.ordered_at === orderedAt &&
        lots.length === 2 &&
        lots[0]?.qty === 2 &&
        lots[1]?.qty === 2 &&
        lots[1]?.position > lots[0]?.position;
      return {
        status: r.status,
        ok,
        detail: `ordered_at same=${r.data?.ordered_at === orderedAt} lots=${lots
          .map((l: any) => `${l.qty}@${l.position}`)
          .join(',')}`,
      };
    },
  );

  await step('ลูกค้าลดจำนวนเป็น 3 → ตัดจากล็อตท้าย คิวเดิม', async () => {
    const r = await user.put(
      `/ecom/preorder/campaigns/${campaignId}/products/${PRO_CODE}`,
      { amount: 3 },
    );
    const lots = r.data?.lots ?? [];
    const ok =
      r.status === 200 &&
      r.data?.amount === 3 &&
      r.data?.ordered_at === orderedAt &&
      lots.length === 2 &&
      lots[0]?.qty === 2 &&
      lots[1]?.qty === 1;
    return {
      status: r.status,
      ok,
      detail: `lots=${lots.map((l: any) => `${l.qty}@${l.position}`).join(',')}`,
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

  await step('admin ดูคิว ร้านนี้ลำดับ 1 และมี 2 แถว (2 ล็อต)', async () => {
    const r = await admin.get(
      `/ecom/admin/preorder/products/${preorderProductId}/queue`,
    );
    const rows = (r.data?.items ?? []).filter((i: any) => i.id === itemId);
    return {
      status: r.status,
      ok: r.status === 200 && rows[0]?.position === 1 && rows.length === 2,
      detail: `total_qty=${r.data?.total_qty} rows=${rows.length}`,
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

  await step(
    'admin ยิง arrivals → สินค้าของรอบทดสอบถูกตั้ง arrived_at (matched ≥ 1 เพราะรอบอื่นอาจมีสินค้าเดียวกัน)',
    async () => {
      const r = await admin.post('/ecom/admin/preorder/arrivals', {
        pro_codes: [PRO_CODE],
      });
      const c = await admin.get(`/ecom/admin/preorder/campaigns/${campaignId}`);
      const prod = (c.data?.products ?? []).find(
        (p: any) => p.id === preorderProductId,
      );
      return {
        status: r.status,
        ok: r.status === 201 && r.data?.matched >= 1 && !!prod?.arrived_at,
        detail: `matched=${r.data?.matched} notified=${r.data?.notified} arrived_at=${prod?.arrived_at ?? 'null'}`,
      };
    },
  );

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

  // =====================================================================
  // รอบที่ 2: โหมด aggregation + allow_cancel + นโยบายเพิ่มจำนวน keep/split/grace/reset
  // =====================================================================
  let campaignB = 0;
  let productB = 0;
  let itemB = 0;
  let orderedAtB = '';
  const put = (amount: number, extra: Record<string, unknown> = {}) =>
    user.put(`/ecom/preorder/campaigns/${campaignB}/products/${PRO_CODE}`, {
      amount,
      ...extra,
    });
  const lotsOf = (r: any) =>
    ((r.data?.lots ?? []) as any[])
      .map((l) => `${l.qty}@${l.position}`)
      .join(',');

  await step(
    'B1 admin สร้างรอบ aggregation (allow_cancel=true, keep, ไม่มีเงื่อนไข)',
    async () => {
      const r = await admin.post('/ecom/admin/preorder/campaigns', {
        name: `${tag} B`,
        mode: 'aggregation',
        allow_cancel: true,
        increase_policy: 'keep',
        increase_grace_hours: null,
      });
      campaignB = r.data?.id ?? 0;
      return {
        status: r.status,
        ok: r.status === 201 && campaignB > 0 && r.data?.mode === 'aggregation',
        detail: `campaign_id=${campaignB}`,
      };
    },
  );

  await step(
    'B2 admin เพิ่มสินค้า moq 10, ราคาโดยประมาณ 99.5, ETA +20 วัน',
    async () => {
      const eta = new Date(Date.now() + 20 * 86400000)
        .toISOString()
        .slice(0, 10);
      const r = await admin.post(
        `/ecom/admin/preorder/campaigns/${campaignB}/products`,
        {
          pro_code: PRO_CODE,
          moq: 10,
          estimated_price: 99.5,
          eta_date: eta,
          note: 'e2e B',
        },
      );
      productB = r.data?.id ?? 0;
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          productB > 0 &&
          Number(r.data?.estimated_price) === 99.5 &&
          r.data?.moq === 10 &&
          String(r.data?.eta_date).startsWith(eta),
        detail: `preorder_product_id=${productB} eta=${r.data?.eta_date}`,
      };
    },
  );

  await step('B3 admin เปิดรอบ', async () => {
    const r = await admin.patch(
      `/ecom/admin/preorder/campaigns/${campaignB}/status`,
      {
        status: 'open',
      },
    );
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.status === 'open',
    };
  });

  await step(
    'B4 ลูกค้าเห็นราคาโดยประมาณ 99.5, MOQ 10, ETA และไม่มี limit',
    async () => {
      const r = await user.get('/ecom/preorder/campaigns');
      const c = (r.data ?? []).find((x: any) => x.id === campaignB);
      const p = c?.products?.find((x: any) => x.id === productB);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          p?.estimated_price === 99.5 &&
          p?.moq === 10 &&
          !!p?.eta_date &&
          p?.limit_per_member === null &&
          c?.allow_cancel === true &&
          c?.increase_policy === 'keep',
        detail: `estimated_price=${p?.estimated_price} moq=${p?.moq} eta=${p?.eta_date} policy=${c?.increase_policy}`,
      };
    },
  );

  await step(
    'B5 ลูกค้าจอง 3 โดยไม่ต้องยอมรับเงื่อนไข (รอบไม่มี terms)',
    async () => {
      const r = await put(3);
      itemB = r.data?.id ?? 0;
      orderedAtB = r.data?.ordered_at ?? '';
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          itemB > 0 &&
          r.data?.position === 1 &&
          lotsOf(r) === '3@1',
        detail: `item_id=${itemB} lots=${lotsOf(r)}`,
      };
    },
  );

  await step(
    'B6 keep: เพิ่มเป็น 5 → ยังล็อตเดียว ordered_at เดิม',
    async () => {
      const r = await put(5);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.ordered_at === orderedAtB &&
          lotsOf(r) === '5@1',
        detail: `lots=${lotsOf(r)}`,
      };
    },
  );

  await step('B7 admin เปลี่ยนนโยบายเป็น split + ผ่อนผัน 1 ชม.', async () => {
    const r = await admin.patch(`/ecom/admin/preorder/campaigns/${campaignB}`, {
      increase_policy: 'split',
      increase_grace_hours: 1,
    });
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        r.data?.increase_policy === 'split' &&
        r.data?.increase_grace_hours === 1,
    };
  });

  await step(
    'B8 split ภายในช่วงผ่อนผัน: เพิ่มเป็น 7 → ยังล็อตเดียว (ถือเป็น keep)',
    async () => {
      const r = await put(7);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.ordered_at === orderedAtB &&
          lotsOf(r) === '7@1',
        detail: `lots=${lotsOf(r)}`,
      };
    },
  );

  await step('B9 admin ตัดช่วงผ่อนผันเป็น 0', async () => {
    const r = await admin.patch(`/ecom/admin/preorder/campaigns/${campaignB}`, {
      increase_grace_hours: 0,
    });
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.increase_grace_hours === 0,
    };
  });

  await step(
    'B10 split พ้นช่วงผ่อนผัน: เพิ่มเป็น 8 → ล็อตใหม่ 1 ชิ้นต่อท้าย',
    async () => {
      const r = await put(8);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.ordered_at === orderedAtB &&
          lotsOf(r) === '7@1,1@2',
        detail: `lots=${lotsOf(r)}`,
      };
    },
  );

  await step('B11 admin เปลี่ยนนโยบายเป็น reset', async () => {
    const r = await admin.patch(`/ecom/admin/preorder/campaigns/${campaignB}`, {
      increase_policy: 'reset',
    });
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.increase_policy === 'reset',
    };
  });

  await step(
    'B12 reset: เพิ่มเป็น 9 → รวมเป็นล็อตเดียว ณ ตอนนี้ ordered_at ใหม่ (ท้ายคิว)',
    async () => {
      const r = await put(9);
      const newer =
        !!r.data?.ordered_at &&
        new Date(r.data.ordered_at) > new Date(orderedAtB);
      return {
        status: r.status,
        ok: r.status === 200 && newer && lotsOf(r) === '9@1',
        detail: `ordered_at moved=${newer} lots=${lotsOf(r)}`,
      };
    },
  );

  await step('B13 MOQ progress 9/10 = 90% ยังไม่ถึงเป้า', async () => {
    const r = await user.get('/ecom/preorder/campaigns');
    const p = (r.data ?? [])
      .find((x: any) => x.id === campaignB)
      ?.products?.find((x: any) => x.id === productB);
    const c = await admin.get(`/ecom/admin/preorder/campaigns/${campaignB}`);
    const ap = (c.data?.products ?? []).find((x: any) => x.id === productB);
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        p?.moq_progress === 90 &&
        p?.total_qty === 9 &&
        ap?.moq_met === false,
      detail: `progress=${p?.moq_progress} total=${p?.total_qty} moq_met=${ap?.moq_met}`,
    };
  });

  await step('B14 ลดจำนวนเป็น 4 → ล็อตเดียว qty 4 คิวเดิม', async () => {
    const before = (await user.get('/ecom/preorder/my')).data.find(
      (i: any) => i.id === itemB,
    )?.ordered_at;
    const r = await put(4);
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        lotsOf(r) === '4@1' &&
        r.data?.ordered_at === before,
      detail: `lots=${lotsOf(r)}`,
    };
  });

  await step(
    'B15 admin เพิ่มให้เป็น 12 (เจ้าหน้าที่แก้ = keep เสมอ) → MOQ ถึงเป้า',
    async () => {
      const r = await admin.patch(`/ecom/admin/preorder/items/${itemB}`, {
        amount: 12,
        note: 'e2e',
      });
      const c = await admin.get(`/ecom/admin/preorder/campaigns/${campaignB}`);
      const ap = (c.data?.products ?? []).find((x: any) => x.id === productB);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.amount === 12 &&
          ap?.moq_met === true &&
          ap?.total_qty === 12,
        detail: `moq_met=${ap?.moq_met} total=${ap?.total_qty}`,
      };
    },
  );

  await step(
    'B16 ลูกค้ายกเลิกเอง (allow_cancel=true) → cancelled และหายจากคิว',
    async () => {
      const r = await user.delete(`/ecom/preorder/items/${itemB}`);
      const q = await admin.get(
        `/ecom/admin/preorder/products/${productB}/queue`,
      );
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.status === 'cancelled' &&
          q.data?.total_members === 0,
        detail: `queue members=${q.data?.total_members}`,
      };
    },
  );

  await step(
    'B17 จองใหม่หลังยกเลิก 2 → แถวเดิมกลับมา reserved ล็อตใหม่ ordered_at ใหม่',
    async () => {
      const r = await put(2);
      const newer =
        !!r.data?.ordered_at &&
        new Date(r.data.ordered_at) > new Date(orderedAtB);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.id === itemB &&
          r.data?.status === 'reserved' &&
          newer &&
          lotsOf(r) === '2@1',
        detail: `lots=${lotsOf(r)}`,
      };
    },
  );

  await step('B18 admin ปิดรับจอง → รายการถูกล็อคอัตโนมัติ', async () => {
    const r = await admin.patch(
      `/ecom/admin/preorder/campaigns/${campaignB}/status`,
      { status: 'closed' },
    );
    const q = await admin.get(
      `/ecom/admin/preorder/products/${productB}/queue`,
    );
    const row = (q.data?.items ?? []).find((i: any) => i.id === itemB);
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        r.data?.status === 'closed' &&
        row?.status === 'locked',
      detail: `item status=${row?.status}`,
    };
  });

  await step('B19 หลังปิดรอบ ลูกค้าแก้จำนวน/ยกเลิกไม่ได้ → 403', async () => {
    const r1 = await put(3);
    const r2 = await user.delete(`/ecom/preorder/items/${itemB}`);
    return {
      status: r1.status,
      ok: r1.status === 403 && r2.status === 403,
      detail: `edit=${r1.status} cancel=${r2.status}`,
    };
  });

  await step('B20 admin ยกเลิกรอบ B (cleanup)', async () => {
    const r = await admin.patch(
      `/ecom/admin/preorder/campaigns/${campaignB}/status`,
      { status: 'cancelled' },
    );
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.status === 'cancelled',
    };
  });

  // =====================================================================
  // รอบที่ 3: Blueprint กลุ่ม 3 + มติประชุม 9 ก.ย. 69
  //   reason=price_increase, min/pack, ราคาขั้นบันได, จองแทนร้าน, ใบสรุปสั่งซื้อ,
  //   จัดสรรแบบ equal, ส่งเข้าตะกร้า (ลูกค้า/เจ้าหน้าที่), เตือนก่อนปิดรอบ
  // =====================================================================
  let campaignC = 0;
  let productC = 0;
  let itemC = 0;
  const putC = (amount: number) =>
    user.put(`/ecom/preorder/campaigns/${campaignC}/products/${PRO_CODE}`, {
      amount,
    });
  const myProductC = async () => {
    const r = await user.get('/ecom/preorder/campaigns');
    const c = (r.data as any[]).find((x) => x.id === campaignC);
    return {
      status: r.status,
      p: c?.products?.find((x: any) => x.pro_code === PRO_CODE),
    };
  };
  const effective = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  await step(
    'C1 admin สร้างรอบ C (aggregation, allow_cancel, ปิดรับใน 12 ชม.)',
    async () => {
      const r = await admin.post('/ecom/admin/preorder/campaigns', {
        name: `${tag} C`,
        mode: 'aggregation',
        allow_cancel: true,
        increase_policy: 'keep',
        ends_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      });
      campaignC = r.data?.id ?? 0;
      return {
        status: r.status,
        ok: r.status === 201 && campaignC > 0,
        detail: `campaign_id=${campaignC}`,
      };
    },
  );

  await step(
    'C2 admin เพิ่มสินค้า reason=price_increase ราคาใหม่ 120 มีผล +30 วัน, min 2, pack 2, limit 10, tiers 4→90 / 8→80',
    async () => {
      const r = await admin.post(
        `/ecom/admin/preorder/campaigns/${campaignC}/products`,
        {
          pro_code: PRO_CODE,
          reason: 'price_increase',
          new_price: 120,
          price_effective_date: effective,
          min_per_member: 2,
          pack_multiple: 2,
          limit_per_member: 10,
          estimated_price: 100,
          price_tiers: [
            { min_total_qty: 8, price: 80 },
            { min_total_qty: 4, price: 90 },
          ],
          note: 'e2e C',
        },
      );
      productC = r.data?.id ?? 0;
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          productC > 0 &&
          r.data?.reason === 'price_increase' &&
          Number(r.data?.new_price) === 120 &&
          String(r.data?.price_effective_date).startsWith(effective) &&
          r.data?.min_per_member === 2 &&
          r.data?.pack_multiple === 2 &&
          Array.isArray(r.data?.price_tiers) &&
          r.data.price_tiers.length === 2,
        detail: `preorder_product_id=${productC}`,
      };
    },
  );

  await step('C3 admin ตั้ง min 20 > limit 10 → 400', async () => {
    const r = await admin.patch(`/ecom/admin/preorder/products/${productC}`, {
      min_per_member: 20,
    });
    return { status: r.status, ok: r.status === 400 };
  });

  await step(
    'C4 admin ตั้ง reason=price_increase โดยไม่มีราคาใหม่ → 400',
    async () => {
      const r = await admin.patch(`/ecom/admin/preorder/products/${productC}`, {
        new_price: null,
      });
      return { status: r.status, ok: r.status === 400 };
    },
  );

  await step('C5 admin เปิดรอบ', async () => {
    const r = await admin.patch(
      `/ecom/admin/preorder/campaigns/${campaignC}/status`,
      { status: 'open' },
    );
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.status === 'open',
    };
  });

  await step(
    'C6 ลูกค้าเห็น reason/ราคาใหม่/ขั้นต่ำ/หีบห่อ และขั้นถัดไป 4 (ยังไม่มี tier_price)',
    async () => {
      const { status, p } = await myProductC();
      return {
        status,
        ok:
          status === 200 &&
          p?.reason === 'price_increase' &&
          Number(p?.new_price) === 120 &&
          String(p?.price_effective_date).startsWith(effective) &&
          p?.min_per_member === 2 &&
          p?.pack_multiple === 2 &&
          p?.tier_price === null &&
          p?.next_tier?.min_total_qty === 4 &&
          p?.next_tier?.remaining === 4,
        detail: `tier_price=${p?.tier_price} next=${JSON.stringify(p?.next_tier)}`,
      };
    },
  );

  await step('C7 ลูกค้าจอง 1 < ขั้นต่ำ 2 → 400', async () => {
    const r = await putC(1);
    return { status: r.status, ok: r.status === 400, detail: r.data?.message };
  });

  await step('C8 ลูกค้าจอง 3 ไม่ใช่ทวีคูณของ 2 → 400', async () => {
    const r = await putC(3);
    return { status: r.status, ok: r.status === 400, detail: r.data?.message };
  });

  await step(
    'C9 ลูกค้าจอง 4 → สำเร็จ ยอดรวม 4 ถึงขั้น 4 ราคา 90, ขั้นถัดไป 8 เหลืออีก 4',
    async () => {
      const r = await putC(4);
      itemC = r.data?.id ?? 0;
      const { p } = await myProductC();
      return {
        status: r.status,
        ok:
          (r.status === 200 || r.status === 201) &&
          itemC > 0 &&
          r.data?.amount === 4 &&
          p?.tier_price === 90 &&
          p?.next_tier?.min_total_qty === 8 &&
          p?.next_tier?.remaining === 4,
        detail: `item_id=${itemC} tier_price=${p?.tier_price} next=${JSON.stringify(p?.next_tier)}`,
      };
    },
  );

  await step('C10 ลูกค้าธรรมดาเรียก "จองแทนร้าน" → 403', async () => {
    const r = await user.put(
      `/ecom/admin/preorder/campaigns/${campaignC}/products/${PRO_CODE}/members/${MEM2}`,
      { amount: 2 },
    );
    return { status: r.status, ok: r.status === 403 };
  });

  await step('C11 admin จองแทนร้านที่ไม่มี → 404', async () => {
    const r = await admin.put(
      `/ecom/admin/preorder/campaigns/${campaignC}/products/${PRO_CODE}/members/ZZZ-NOPE`,
      { amount: 2 },
    );
    return { status: r.status, ok: r.status === 404 };
  });

  await step(
    `C12 admin จองแทนร้าน ${MEM2} 4 → ลำดับ 2, ยอดรวม 8 ราคาลดเป็น 80`,
    async () => {
      const r = await admin.put(
        `/ecom/admin/preorder/campaigns/${campaignC}/products/${PRO_CODE}/members/${MEM2}`,
        { amount: 4, note: 'e2e staff book' },
      );
      const { p } = await myProductC();
      return {
        status: r.status,
        ok:
          (r.status === 200 || r.status === 201) &&
          r.data?.amount === 4 &&
          r.data?.position === 2 &&
          r.data?.total_qty === 8 &&
          p?.tier_price === 80 &&
          p?.next_tier === null,
        detail: `position=${r.data?.position} total=${r.data?.total_qty} tier_price=${p?.tier_price}`,
      };
    },
  );

  await step('C13 log ของรายการที่จองแทนมี action staff_book', async () => {
    const q = await admin.get(
      `/ecom/admin/preorder/products/${productC}/queue`,
    );
    const row = (q.data?.items as any[]).find((x) => x.mem_code === MEM2);
    const r = await admin.get(`/ecom/admin/preorder/items/${row?.id}/logs`);
    const hit = (r.data as any[]).some((l) => l.action === 'staff_book');
    return {
      status: r.status,
      ok: r.status === 200 && hit,
      detail: `logs=${(r.data as any[]).map((l) => l.action).join(',')}`,
    };
  });

  await step(
    'C14 admin ใบสรุปสั่งซื้อ: 1 สินค้า ยอด 8 ราคาขาย 80 (tier) มูลค่า 640 จัดกลุ่มตาม supplier',
    async () => {
      const r = await admin.get(
        `/ecom/admin/preorder/campaigns/${campaignC}/purchase-summary`,
      );
      const row = (r.data?.products as any[])?.find(
        (x) => x.pro_code === PRO_CODE,
      );
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.totals?.products === 1 &&
          r.data?.totals?.total_qty === 8 &&
          row?.total_members === 2 &&
          row?.unit_price === 80 &&
          row?.tier_price === 80 &&
          row?.est_revenue === 640 &&
          row?.reason === 'price_increase' &&
          Array.isArray(r.data?.suppliers) &&
          r.data.suppliers.length === 1,
        detail: `supplier=${r.data?.suppliers?.[0]?.supplier} revenue=${row?.est_revenue} cost=${row?.est_cost}`,
      };
    },
  );

  await step('C15 admin ใบสรุปสั่งซื้อ CSV', async () => {
    const r = await admin.get(
      `/ecom/admin/preorder/campaigns/${campaignC}/purchase-summary.csv`,
    );
    const body = String(r.data);
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        String(r.headers['content-type']).includes('text/csv') &&
        body.includes(PRO_CODE),
      detail: `${body.split('\n').length} lines`,
    };
  });

  // --- feedback ผู้บริหาร 10 ก.ย. 69: สแกนบาร์โค้ดในหน้าแอดมิน + ประเภทราคา (admin เท่านั้น) ---
  let barcodeOfProduct = '';
  await step(
    'C15a admin ค้นสินค้าด้วยรหัส → ได้ข้อมูล catalog (matched_by=code)',
    async () => {
      const r = await admin.get('/ecom/admin/preorder/product-lookup', {
        params: { q: PRO_CODE },
      });
      barcodeOfProduct = (r.data?.barcodes ?? [])[0] ?? '';
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.pro_code === PRO_CODE &&
          r.data?.matched_by === 'code' &&
          typeof r.data?.out_of_stock === 'boolean',
        detail: `unit=${r.data?.unit} stock=${r.data?.pro_stock} barcodes=${(r.data?.barcodes ?? []).join('|')}`,
      };
    },
  );

  await step(
    'C15b admin ค้นสินค้าด้วยบาร์โค้ด (จำลองเครื่องสแกน) → แปลงเป็นรหัสสินค้าเดิม',
    async () => {
      if (!barcodeOfProduct)
        return {
          status: 0,
          ok: false,
          detail:
            'สินค้าทดสอบไม่มีบาร์โค้ดใน catalog เลือก PRO_CODE ที่มี pro_barcode1',
        };
      const r = await admin.get('/ecom/admin/preorder/product-lookup', {
        params: { q: barcodeOfProduct },
      });
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.pro_code === PRO_CODE &&
          r.data?.matched_by === 'barcode',
        detail: `${barcodeOfProduct} → ${r.data?.pro_code}`,
      };
    },
  );

  await step('C15c admin ค้นรหัส/บาร์โค้ดที่ไม่มี → 404', async () => {
    const r = await admin.get('/ecom/admin/preorder/product-lookup', {
      params: { q: 'E2E-NO-SUCH-CODE' },
    });
    return { status: r.status, ok: r.status === 404 };
  });

  await step('C15d ลูกค้าธรรมดาเรียก product-lookup → 403', async () => {
    const r = await user.get('/ecom/admin/preorder/product-lookup', {
      params: { q: PRO_CODE },
    });
    return { status: r.status, ok: r.status === 403 };
  });

  await step(
    'C15e admin ตั้งประเภทราคา price_type=eng_chiu → บันทึกและอ่านกลับได้',
    async () => {
      const r = await admin.patch(`/ecom/admin/preorder/products/${productC}`, {
        price_type: 'eng_chiu',
      });
      const c = await admin.get(`/ecom/admin/preorder/campaigns/${campaignC}`);
      const p = (c.data?.products as any[])?.find((x) => x.id === productC);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.price_type === 'eng_chiu' &&
          p?.price_type === 'eng_chiu',
      };
    },
  );

  await step('C15f admin ตั้ง price_type ที่ไม่มีในนิยาม → 400', async () => {
    const r = await admin.patch(`/ecom/admin/preorder/products/${productC}`, {
      price_type: 'free',
    });
    return { status: r.status, ok: r.status === 400 };
  });

  await step(
    'C15g ใบสรุปสั่งซื้อมี price_type และลูกค้าไม่เห็นฟิลด์นี้',
    async () => {
      const r = await admin.get(
        `/ecom/admin/preorder/campaigns/${campaignC}/purchase-summary`,
      );
      const row = (r.data?.products as any[])?.find(
        (x) => x.pro_code === PRO_CODE,
      );
      const { p } = await myProductC();
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          row?.price_type === 'eng_chiu' &&
          p !== undefined &&
          !('price_type' in p),
        detail: `summary price_type=${row?.price_type} customer has field=${p ? 'price_type' in p : '?'}`,
      };
    },
  );

  await step(
    'C16 admin รัน reminder ก่อนปิดรอบ → รอบ C ถูกนับ และ closing_reminded_at ถูกตั้ง',
    async () => {
      const r = await admin.post('/ecom/admin/preorder/reminders/run');
      const c = await admin.get(`/ecom/admin/preorder/campaigns/${campaignC}`);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.campaigns >= 1 &&
          !!c.data?.closing_reminded_at,
        detail: `campaigns=${r.data?.campaigns} notified=${r.data?.notified} (notified = จำนวนที่ notification-service รับไว้ ไม่ใช่ส่งถึงจริง ถ้า local ไม่มี service จะเป็น 0) reminded_at=${c.data?.closing_reminded_at}`,
      };
    },
  );

  await step(
    'C17 admin รัน reminder ซ้ำ → รอบ C ไม่ถูกนับซ้ำ (เวลาเดิม)',
    async () => {
      const before = (
        await admin.get(`/ecom/admin/preorder/campaigns/${campaignC}`)
      ).data?.closing_reminded_at;
      const r = await admin.post('/ecom/admin/preorder/reminders/run');
      const after = (
        await admin.get(`/ecom/admin/preorder/campaigns/${campaignC}`)
      ).data?.closing_reminded_at;
      return {
        status: r.status,
        ok: r.status === 200 && before === after,
        detail: `campaigns=${r.data?.campaigns}`,
      };
    },
  );

  await step(
    'C18 ลูกค้านำเข้าตะกร้าก่อนจัดสรร → 200 pushed 0 (ยังไม่ allocated)',
    async () => {
      const r = await user.post(`/ecom/preorder/items/${itemC}/to-cart`);
      return {
        status: r.status,
        ok: r.status === 200 && r.data?.pushed === 0,
        detail: JSON.stringify(r.data),
      };
    },
  );

  await step(
    'C19 admin preview จัดสรร equal supply 6 → 2 ร้าน ได้ 3/3',
    async () => {
      const r = await admin.post(
        `/ecom/admin/preorder/products/${productC}/allocate`,
        {
          strategy: 'equal',
          supply_qty: 6,
          apply: false,
        },
      );
      const rows = (r.data?.items as any[]) ?? [];
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.applied === false &&
          r.data?.strategy === 'equal' &&
          rows.length === 2 &&
          rows.every((x) => x.allocated_qty === 3) &&
          r.data?.total_allocated === 6,
        detail: rows
          .map((x) => `${x.mem_code}:${x.allocated_qty}/${x.amount}`)
          .join(' '),
      };
    },
  );

  await step('C20 admin apply จัดสรร equal', async () => {
    const r = await admin.post(
      `/ecom/admin/preorder/products/${productC}/allocate`,
      {
        strategy: 'equal',
        supply_qty: 6,
        apply: true,
      },
    );
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.applied === true,
    };
  });

  await step(
    'C21 ลูกค้าเห็น allocated_qty 3 และยังไม่ส่งเข้าตะกร้า',
    async () => {
      const { status, p } = await myProductC();
      const m = p?.my_item;
      return {
        status,
        ok:
          status === 200 &&
          m?.status === 'allocated' &&
          m?.allocated_qty === 3 &&
          m?.cart_pushed_at === null,
        detail: `allocated=${m?.allocated_qty} cart_pushed_at=${m?.cart_pushed_at}`,
      };
    },
  );

  await step(
    'C22 ลูกค้านำเข้าตะกร้า → pushed 1 และ cart_pushed_at ถูกตั้ง',
    async () => {
      const r = await user.post(`/ecom/preorder/items/${itemC}/to-cart`);
      const { p } = await myProductC();
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.pushed === 1 &&
          !!p?.my_item?.cart_pushed_at,
        detail: `${JSON.stringify(r.data?.results?.[0])} cart_pushed_at=${p?.my_item?.cart_pushed_at}`,
      };
    },
  );

  await step(
    'C23 ลูกค้านำเข้าตะกร้าซ้ำ → pushed 0 เหตุผล "ส่งเข้าตะกร้าไปแล้ว"',
    async () => {
      const r = await user.post(`/ecom/preorder/items/${itemC}/to-cart`);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.pushed === 0 &&
          String(r.data?.results?.[0]?.reason).includes('ตะกร้าไปแล้ว'),
        detail: r.data?.results?.[0]?.reason,
      };
    },
  );

  await step(
    'C24 ลูกค้าเห็นสินค้าในตะกร้าจริง (GET cart มี pro_code ของรอบ)',
    async () => {
      const r = await user.get(`/ecom/product-cart/${userJwt.mem_code}`);
      const raw = JSON.stringify(r.data ?? '');
      return {
        status: r.status,
        ok: r.status === 200 && raw.includes(PRO_CODE),
        detail: `cart payload ${raw.length} chars`,
      };
    },
  );

  await step(
    `C25 admin ส่งทั้งสินค้าเข้าตะกร้า → pushed 1 (${MEM2}) ข้าม 1 (ส่งแล้ว)`,
    async () => {
      const r = await admin.post(
        `/ecom/admin/preorder/products/${productC}/to-cart`,
      );
      const rows = (r.data?.results as any[]) ?? [];
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.pushed === 1 &&
          rows.length === 2 &&
          rows.find((x) => x.mem_code === MEM2)?.ok === true,
        detail: rows
          .map((x) => `${x.mem_code}:${x.ok ? 'ok' : x.reason}`)
          .join(' '),
      };
    },
  );

  await step(
    'C26 คิวแสดง cart_pushed_at ทั้ง 2 แถว และ log มี to_cart',
    async () => {
      const q = await admin.get(
        `/ecom/admin/preorder/products/${productC}/queue`,
      );
      const rows = (q.data?.items as any[]) ?? [];
      const logs = await admin.get(`/ecom/admin/preorder/items/${itemC}/logs`);
      const hit = (logs.data as any[]).some((l) => l.action === 'to_cart');
      return {
        status: q.status,
        ok:
          q.status === 200 &&
          rows.length === 2 &&
          rows.every((x) => !!x.cart_pushed_at) &&
          hit,
        detail: rows
          .map((x) => `${x.mem_code}@${x.cart_pushed_at ? 'pushed' : '-'}`)
          .join(' '),
      };
    },
  );

  await step(
    'C27 ลูกค้าลบสินค้าที่ push ออกจากตะกร้า (cleanup ตะกร้าร้านทดสอบ)',
    async () => {
      const r = await user.post('/ecom/product-delete-cart', {
        mem_code: userJwt.mem_code,
        pro_code: PRO_CODE,
      });
      return { status: r.status, ok: r.status === 201 || r.status === 200 };
    },
  );

  await step(
    `C28 admin ยกเลิกรอบ C (cleanup) — ตะกร้าของ ${MEM2} ยังมีสินค้าที่ push ไว้ (ลบมือถ้าต้องการ)`,
    async () => {
      const r = await admin.patch(
        `/ecom/admin/preorder/campaigns/${campaignC}/status`,
        { status: 'cancelled' },
      );
      return {
        status: r.status,
        ok: r.status === 200 && r.data?.status === 'cancelled',
      };
    },
  );

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Pre-order E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- product: ${PRO_CODE}`,
    `- campaign_id: A=${campaignId} B=${campaignB} C=${campaignC}`,
    `- rounds: A allocation (23) · B aggregation + นโยบายเพิ่มจำนวน (20) · C Blueprint กลุ่ม 3 + มติ 9 ก.ย. 69 + feedback ผู้บริหาร 10 ก.ย. (35)`,
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
