/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * E2E (ECWC-766): ห้ามใส่ตะกร้าเกินสต็อก — ยิง /ecom/product-add-cart จริง
 *
 * ใช้:
 *   BASE_URL=http://localhost:3024/api ADMIN_TOKEN=<jwt ที่จัดการ flag ได้> USER_TOKEN=<jwt ร้านทดสอบ> \
 *   PRO_CODE=<สินค้าที่มีสต็อก > 0 และมีอย่างน้อย 2 หน่วย (หน่วยใหญ่ ratio > 1)> \
 *   npx ts-node scripts/e2e/cart-stock-limit.e2e.ts
 *   (BASE_URL ไม่ใช่ localhost ต้องตั้ง E2E_ENV=dev|prod เอง)
 *
 * สคริปต์ไม่แก้สต็อก/สินค้า — อ่านสต็อกจาก product-detail แล้วหยิบสินค้าใส่ตะกร้าร้านทดสอบ
 * เปิด flag cart_stock_limit ระหว่างเทส แล้วคืนค่าเดิม + ลบสินค้านี้ออกจากตะกร้าเมื่อจบ (แม้ขั้นอื่นล้ม)
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/cart-stock-limit-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const FLAG = 'cart_stock_limit';
const MESSAGE_KEY = 'เกินกว่าสินค้าคงเหลือในระบบ';
const trimSlash = (url: string) => url.replace(/\/+$/, '');
const BASE_URL = trimSlash(process.env.BASE_URL ?? 'http://localhost:3021/api');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
/** ไม่บังคับ — ตั้งแล้วจะเทส internal API ที่ระบบขายใช้ (รายการ/เปลี่ยนสถานะคำขอติดต่อกลับ) */
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? '';
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const PRO_CODE = process.env.PRO_CODE ?? '';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');

if (!ADMIN_TOKEN || !USER_TOKEN || !PRO_CODE || !E2E_ENV) {
  console.error(
    'ต้องตั้ง ADMIN_TOKEN, USER_TOKEN, PRO_CODE และ E2E_ENV (เมื่อ BASE_URL ไม่ใช่ localhost)',
  );
  process.exit(2);
}

const client = (token: string) =>
  axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true,
    timeout: 30000,
    headers: { Authorization: `Bearer ${token}` },
  });
const shop = client(USER_TOKEN);
const admin = client(ADMIN_TOKEN);
const internal = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true,
  timeout: 30000,
  headers: { 'x-internal-token': INTERNAL_TOKEN },
});
const callbackIds = new Set<number>();
const requestCallback = (body: Record<string, unknown>) =>
  shop.post('/ecom/cart/stock-callback-request', body);

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

