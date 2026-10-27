/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * E2E (WGDD-428): งดแสดงสินค้าบนหน้าร้าน — ยิงทั้งเส้นจริง
 *   productservice PATCH /products/:id/display → Kafka (product-update-from-easyacc)
 *   → Backend-Ecommerce product.pro_hidden → ลูกค้าไม่เห็น/สั่งไม่ได้ → เปิดกลับ
 *
 * ใช้:
 *   BASE_URL=https://<ecommerce-api>/api E2E_ENV=dev|prod USER_TOKEN=<jwt ร้านทดสอบ> \
 *   PRODUCT_API_URL=https://<productservice>/api PRODUCT_ADMIN_TOKEN=<jwt ที่มี PRODUCT:WRITE> \
 *   PRO_CODE=<รหัสสินค้าที่แสดงอยู่และมีในทั้ง 2 ระบบ> \
 *   npx ts-node scripts/e2e/product-hidden.e2e.ts
 *
 * ตัวเลือก:
 *   PRODUCT_READONLY_TOKEN=<jwt ที่ไม่มี PRODUCT:WRITE> → ยืนยันว่า toggle ตอบ 403
 *   PRO_UNIT=<หน่วยที่ใช้หยิบใส่ตะกร้า> (ค่าเริ่มต้น "1") · SYNC_WAIT_MS (ค่าเริ่มต้น 30000)
 *
 * สคริปต์ใส่สินค้าลงตะกร้าร้านทดสอบ 1 หน่วย แล้วงดแสดง → ตะกร้าต้องถูกนำออกพร้อมแจ้งเตือน
 * จบแล้ว "เปิดแสดงกลับ" เสมอ (แม้ขั้นอื่นล้ม) และปิดแจ้งเตือนในตะกร้า
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ไม่งั้นต้องระบุเอง
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/product-hidden-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const trimSlash = (url: string) => url.replace(/\/+$/, '');
const BASE_URL = trimSlash(process.env.BASE_URL ?? 'http://localhost:3021/api');
const PRODUCT_API_URL = trimSlash(
  process.env.PRODUCT_API_URL ?? 'http://localhost:3000/api',
);
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const PRODUCT_ADMIN_TOKEN = process.env.PRODUCT_ADMIN_TOKEN ?? '';
const PRODUCT_READONLY_TOKEN = process.env.PRODUCT_READONLY_TOKEN ?? '';
const PRO_CODE = process.env.PRO_CODE ?? '';
const PRO_UNIT = process.env.PRO_UNIT ?? '1';
const SYNC_WAIT_MS = Number(process.env.SYNC_WAIT_MS ?? 30000);
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');

if (!USER_TOKEN || !PRODUCT_ADMIN_TOKEN || !PRO_CODE || !E2E_ENV) {
  console.error(
    'ต้องตั้ง USER_TOKEN, PRODUCT_ADMIN_TOKEN, PRO_CODE และ E2E_ENV (เมื่อ BASE_URL ไม่ใช่ localhost)',
  );
  process.exit(2);
}

const client = (baseURL: string, token: string) =>
  axios.create({
    baseURL,
    validateStatus: () => true,
    timeout: 15000,
    headers: { Authorization: `Bearer ${token}` },
  });
const shop = client(BASE_URL, USER_TOKEN);
const productAdmin = client(PRODUCT_API_URL, PRODUCT_ADMIN_TOKEN);
const productReadonly = client(PRODUCT_API_URL, PRODUCT_READONLY_TOKEN);

