/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
/**
 * E2E: ระบบรับคืนสินค้า (ECWC-689) ยิง API จริงครบ 5 stage ข้าม 3 service
 *   ลูกค้า (Backend-Ecommerce) → ขนส่ง (logistics-backend) → ฝ่ายทำคืน (Order Picking / ERP) → ลูกค้าเห็นใบรับคืน
 *
 * ใช้:
 *   BASE_URL=http://localhost:3000/api USER_TOKEN=<jwt ลูกค้า> \
 *   LOGISTIC_URL=http://localhost:3010/api/logistic DRIVER_TOKEN=<jwt พนักงานขนส่ง> \
 *   ERP_URL=http://localhost:3003/api ERP_TOKEN=<jwt พนักงาน ERP> RECEIVER_EMP_CODE=<รหัสใน RETURN_RECEIVER_EMP_CODES> \
 *   [SH_RUNNING=<บิลที่จะใช้>] npx ts-node scripts/e2e/customer-return.e2e.ts
 *
 * E2E_ENV: ป้าย environment — BASE_URL เป็น localhost = "local" อัตโนมัติ ไม่งั้นต้องระบุ (dev/staging/prod)
 * ต้องเปิด feature flag `customer_return` ใน Backend-Ecommerce ก่อน และตั้ง RETURN_INTERNAL_API_KEY ให้ตรงกันทั้ง 3 service
 * ข้อมูลทดสอบ: หมายเหตุถึงขนส่ง/เลขใบรับคืนขึ้นต้น "E2E <env>" และคำขอถูกปิดงาน (stage 5) เมื่อจบ
 * ผลลัพธ์เขียนลง docs/e2e/customer-return-<env>-<timestamp>.md
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL =
  process.env.ORDER_PICKING_API_URL ?? 'http://localhost:3003/api';
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const LOGISTIC_URL = process.env.LOGISTIC_URL ?? '';
const DRIVER_TOKEN = process.env.DRIVER_TOKEN ?? '';
const ERP_URL = process.env.ERP_URL ?? '';
const ERP_TOKEN = process.env.ERP_TOKEN ?? '';
const RECEIVER_EMP_CODE = process.env.RECEIVER_EMP_CODE ?? '';
const SH_RUNNING = process.env.SH_RUNNING ?? '';
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

const missing = Object.entries({
  USER_TOKEN,
  LOGISTIC_URL,
  DRIVER_TOKEN,
  ERP_URL,
  ERP_TOKEN,
  RECEIVER_EMP_CODE,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`ต้องตั้ง ${missing.join(', ')}`);
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

const client = (baseURL: string, token?: string): AxiosInstance =>
  axios.create({
    baseURL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
    timeout: 30000,
  });
const user = client(BASE_URL, USER_TOKEN);
const anon = client(BASE_URL);
const driver = client(LOGISTIC_URL, DRIVER_TOKEN);
const erp = client(ERP_URL, ERP_TOKEN);
const erpAnon = client(ERP_URL);

// PNG 1x1 — รูปทดสอบสำหรับทุกช่องที่บังคับแนบรูป
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const imageForm = (fields: Record<string, string>, files: string[]) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const f of files) {
    fd.append(f, new Blob([PNG], { type: 'image/png' }), `${f}.png`);
  }
  return fd;
};

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

const msg = (data: any) =>
  Array.isArray(data?.message) ? data.message.join(', ') : data?.message;

function decodeJwt(token: string): { mem_code?: string } {
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
  const memCode = decodeJwt(USER_TOKEN).mem_code;
  if (!memCode) {
    console.error('USER_TOKEN ไม่มี mem_code — ต้องเป็น token ของลูกค้า');
    process.exit(2);
  }
  const tag = `E2E ${E2E_ENV}`;
  let shRunning = SH_RUNNING;
  let item: any = null;
  let pickupDate = '';
  let photoUrl = '';
  let returnNo = '';
  let returnedBefore = 0;
  let returnItemIds: number[] = [];

  // ---------- A: ลูกค้า (Backend-Ecommerce → Order Picking) ----------

  await step(
    'A1 รายการบิลที่คืนได้ (ต้องเปิด flag customer_return)',
    async () => {
      const r = await user.get('/ecom/customer-return/bills');
      const bills = (r.data as any[]) ?? [];
      if (!shRunning) {
        shRunning = bills.find((b) => b.eligible)?.sh_running ?? '';
      }
      return {
        status: r.status,
        ok: r.status === 200 && Array.isArray(r.data) && !!shRunning,
        detail: `${bills.length} bills, ใช้ ${shRunning || '-'}${r.status === 403 ? ` (${msg(r.data)})` : ''}`,
      };
    },
  );
  if (!shRunning) return finish(memCode);

  await step('A2 สินค้าในบิล + จำนวนที่คืนได้', async () => {
    const r = await user.get(
      `/ecom/customer-return/bills/${encodeURIComponent(shRunning)}`,
    );
    item = ((r.data?.items as any[]) ?? []).find((i) => i.qty_returnable > 0);
    returnedBefore = item?.qty_returned_before ?? 0;
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.eligible === true && !!item,
      detail: item
        ? `${item.pro_code} คืนได้อีก ${item.qty_returnable} (เคยคืน ${returnedBefore})`
        : 'ไม่มีสินค้าที่คืนได้',
    };
  });
  if (!item) return finish(memCode);

  await step('A3 ตัวเลือกวันเข้ารับ 7 วัน ไม่มีวันอาทิตย์', async () => {
    const r = await user.get('/ecom/customer-return/pickup-options');
    const dates = (r.data?.dates as string[]) ?? [];
    pickupDate = dates[0] ?? '';
    const noSunday = dates.every(
      (d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0,
    );
    return {
      status: r.status,
      ok: r.status === 200 && dates.length === 7 && noSunday,
      detail: dates.join(' '),
    };
  });

  await step('A4 อัปโหลดรูปสินค้า (ไฟล์ไม่ใช่รูป → 400)', async () => {
    const fd = new FormData();
    fd.append('files', new Blob(['hello'], { type: 'text/plain' }), 'a.txt');
    const r = await user.post('/ecom/customer-return/photos', fd);
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('A5 อัปโหลดรูปสินค้า → ได้ URL ใน prefix ของร้าน', async () => {
    const r = await user.post(
      '/ecom/customer-return/photos',
      imageForm({}, ['files']),
    );
    photoUrl = r.data?.urls?.[0] ?? '';
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        photoUrl.includes(`customer-return/photos/${memCode}/`),
      detail: photoUrl,
    };
  });

  const payload = (overrides: Record<string, unknown> = {}) => ({
    sh_running: shRunning,
    pickup_date: pickupDate,
    pickup_slot: '09:00-12:00',
    note_to_driver: `${tag} — ข้อมูลทดสอบ ไม่ต้องเข้ารับจริง`,
    items: [
      {
        pro_code: item.pro_code,
        qty_return: 1,
        reason: 'damaged',
        note: tag,
        customer_photos: [photoUrl],
        lot_no: `E2E-LOT-${E2E_ENV}`,
        exp_date: '12/2027',
      },
    ],
    ...overrides,
  });

  await step('A6 แนบรูปจาก URL ภายนอก → 400', async () => {
    const p = payload();
    (p.items as any[])[0].customer_photos = ['https://example.com/x.jpg'];
    const r = await user.post('/ecom/customer-return/requests', p);
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('A7 คืนเกินจำนวนที่คืนได้ → 400', async () => {
    const p = payload();
    (p.items as any[])[0].qty_return = item.qty_returnable + 1;
    const r = await user.post('/ecom/customer-return/requests', p);
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('A8 วันเข้ารับนอกช่วงที่เลือกได้ → 400', async () => {
    const r = await user.post(
      '/ecom/customer-return/requests',
      payload({ pickup_date: '2020-01-01' }),
    );
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('A9 ไม่กรอก Lot (เหตุผลที่มีของจริง) → 400', async () => {
    const p = payload();
    delete (p.items as any[])[0].lot_no;
    const r = await user.post('/ecom/customer-return/requests', p);
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step(
    'A10 ส่งคำขอ → stage 1, lot ทดสอบไม่พบ = ส่งได้แต่ติดธง',
    async () => {
      const r = await user.post('/ecom/customer-return/requests', payload());
      returnNo = r.data?.return_no ?? '';
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          /^RT\d{2}-\d{2}-\d{4}$/.test(returnNo) &&
          r.data?.requires_pickup === true &&
          (r.data?.lot_not_found ?? []).includes(item.pro_code),
        detail: `${returnNo || msg(r.data)} lot_not_found=${JSON.stringify(r.data?.lot_not_found)}`,
      };
    },
  );
  if (!returnNo) return finish(memCode);

  await step('A11 จำนวนที่เคยคืนในบิลเพิ่มขึ้น 1', async () => {
    const r = await user.get(
      `/ecom/customer-return/bills/${encodeURIComponent(shRunning)}`,
    );
    const now = ((r.data?.items as any[]) ?? []).find(
      (i) => i.pro_code === item.pro_code,
    );
    return {
      status: r.status,
      ok: r.status === 200 && now?.qty_returned_before === returnedBefore + 1,
      detail: `qty_returned_before ${returnedBefore} → ${now?.qty_returned_before}`,
    };
  });

  await step(
    'A12 ลูกค้าเห็น stage 1 ยังไม่มีรูปแบบการคืน ไม่เห็นข้อมูลภายใน',
    async () => {
      const r = await user.get(
        `/ecom/customer-return/requests/${encodeURIComponent(returnNo)}`,
      );
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.stage === 1 &&
          r.data?.method === null &&
          r.data?.lot_flagged === true &&
          r.data?.receipt_ocr_text === undefined &&
          r.data?.acknowledged_by === undefined,
        detail: `stage ${r.data?.stage}`,
      };
    },
  );

  // ---------- B: ขนส่ง (logistics-backend → Order Picking) ----------

  await step('B1 งานรับคืนของร้าน — ไม่มีรูปแบบการคืน/มูลค่า', async () => {
    const r = await driver.post('/customer-return/pending', {
      mem_codes: [memCode],
    });
    const found = ((r.data as any[]) ?? []).find(
      (x) => x.return_no === returnNo,
    );
    returnItemIds = ((found?.items as any[]) ?? []).map((i) => i.id);
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        !!found &&
        found.method === undefined &&
        found.estimated_amount === undefined,
      detail: `${returnItemIds.length} items`,
    };
  });

  await step('B2 รับทราบงานรับคืน → stage 2', async () => {
    const r = await driver.post(
      `/customer-return/${encodeURIComponent(returnNo)}/acknowledge`,
    );
    return { status: r.status, ok: r.status === 201 && r.data?.stage === 2 };
  });

  await step('B3 รับทราบซ้ำ → 400 (สถานะเปลี่ยนไปแล้ว)', async () => {
    const r = await driver.post(
      `/customer-return/${encodeURIComponent(returnNo)}/acknowledge`,
    );
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('B4 รับของโดยไม่แนบรูป → 400', async () => {
    const r = await driver.post(
      `/customer-return/${encodeURIComponent(returnNo)}/pickup`,
      imageForm({ checked_item_ids: returnItemIds.join(',') }, []),
    );
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('B5 รับของโดยตรวจนับไม่ครบ → 400', async () => {
    const r = await driver.post(
      `/customer-return/${encodeURIComponent(returnNo)}/pickup`,
      imageForm({ checked_item_ids: '' }, ['file_return_img']),
    );
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step(
    'B6 รับของครบ + รูป + GPS + แจ้ง lot ไม่ตรง → stage 3',
    async () => {
      const r = await driver.post(
        `/customer-return/${encodeURIComponent(returnNo)}/pickup`,
        imageForm(
          {
            checked_item_ids: returnItemIds.join(','),
            lot_mismatch_item_ids: String(returnItemIds[0] ?? ''),
            lat: '13.7563',
            lng: '100.5018',
          },
          ['file_return_img'],
        ),
      );
      return {
        status: r.status,
        ok: r.status === 201 && r.data?.stage === 3,
        detail: msg(r.data),
      };
    },
  );

  await step('B7 ของรับคืนอยู่บนรถของพนักงานคนนี้', async () => {
    const r = await driver.get('/customer-return/on-truck');
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        ((r.data as any[]) ?? []).some((x) => x.return_no === returnNo),
    };
  });

  await step('B8 รายชื่อผู้รับมอบมีพนักงานฝ่ายทำคืนที่ใช้ทดสอบ', async () => {
    const r = await driver.get('/customer-return/receivers');
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        ((r.data as any[]) ?? []).some((x) => x.emp_code === RECEIVER_EMP_CODE),
      detail: `${(r.data as any[])?.length ?? 0} คน`,
    };
  });

  await step('B9 ส่งมอบให้คนที่ไม่ใช่ฝ่ายทำคืน → 400', async () => {
    const r = await driver.post(
      `/customer-return/${encodeURIComponent(returnNo)}/handover`,
      imageForm({ receiver_emp_code: 'XXXXXX' }, [
        'file_product_img',
        'file_slip_img',
      ]),
    );
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step('B10 ส่งมอบฝ่ายทำคืน 2 รูป + ผู้รับ → stage 4', async () => {
    const r = await driver.post(
      `/customer-return/${encodeURIComponent(returnNo)}/handover`,
      imageForm({ receiver_emp_code: RECEIVER_EMP_CODE }, [
        'file_product_img',
        'file_slip_img',
      ]),
    );
    return {
      status: r.status,
      ok: r.status === 201 && r.data?.stage === 4,
      detail: msg(r.data),
    };
  });

  // ---------- C: ฝ่ายทำคืน (ERP → Order Picking) ----------

  await step('C1 สรุปตัวเลข 4 การ์ด', async () => {
    const r = await erp.get('/customer-return/summary');
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.waiting_receipt >= 1,
      detail: JSON.stringify(r.data),
    };
  });

  let erpItemId = 0;
  await step('C2 ERP เห็นธง lot (ไม่พบในระบบ + ขนส่งแจ้งไม่ตรง)', async () => {
    const r = await erp.get(`/customer-return/${encodeURIComponent(returnNo)}`);
    const it = r.data?.items?.[0];
    erpItemId = it?.id ?? 0;
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        r.data?.lot_flagged === true &&
        it?.lot_found === false &&
        it?.pickup_lot_mismatch === true,
    };
  });

  await step('C3 ประวัติการซื้อของร้าน', async () => {
    const r = await erp.get(
      `/customer-return/${encodeURIComponent(returnNo)}/purchase-history`,
    );
    return {
      status: r.status,
      ok: r.status === 200 && Array.isArray(r.data),
      detail: `${(r.data as any[])?.length ?? 0} rows`,
    };
  });

  const acceptAll = () => [
    { item_id: erpItemId, decision: 'accepted', return_percent: 100 },
  ];

  await step('C4 คืนได้แต่ยังไม่อัปโหลดใบรับคืน → 400', async () => {
    const r = await erp.post(
      `/customer-return/${encodeURIComponent(returnNo)}/complete`,
      {
        items: acceptAll(),
        method: 'credit',
        receipt: {
          doc_no: `${tag} RTIV`,
          date: pickupDate,
          net_total: 1,
          lines: [{ code: item.pro_code, qty: 1, amount: 1 }],
        },
      },
    );
    return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
  });

  await step(
    'C5 อัปโหลดใบรับคืน (รูป) → ได้ไฟล์ + ผลอ่าน (OCR ล้มได้)',
    async () => {
      const r = await erp.post(
        `/customer-return/${encodeURIComponent(returnNo)}/receipt`,
        imageForm({}, ['file']),
      );
      return {
        status: r.status,
        ok: r.status === 201 && !!r.data?.file_url,
        detail: r.data?.ocr_error
          ? `ocr_error: ${r.data.ocr_error}`
          : `warnings: ${(r.data?.receipt_draft?.warnings ?? []).length}`,
      };
    },
  );

  await step('C6 ตัดสินคืนได้ 100% + รูปแบบ + ใบรับคืน → stage 5', async () => {
    const r = await erp.post(
      `/customer-return/${encodeURIComponent(returnNo)}/complete`,
      {
        items: acceptAll(),
        method: 'credit',
        receipt: {
          doc_no: `E2E-${E2E_ENV}-RTIV`,
          date: pickupDate,
          net_total: Number(item.unit_price),
          lines: [
            {
              code: item.pro_code,
              name: `${tag} ${item.product_name ?? ''}`.slice(0, 255),
              qty: 1,
              unit: item.unit ?? undefined,
              amount: Number(item.unit_price),
            },
          ],
        },
      },
    );
    return {
      status: r.status,
      ok: r.status === 201 && r.data?.success === true,
      detail: `customer_notified=${r.data?.customer_notified}`,
    };
  });

  // ---------- D: ลูกค้าเห็นผล + ด่านความปลอดภัย ----------

  await step('D1 ลูกค้าเห็น stage 5 + เลขใบรับคืน + รายการในใบ', async () => {
    const r = await user.get(
      `/ecom/customer-return/requests/${encodeURIComponent(returnNo)}`,
    );
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        r.data?.stage === 5 &&
        r.data?.outcome === 'accepted' &&
        r.data?.method === 'credit' &&
        r.data?.items?.[0]?.decision === 'accepted' &&
        r.data?.receipt_doc_no === `E2E-${E2E_ENV}-RTIV` &&
        (r.data?.receipt_lines ?? []).length === 1,
      detail: `stage ${r.data?.stage} · ${r.data?.receipt_doc_no}`,
    };
  });

  await step('D2 กระดิ่งแจ้งเตือนมีคำขอนี้', async () => {
    const r = await user.get('/ecom/customer-return/notifications');
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        ((r.data as any[]) ?? []).some((x) => x.return_no === returnNo),
    };
  });

  await step('D3 callback ภายในของ e-com ไม่มี key → 401', async () => {
    const r = await anon.post('/ecom/customer-return/internal/completed', {
      return_no: returnNo,
      mem_code: memCode,
      method: 'credit',
    });
    return { status: r.status, ok: r.status === 401 };
  });

  await step('D4 endpoint ภายในของ Order Picking ไม่มี key → 401', async () => {
    const r = await erpAnon.get(
      `/customer-return/internal/ecom/${encodeURIComponent(memCode)}/requests`,
    );
    return { status: r.status, ok: r.status === 401 };
  });

  await step('D5 ERP ไม่มี token → 401', async () => {
    const r = await erpAnon.get('/customer-return/summary');
    return { status: r.status, ok: r.status === 401 };
  });

  // ---------- E: ได้รับไม่ครบ → ข้ามขนส่ง → ฝ่ายทำคืนตัดสินคืนไม่ได้ ----------
  let shortNo = '';
  // รอบ A ใช้ไป 1 ชิ้นแล้ว — รอบนี้ต้องคืนได้อีกอย่างน้อย 1
  if (item.qty_returnable < 2) {
    console.log(
      'SKIP  รอบ E — สินค้าในบิลคืนได้ไม่ถึง 2 ชิ้น ตั้ง SH_RUNNING เป็นบิลอื่น',
    );
    return finish(memCode, returnNo, shRunning);
  }
  await step(
    'E1 "ได้รับไม่ครบ" ไม่ต้องมีวันเข้ารับ/Lot → ข้ามไป stage 4',
    async () => {
      const r = await user.post('/ecom/customer-return/requests', {
        sh_running: shRunning,
        items: [
          {
            pro_code: item.pro_code,
            qty_return: 1,
            reason: 'short_delivered',
            note: `${tag} ได้รับไม่ครบ`,
            customer_photos: [photoUrl],
          },
        ],
      });
      shortNo = r.data?.return_no ?? '';
      return {
        status: r.status,
        ok: r.status === 201 && r.data?.requires_pickup === false,
        detail: shortNo || msg(r.data),
      };
    },
  );
  if (shortNo) {
    await step('E2 ไม่โผล่ในงานรับคืนของขนส่ง และอยู่ stage 4', async () => {
      const [pending, detail] = await Promise.all([
        driver.post('/customer-return/pending', { mem_codes: [memCode] }),
        user.get(
          `/ecom/customer-return/requests/${encodeURIComponent(shortNo)}`,
        ),
      ]);
      return {
        status: detail.status,
        ok:
          !((pending.data as any[]) ?? []).some(
            (x) => x.return_no === shortNo,
          ) &&
          detail.data?.stage === 4 &&
          detail.data?.pickup_date === null,
      };
    });

    const shortItemId = async () => {
      const d = await erp.get(
        `/customer-return/${encodeURIComponent(shortNo)}`,
      );
      return d.data?.items?.[0]?.id as number;
    };

    await step('E3 คืนไม่ได้แต่ไม่ใส่เหตุผล → 400', async () => {
      const r = await erp.post(
        `/customer-return/${encodeURIComponent(shortNo)}/complete`,
        { items: [{ item_id: await shortItemId(), decision: 'rejected' }] },
      );
      return { status: r.status, ok: r.status === 400, detail: msg(r.data) };
    });

    await step(
      'E4 คืนไม่ได้ทั้งหมด ไม่ต้องมีใบรับคืน → stage 5 rejected',
      async () => {
        const r = await erp.post(
          `/customer-return/${encodeURIComponent(shortNo)}/complete`,
          {
            items: [
              {
                item_id: await shortItemId(),
                decision: 'rejected',
                reject_reason: `${tag} ตรวจแล้วส่งครบ`,
              },
            ],
          },
        );
        const after = await user.get(
          `/ecom/customer-return/requests/${encodeURIComponent(shortNo)}`,
        );
        return {
          status: r.status,
          ok:
            r.status === 201 &&
            after.data?.stage === 5 &&
            after.data?.outcome === 'rejected' &&
            after.data?.items?.[0]?.reject_reason?.includes(tag) === true,
        };
      },
    );
  }

  return finish(memCode, returnNo, shRunning);
}

function finish(memCode: string, returnNo = '', shRunning = '') {
  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Customer return (ECWC-689) E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- LOGISTIC_URL: ${LOGISTIC_URL}`,
    `- ERP_URL: ${ERP_URL}`,
    `- commit (Backend-Ecommerce): ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- mem_code: ${memCode} · bill: ${shRunning || '-'} · return_no: ${returnNo || '-'}`,
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
  const file = join(dir, `customer-return-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length && results.length > 3 ? 0 : 1);
}

void main();