type Step = { name: string; result: 'ผ่าน' | 'ไม่ผ่าน'; observed: string };
const steps: Step[] = [];
const check = (name: string, pass: boolean, observed: string) => {
  steps.push({ name, result: pass ? 'ผ่าน' : 'ไม่ผ่าน', observed });
  console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`);
};

type Unit = { name: string; ratio: number };
let units: Unit[] = [];
let stock = 0;
let originalFlag: boolean | null = null;

const setFlag = (status: boolean) =>
  admin.post('/ecom/feature-flag/update-flag', { flag: FLAG, status });
const add = (unit: Unit, amount: number) =>
  shop.post('/ecom/product-add-cart', {
    mem_code: memCode,
    pro_code: PRO_CODE,
    pro_unit: unit.name,
    amount,
  });
const removeFromCart = () =>
  shop.post('/ecom/product-delete-cart', {
    mem_code: memCode,
    pro_code: PRO_CODE,
  });

/** จำนวนหน่วยเล็กสุดของสินค้านี้ในตะกร้า (ไม่นับของแถม/รางวัล) */
async function cartSmallestUnits(): Promise<number> {
  const res = await shop.get(`/ecom/product-cart/${memCode}`);
  const groups = ((res.data?.cart ?? res.data ?? []) as any[]).filter(
    (g) => g?.pro_code === PRO_CODE,
  );
  let total = 0;
  for (const g of groups) {
    for (const row of (g.shopping_cart ?? []) as any[]) {
      if (row.hotdeal_free || row.is_reward) continue;
      const ratio =
        units.find((u) => u.name === row.spc_unit)?.ratio ??
        [1, 2, 3]
          .map((i) => ({ n: g[`pro_unit${i}`], r: Number(g[`pro_ratio${i}`]) }))
          .find((u) => u.n === row.spc_unit)?.r ??
        1;
      total += Number(row.spc_amount) * ratio;
    }
  }
  return total;
}

const msg = (res: { data?: any }) => String(res.data?.message ?? '');
const isLimit = (res: { status: number; data?: any }) =>
  res.status === 400 && msg(res).includes(MESSAGE_KEY);

async function main() {
  const flag = await admin.get(`/ecom/feature-flag/${FLAG}`);
  originalFlag = flag.status === 200 ? flag.data === true : null;
  check(
    'อ่านค่า flag เดิม',
    flag.status === 200,
    `HTTP ${flag.status} · ${String(flag.data)}`,
  );

  const detail = await shop.post('/ecom/product-detail', {
    pro_code: PRO_CODE,
    mem_code: memCode,
  });
  stock = Number(detail.data?.pro_stock ?? 0);
  units = [1, 2, 3]
    .map((i) => ({
      name: String(detail.data?.[`pro_unit${i}`] ?? ''),
      ratio: Number(detail.data?.[`pro_ratio${i}`] ?? 0),
    }))
    .filter((u) => u.name && u.ratio > 0)
    .sort((a, b) => a.ratio - b.ratio);
  const small = units[0];
  const big = units[units.length - 1];
  check(
    'อ่านสต็อก + หน่วยจาก product-detail',
    detail.status === 201 && stock > 0 && Boolean(small) && big?.ratio > 1,
    `HTTP ${detail.status} · stock=${stock} · units=${units.map((u) => `${u.name}x${u.ratio}`).join(', ')}`,
  );
  if (!(stock > 0) || !small || !(big?.ratio > 1)) {
    throw new Error('สินค้าต้องมีสต็อก > 0 และมีหน่วยใหญ่ ratio > 1');
  }

  await removeFromCart();

  // ── flag ปิด: behavior เดิม ใส่เกินได้
  const off = await setFlag(false);
  check('ปิด flag', off.status === 201, `HTTP ${off.status}`);
  const overOff = await add(small, stock + 1);
  check(
    'flag ปิด: ใส่เกินสต็อก (stock+1) ได้เหมือนเดิม',
    overOff.status === 201,
    `HTTP ${overOff.status} · ในตะกร้า ${await cartSmallestUnits()}`,
  );
  await removeFromCart();

  // ── flag เปิด
  const on = await setFlag(true);
  check('เปิด flag', on.status === 201, `HTTP ${on.status}`);

  const exact = await add(small, stock);
  check(
    'ใส่พอดีสต็อก → สำเร็จ',
    exact.status === 201,
    `HTTP ${exact.status} · ในตะกร้า ${await cartSmallestUnits()}`,
  );

  const plusOne = await add(small, 1);
  check(
    'เพิ่มอีก 1 หน่วยเล็กสุด → 400 + ข้อความติดต่อฝ่ายขาย / Line @wangpharma',
    isLimit(plusOne) &&
      msg(plusOne).includes('ฝ่ายขาย') &&
      msg(plusOne).includes('Line @wangpharma'),
    `HTTP ${plusOne.status} · ${msg(plusOne)}`,
  );
  check(
    'ข้อความไม่เปิดเผยตัวเลขสต็อก',
    !new RegExp(`\\b${stock}\\b`).test(msg(plusOne)),
    `stock=${stock} · มีตัวเลขในข้อความ=${/\d/.test(msg(plusOne))}`,
  );
  const afterReject = await cartSmallestUnits();
  check(
    'ถูกปฏิเสธแล้วจำนวนในตะกร้าไม่เปลี่ยน',
    afterReject === stock,
    `ในตะกร้า ${afterReject} (คาด ${stock})`,
  );

  const minus = await add(small, -1);
  check(
    'ลดจำนวน 1 → ทำได้เสมอ',
    minus.status === 201,
    `HTTP ${minus.status} · ในตะกร้า ${await cartSmallestUnits()}`,
  );

  const bigOver = await add(big, 1);
  check(
    `เหลือที่ว่าง 1 แต่เพิ่ม 1 ${big.name} (=${big.ratio}) → 400`,
    isLimit(bigOver),
    `HTTP ${bigOver.status} · ${msg(bigOver)}`,
  );

  // ── นับข้ามหน่วย: หน่วยใหญ่เต็มเท่าที่ได้ + หน่วยเล็กส่วนที่เหลือ = พอดีสต็อก
  await removeFromCart();
  const bigQty = Math.floor(stock / big.ratio);
  const rest = stock - bigQty * big.ratio;
  if (bigQty > 0) {
    const r = await add(big, bigQty);
    check(
      `ใส่ ${bigQty} ${big.name} (= ${bigQty * big.ratio}) → สำเร็จ`,
      r.status === 201,
      `HTTP ${r.status}`,
    );
  }
  if (rest > 0) {
    const r = await add(small, rest);
    check(
      `ใส่ ${small.name} อีก ${rest} ให้พอดีสต็อก → สำเร็จ`,
      r.status === 201,
      `HTTP ${r.status}`,
    );
  }
  const mixed = await add(small, 1);
  check(
    'หลายหน่วยรวมกันพอดีสต็อกแล้ว เพิ่ม 1 หน่วยเล็กสุด → 400 (นับรวมทุกหน่วย)',
    isLimit(mixed),
    `HTTP ${mixed.status} · ในตะกร้า ${await cartSmallestUnits()}`,
  );

  // ── ปุ่ม "แจ้งฝ่ายขายให้ติดต่อกลับ" (ตะกร้าตอนนี้พอดีสต็อก)
  const cb1 = await requestCallback({
    pro_code: PRO_CODE,
    pro_unit: small.name,
    amount: 3,
  });
  const cbId = Number(cb1.data?.id);
  if (cbId) callbackIds.add(cbId);
  check(
    'แจ้งฝ่ายขายให้ติดต่อกลับ → 201 สร้างคำขอ',
    cb1.status === 201 && cbId > 0 && cb1.data?.status === 'open',
    `HTTP ${cb1.status} · ${JSON.stringify(cb1.data)}`,
  );
  const cb2 = await requestCallback({
    pro_code: PRO_CODE,
    pro_unit: big.name,
    amount: 2,
  });
  check(
    'กดซ้ำ (สินค้าเดิมที่ยังเปิดอยู่) → แถวเดิม ไม่สร้างใหม่ + ไม่นับเพิ่มภายใน 60 วิ',
    cb2.status === 201 &&
      Number(cb2.data?.id) === cbId &&
      cb2.data?.repeated === true,
    `HTTP ${cb2.status} · ${JSON.stringify(cb2.data)}`,
  );
  const badCb = await requestCallback({ pro_code: PRO_CODE, amount: '2a' });
  check(
    'แจ้งฝ่ายขาย: จำนวนไม่ใช่ตัวเลข → 400',
    badCb.status === 400,
    `HTTP ${badCb.status} · ${msg(badCb)}`,
  );
  const badCbUnit = await requestCallback({
    pro_code: PRO_CODE,
    pro_unit: 'หน่วยที่ไม่มีจริง E2E',
    amount: 1,
  });
  check(
    'แจ้งฝ่ายขาย: หน่วยไม่ถูกต้อง → 400',
    badCbUnit.status === 400,
    `HTTP ${badCbUnit.status} · ${msg(badCbUnit)}`,
  );
  const noToken = await axios.post(
    `${BASE_URL}/ecom/cart/stock-callback-request`,
    { pro_code: PRO_CODE, amount: 1 },
    { validateStatus: () => true },
  );
  check(
    'แจ้งฝ่ายขาย: ไม่มี token → ถูกปฏิเสธ',
    noToken.status === 401 || noToken.status === 403,
    `HTTP ${noToken.status}`,
  );

  const forbidden = await axios.get(
    `${BASE_URL}/ecom/internal/stock-callback-requests`,
    { validateStatus: () => true, headers: { 'x-internal-token': 'wrong' } },
  );
  check(
    'internal รายการ: token ผิด → 403',
    forbidden.status === 403,
    `HTTP ${forbidden.status}`,
  );
  if (INTERNAL_TOKEN) {
    const list = await internal.get('/ecom/internal/stock-callback-requests', {
      params: { status: 'open', q: PRO_CODE },
    });
    const row = ((list.data?.items ?? []) as any[]).find((r) => r.id === cbId);
    check(
      'internal รายการ: เห็นคำขอ + ร้าน/สินค้า/จำนวนที่ต้องการ (หน่วยเล็กสุด) + สต็อก',
      list.status === 200 &&
        row?.mem_code === memCode &&
        row?.pro_code === PRO_CODE &&
        row?.requested_smallest === stock + 2 * big.ratio &&
        row?.stock_smallest === stock &&
        row?.request_count === 1,
      `HTTP ${list.status} · ${JSON.stringify(row ?? {}).slice(0, 300)}`,
    );
    const done = await internal.patch(
      `/ecom/internal/stock-callback-requests/${cbId}`,
      {
        status: 'contacted',
        emp_code: 'E2E',
        emp_name: `E2E ${E2E_ENV}`,
        note: `E2E ${E2E_ENV} โทรแล้ว`,
      },
    );
    check(
      'internal เปลี่ยนสถานะ → ติดต่อแล้ว + บันทึกผู้ดำเนินการ/เวลา',
      done.status === 200 &&
        done.data?.status === 'contacted' &&
        done.data?.handled_by_emp === 'E2E' &&
        Boolean(done.data?.handled_at),
      `HTTP ${done.status} · ${done.data?.status} · ${done.data?.handled_by_name}`,
    );
    const badStatus = await internal.patch(
      `/ecom/internal/stock-callback-requests/${cbId}`,
      { status: 'toString', emp_code: 'E2E' },
    );
    check(
      'internal เปลี่ยนสถานะ: ค่าไม่รู้จัก → 400',
      badStatus.status === 400,
      `HTTP ${badStatus.status}`,
    );
    const cb3 = await requestCallback({
      pro_code: PRO_CODE,
      pro_unit: small.name,
      amount: 1,
    });
    if (Number(cb3.data?.id)) callbackIds.add(Number(cb3.data.id));
    check(
      'หลังติดต่อแล้ว ลูกค้ากดอีก → เปิดคำขอใหม่ (แถวใหม่)',
      cb3.status === 201 && Number(cb3.data?.id) !== cbId,
      `HTTP ${cb3.status} · id=${cb3.data?.id}`,
    );
  }

  // ── validation เดิมยังทำงาน (ตัวเลขผิด/หน่วยผิดไม่ถูกกลืนเป็นข้อความสต็อก)
  const badUnit = await shop.post('/ecom/product-add-cart', {
    mem_code: memCode,
    pro_code: PRO_CODE,
    pro_unit: 'หน่วยที่ไม่มีจริง E2E',
    amount: 1,
  });
  check(
    'หน่วยไม่ถูกต้อง → 400 ข้อความหน่วยเดิม (ไม่ใช่ข้อความสต็อก)',
    badUnit.status === 400 && !msg(badUnit).includes(MESSAGE_KEY),
    `HTTP ${badUnit.status} · ${msg(badUnit)}`,
  );
}

async function restore() {
  await removeFromCart();
  if (INTERNAL_TOKEN) {
    for (const id of callbackIds) {
      await internal.patch(`/ecom/internal/stock-callback-requests/${id}`, {
        status: 'closed',
        emp_code: 'E2E',
        emp_name: `E2E ${E2E_ENV}`,
        note: `E2E ${E2E_ENV} cleanup`,
      });
    }
  }
  if (originalFlag !== null) {
    const r = await setFlag(originalFlag);
    check(
      `คืนค่า flag เดิม (${String(originalFlag)}) + ลบสินค้าออกจากตะกร้า (cleanup)`,
      r.status === 201,
      `HTTP ${r.status}`,
    );
  }
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
  const ok = !failure && failed === 0 && steps.length > 0;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '');
  const lines = [
    '# E2E — ห้ามใส่ตะกร้าเกินสต็อก (ECWC-766)',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **ข้อมูลทดสอบ:** คำขอติดต่อกลับ #${[...callbackIds].join(', #') || '-'} (ปิดเมื่อจบ) · สินค้า \`${PRO_CODE}\` (stock ${stock}) · ร้าน \`${memCode || '-'}\` · flag \`${FLAG}\` คืนค่าเดิม (${String(originalFlag)}) เมื่อจบ`,
    `- **ผลรวม:** ${ok ? 'ผ่าน' : 'ไม่ผ่าน'} — ${steps.length - failed}/${steps.length} ขั้นผ่าน`,
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
  const name = `cart-stock-limit-${E2E_ENV}-${stamp}.md`;
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