const memCode = (() => {
  try {
    const part = USER_TOKEN.split('.')[1] ?? '';
    const payload = JSON.parse(
      Buffer.from(
        part.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    ) as { mem_code?: string };
    return payload.mem_code ?? '';
  } catch {
    return '';
  }
})();

type Step = {
  name: string;
  result: 'ผ่าน' | 'ไม่ผ่าน' | 'ข้าม';
  observed: string;
};
const steps: Step[] = [];
const check = (name: string, pass: boolean, observed: string) => {
  steps.push({ name, result: pass ? 'ผ่าน' : 'ไม่ผ่าน', observed });
  console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`);
};
const skip = (name: string, why: string) => {
  steps.push({ name, result: 'ข้าม', observed: why });
  console.error(`SKIP  ${name} — ${why}`);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const detail = () =>
  shop.post('/ecom/product-detail', { pro_code: PRO_CODE, mem_code: memCode });
const getCart = () => shop.get(`/ecom/product-cart/${memCode}`);

/** รอ Kafka sync จน product-detail ตอบตาม status ที่ต้องการ */
async function waitForDetailStatus(
  want: (status: number) => boolean,
): Promise<{ status: number; waitedMs: number }> {
  const started = Date.now();
  let status = 0;
  while (Date.now() - started <= SYNC_WAIT_MS) {
    status = (await detail()).status;
    if (want(status)) break;
    await sleep(1500);
  }
  return { status, waitedMs: Date.now() - started };
}

let productId = '';
let hidden = false;

const setDisplay = (isDisplay: boolean) =>
  productAdmin.patch(`/products/${productId}/display`, {
    is_display: isDisplay,
    updated_by: `E2E ${E2E_ENV}`,
  });

async function main() {
  const lookup = await productAdmin.get('/products/code', {
    params: { code: PRO_CODE },
  });
  productId = lookup.data?.id ?? '';
  check(
    'productservice หา product id จากรหัสสินค้า',
    lookup.status === 200 && Boolean(productId),
    `HTTP ${lookup.status} · id=${productId || '-'} · is_display=${lookup.data?.is_display}`,
  );
  if (!productId) throw new Error('ไม่พบสินค้าใน productservice');
  if (lookup.data?.is_display === false) {
    throw new Error('สินค้านี้งดแสดงอยู่แล้ว เลือก PRO_CODE ที่แสดงอยู่');
  }

  const before = await detail();
  check(
    'ก่อนงดแสดง: ลูกค้าเปิดหน้า detail ได้',
    before.status === 201,
    `HTTP ${before.status}`,
  );

  const add = await shop.post('/ecom/product-add-cart', {
    mem_code: memCode,
    pro_code: PRO_CODE,
    pro_unit: PRO_UNIT,
    amount: 1,
  });
  check(
    'ก่อนงดแสดง: หยิบสินค้าใส่ตะกร้าได้',
    add.status === 201,
    `HTTP ${add.status}`,
  );

  const forbidden = 'ผู้ไม่มีสิทธิ์ PRODUCT:WRITE เรียก toggle → 403';
  if (!PRODUCT_READONLY_TOKEN)
    skip(forbidden, 'ไม่ได้ตั้ง PRODUCT_READONLY_TOKEN');
  else {
    const r = await productReadonly.patch(`/products/${productId}/display`, {
      is_display: false,
    });
    check(forbidden, r.status === 403, `HTTP ${r.status}`);
  }

  const hide = await setDisplay(false);
  hidden = hide.status === 200;
  check(
    'แอดมินงดแสดงสินค้า (productservice)',
    hidden && hide.data?.is_display === false,
    `HTTP ${hide.status} · is_display=${hide.data?.is_display}`,
  );

  const synced = await waitForDetailStatus((s) => s === 404);
  check(
    'หลัง sync: หน้า detail ตอบ 404',
    synced.status === 404,
    `HTTP ${synced.status} · รอ ${synced.waitedMs} ms`,
  );

  const search = await shop.post('/ecom/search-products', {
    keyword: PRO_CODE,
    offset: 0,
    limit: 50,
  });
  const found = (
    (search.data?.products ?? []) as { pro_code: string }[]
  ).filter((p) => p.pro_code === PRO_CODE);
  check(
    'ค้นหาด้วยรหัสสินค้า → ไม่เจอ',
    search.status === 201 && found.length === 0,
    `HTTP ${search.status} · เจอ ${found.length}`,
  );

  const getOne = await shop.get(`/ecom/product-cart/get-one/${PRO_CODE}`);
  check(
    'quick-add (get-one) → 404',
    getOne.status === 404,
    `HTTP ${getOne.status}`,
  );

  const addHidden = await shop.post('/ecom/product-add-cart', {
    mem_code: memCode,
    pro_code: PRO_CODE,
    pro_unit: PRO_UNIT,
    amount: 1,
  });
  check(
    'หยิบสินค้าที่งดแสดงใส่ตะกร้า → ถูกปฏิเสธ (404)',
    addHidden.status === 404,
    `HTTP ${addHidden.status} · ${addHidden.data?.message ?? ''}`,
  );

  const cart = await getCart();
  const inCart = ((cart.data?.cart ?? []) as { pro_code: string }[]).some(
    (item) => item.pro_code === PRO_CODE,
  );
  const notice = (
    (cart.data?.deleteCartItems ?? []) as {
      product?: { pro_code?: string };
      data?: { reason?: string };
    }[]
  ).find(
    (item) =>
      item.product?.pro_code === PRO_CODE && item.data?.reason === 'hidden',
  );
  check(
    'ตะกร้า: สินค้าถูกนำออก + มีแจ้งเตือน reason=hidden',
    cart.status === 200 && !inCart && Boolean(notice),
    `HTTP ${cart.status} · ยังอยู่ในตะกร้า=${inCart} · แจ้งเตือน=${Boolean(notice)}`,
  );

  const logs = await productAdmin.get(`/products/${productId}/display-logs`);
  const latest = (logs.data ?? [])[0] as
    | { to_display?: boolean; changed_by_name?: string; created_at?: string }
    | undefined;
  check(
    'audit log บันทึกผู้กด + เวลา',
    logs.status === 200 &&
      latest?.to_display === false &&
      latest?.changed_by_name === `E2E ${E2E_ENV}` &&
      Boolean(latest?.created_at),
    `HTTP ${logs.status} · ${JSON.stringify(latest ?? {})}`,
  );
}

async function restore() {
  if (!productId || !hidden) return;
  const show = await setDisplay(true);
  check(
    'เปิดแสดงกลับ (cleanup)',
    show.status === 200 && show.data?.is_display === true,
    `HTTP ${show.status}`,
  );
  const back = await waitForDetailStatus((s) => s === 201);
  check(
    'หลังเปิดกลับ: หน้า detail ใช้งานได้อีกครั้ง',
    back.status === 201,
    `HTTP ${back.status} · รอ ${back.waitedMs} ms`,
  );
  await shop.delete(`/ecom/delete-cart-item/${PRO_CODE}`);
}

function writeReport(failure?: string): boolean {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (
      execSync('git status --porcelain -- src', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim()
    ) {
      commit += ' + แก้ไขที่ยังไม่ commit';
    }
  } catch {
    /* รันนอก git ได้ */
  }
  const failed = steps.filter((s) => s.result === 'ไม่ผ่าน').length;
  const skipped = steps.filter((s) => s.result === 'ข้าม').length;
  const ok = !failure && failed === 0 && steps.length > skipped;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '');
  const lines = [
    '# E2E — งดแสดงสินค้าบนหน้าร้าน (WGDD-428)',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL} · productservice ${PRODUCT_API_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **ข้อมูลทดสอบ:** สินค้า \`${PRO_CODE}\` · ร้าน \`${memCode || '-'}\` (เปิดแสดงกลับเมื่อจบ)`,
    `- **ผลรวม:** ${ok ? 'ผ่าน' : 'ไม่ผ่าน'} — ${steps.length - failed - skipped}/${steps.length} ขั้นผ่าน${skipped ? `, ข้าม ${skipped}` : ''}`,
    ...(E2E_ENV === 'local'
      ? [
          '- **หมายเหตุ:** ผล `local` นับแค่ "ผ่านก่อน merge" ต้องรันซ้ำกับ deployed code หลัง deploy',
        ]
      : []),
    '',
    '| ขั้น | ผล | สิ่งที่ได้ |',
    '|---|---|---|',
    ...steps.map(
      (s) =>
        `| ${s.name} | ${s.result} | ${s.observed.replace(/\|/g, '\\|')} |`,
    ),
    ...(failure ? ['', `สคริปต์หยุดกลางทาง: ${failure}`] : []),
    '',
  ];
  const dir = join(process.cwd(), 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const name = `product-hidden-${E2E_ENV}-${stamp}.md`;
  writeFileSync(join(dir, name), lines.join('\n'));
  console.error(`รายงาน: docs/e2e/${name}`);
  return ok;
}

void main()
  .then(() => undefined)
  .catch((e: unknown) => {
    const failure = e instanceof Error ? e.message : String(e);
    console.error(`หยุดกลางทาง: ${failure}`);
    return failure;
  })
  .then(async (failure) => {
    try {
      await restore();
    } catch (e) {
      console.error(`cleanup ล้ม: ${e instanceof Error ? e.message : e}`);
    }
    process.exit(writeReport(failure) ? 0 : 1);
  });
