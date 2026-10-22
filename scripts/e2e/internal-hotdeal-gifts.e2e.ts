/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
/**
 * E2E: POST /ecom/internal/hotdeal-gifts — ของแถม Hot Deal ของรายการสินค้า สำหรับระบบภายใน (หน้า Key ขายของ sale)
 * ยิง API ที่รันอยู่จริง · อ่านอย่างเดียวทุกขั้น (route นี้คำนวณแล้วตอบ ไม่บันทึกและไม่แตะตะกร้า) รันได้ทุก environment
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod INTERNAL_API_TOKEN=<ค่าเดียวกับของ server> \
 *   BUY_CODE=<รหัสสินค้าที่เป็น "สินค้าซื้อ" ของ Hot Deal ที่เปิดอยู่> [NO_DEAL_CODE=<รหัสสินค้าที่ไม่มี Hot Deal>] \
 *   npx ts-node scripts/e2e/internal-hotdeal-gifts.e2e.ts
 *
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ไม่งั้นต้องระบุเอง
 * สคริปต์อ่านเงื่อนไขของดีลจาก GET /ecom/hotdeal/get-hotdeal-from-code/:pro_code แล้วเทียบผลกับ
 * POST /ecom/hotdeal/check-hotdeal-match (สูตรที่ตะกร้าลูกค้าใช้) — สองทางต้องได้จำนวนของแถมเท่ากัน
 *
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/internal-hotdeal-gifts-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000/api').replace(
  /\/+$/,
  '',
);
const TOKEN = process.env.INTERNAL_API_TOKEN ?? '';
const BUY_CODE = (process.env.BUY_CODE ?? '').trim();
const NO_DEAL_CODE = (process.env.NO_DEAL_CODE ?? '').trim();
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');

if (!TOKEN || !BUY_CODE || !E2E_ENV) {
  console.error(
    'ต้องตั้ง INTERNAL_API_TOKEN, BUY_CODE และ E2E_ENV เมื่อ BASE_URL ไม่ใช่ localhost',
  );
  process.exit(2);
}
if (E2E_ENV === 'local' && !IS_LOCAL) {
  console.error(`E2E_ENV=local แต่ BASE_URL=${BASE_URL} ไม่ใช่ localhost`);
  process.exit(2);
}

const http = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true,
  timeout: 30000,
});
const internal = { headers: { 'x-internal-token': TOKEN } };
const PATH = '/ecom/internal/hotdeal-gifts';

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

type Line = { pro_code: string; unit: string; amount: number };
const gifts = (lines: Line[]) => http.post(PATH, { items: lines }, internal);
// จำนวนของแถมที่ตะกร้าลูกค้าจะได้จากรายการเดียวกัน
const cartFreebies = async (lines: Line[]): Promise<number> => {
  const res = await http.post('/ecom/hotdeal/check-hotdeal-match', {
    hotDeal: [
      {
        pro_code: BUY_CODE,
        shopping_cart: lines.map((l) => ({
          pro1_unit: l.unit,
          pro1_amount: String(l.amount),
        })),
      },
    ],
  });
  const row = Array.isArray(res.data) ? res.data[0] : undefined;
  return row?.match ? Number(row.countFreeBies) : 0;
};

let dealText = '';

async function main() {
  const sample = [{ pro_code: BUY_CODE, unit: 'x', amount: 1 }];
  const noToken = await http.post(PATH, { items: sample });
  const wrongToken = await http.post(
    PATH,
    { items: sample },
    { headers: { 'x-internal-token': `${TOKEN}x` } },
  );
  check(
    'ไม่มี token หรือ token ผิด → 403 และไม่มีข้อมูลในคำตอบ',
    noToken.status === 403 &&
      wrongToken.status === 403 &&
      noToken.data?.gifts === undefined &&
      wrongToken.data?.gifts === undefined,
    `HTTP ${noToken.status} / ${wrongToken.status}`,
  );

  const noItems = await http.post(PATH, {}, internal);
  const badAmount = await http.post(
    PATH,
    { items: [{ pro_code: BUY_CODE, unit: 'x', amount: 0 }] },
    internal,
  );
  const tooMany = await http.post(
    PATH,
    {
      items: Array.from({ length: 201 }, () => ({
        pro_code: BUY_CODE,
        unit: 'x',
        amount: 1,
      })),
    },
    internal,
  );
  check(
    'ไม่ส่ง items / จำนวนเป็น 0 / เกิน 200 บรรทัด → 400',
    noItems.status === 400 &&
      badAmount.status === 400 &&
      tooMany.status === 400,
    `HTTP ${noItems.status} / ${badAmount.status} / ${tooMany.status}`,
  );

  const empty = await gifts([]);
  check(
    'รายการว่าง → 200 ไม่มีของแถม',
    empty.status === 200 &&
      Array.isArray(empty.data?.gifts) &&
      empty.data.gifts.length === 0,
    `HTTP ${empty.status} · ${JSON.stringify(empty.data)}`,
  );

  const dealRes = await http.get(
    `/ecom/hotdeal/get-hotdeal-from-code/${encodeURIComponent(BUY_CODE)}`,
  );
  const deal = dealRes.data;
  const buyAmount = Number(deal?.pro1_amount);
  const giftAmount = Number(deal?.pro2_amount);
  const buyUnit: string = deal?.pro1_unit ?? '';
  const giftUnit: string = deal?.pro2_unit ?? '';
  const giftCode: string = deal?.product2?.pro_code ?? '';
  if (
    dealRes.status !== 200 ||
    !giftCode ||
    !(buyAmount > 0) ||
    !(giftAmount > 0)
  ) {
    throw new Error(
      `สินค้า ${BUY_CODE} ไม่มี Hot Deal ที่ใช้ทดสอบได้ (HTTP ${dealRes.status}) — ตั้ง BUY_CODE เป็นสินค้าซื้อของดีลที่เปิดอยู่`,
    );
  }
  dealText = `ซื้อ ${buyAmount} ${buyUnit} แถม \`${giftCode}\` ${giftAmount} ${giftUnit}`;

  const line = (amount: number): Line[] => [
    { pro_code: BUY_CODE, unit: buyUnit, amount },
  ];

  const one = await gifts(line(buyAmount));
  const gift = one.data?.gifts?.[0];
  check(
    'ซื้อครบพอดี 1 ชุด → ของแถม 1 ชุด ตรงสินค้า จำนวน และหน่วยของดีล',
    one.status === 200 &&
      one.data.gifts.length === 1 &&
      gift.main_pro_code === BUY_CODE &&
      gift.pro_code === giftCode &&
      gift.amount === giftAmount &&
      gift.unit === giftUnit &&
      gift.sets === 1 &&
      gift.buy_amount === buyAmount &&
      gift.buy_unit === buyUnit &&
      gift.gift_amount === giftAmount &&
      typeof gift.pro_name === 'string',
    `HTTP ${one.status} · ${JSON.stringify(one.data?.gifts)}`,
  );

  if (buyAmount >= 2) {
    const below = await gifts(line(buyAmount - 1));
    check(
      'ซื้อขาด 1 หน่วยจากที่ดีลกำหนด → ไม่มีของแถม',
      below.status === 200 && below.data.gifts.length === 0,
      `HTTP ${below.status} · ${below.data?.gifts?.length ?? '-'} รายการ`,
    );
  } else {
    skip(
      'ซื้อขาด 1 หน่วยจากที่ดีลกำหนด → ไม่มีของแถม',
      'ดีลนี้กำหนดซื้อ 1 หน่วย ลดต่ำกว่านี้ไม่ได้',
    );
  }

  // สองบรรทัดของสินค้าเดียวกันต้องถูกรวมก่อนนับชุด: (ครบ 2 ชุด) + (อีก 1 ชุด) = 3 ชุด
  const split: Line[] = [...line(buyAmount * 2), ...line(buyAmount)];
  const three = await gifts(split);
  check(
    'สองบรรทัดของสินค้าเดียวกันรวมกันได้ 3 ชุด → ของแถม 3 เท่า เป็นบรรทัดเดียว',
    three.status === 200 &&
      three.data.gifts.length === 1 &&
      three.data.gifts[0].sets === 3 &&
      three.data.gifts[0].amount === giftAmount * 3,
    `HTTP ${three.status} · ${JSON.stringify(three.data?.gifts)}`,
  );

  const cases = [line(buyAmount), split, line(buyAmount * 2 + 1)];
  const pairs: string[] = [];
  let same = true;
  for (const lines of cases) {
    const mine = await gifts(lines);
    const internalAmount = Number(mine.data?.gifts?.[0]?.amount ?? 0);
    const cartAmount = await cartFreebies(lines);
    pairs.push(`${internalAmount}=${cartAmount}`);
    if (mine.status !== 200 || internalAmount !== cartAmount) same = false;
  }
  check(
    'จำนวนของแถมเท่ากับที่ตะกร้าลูกค้าได้ (check-hotdeal-match) ทั้ง 3 กรณี',
    same,
    `ภายใน=ตะกร้า: ${pairs.join(', ')}`,
  );

  const strange = await gifts([
    { pro_code: BUY_CODE, unit: 'E2E-หน่วยที่ไม่มี', amount: buyAmount * 50 },
  ]);
  check(
    'หน่วยที่ไม่ใช่ของสินค้า → ไม่เดาอัตราส่วน ไม่มีของแถม และรายงานใน skipped',
    strange.status === 200 &&
      strange.data.gifts.length === 0 &&
      strange.data.skipped?.[0]?.reason === 'unknown_unit' &&
      strange.data.skipped[0].pro_code === BUY_CODE,
    `HTTP ${strange.status} · ${JSON.stringify(strange.data)}`,
  );

  if (NO_DEAL_CODE) {
    const none = await gifts([
      { pro_code: NO_DEAL_CODE, unit: buyUnit, amount: 1000 },
    ]);
    check(
      'สินค้าที่ไม่มี Hot Deal → ไม่มีของแถม',
      none.status === 200 &&
        none.data.gifts.length === 0 &&
        none.data.skipped.length === 0,
      `HTTP ${none.status} · ${JSON.stringify(none.data)}`,
    );
  } else {
    skip('สินค้าที่ไม่มี Hot Deal → ไม่มีของแถม', 'ไม่ได้ตั้ง NO_DEAL_CODE');
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
      execSync('git status --porcelain -- src scripts', {
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
    '# E2E — ของแถม Hot Deal สำหรับระบบภายใน (POST /ecom/internal/hotdeal-gifts)',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **ดีลที่ใช้:** สินค้าซื้อ \`${BUY_CODE}\`${dealText ? ` — ${dealText}` : ''}`,
    '- **ข้อมูลทดสอบ:** ไม่ได้สร้าง (อ่านอย่างเดียว ใช้ดีลที่มีอยู่)',
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
  const name = `internal-hotdeal-gifts-${E2E_ENV}-${stamp}.md`;
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
  .then((failure) => process.exit(writeReport(failure) ? 0 : 1));
