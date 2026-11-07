/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
/**
 * E2E: GET /ecom/internal/new-arrivals — ประวัติรับเข้าของสินค้าสำหรับระบบภายใน (sale ใช้กับปุ่ม F3)
 * ยิง API ที่รันอยู่จริง
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod INTERNAL_API_TOKEN=<ค่าเดียวกับของ server> PRO_CODE=<รหัสสินค้า> \
 *   npx ts-node scripts/e2e/internal-new-arrivals.e2e.ts
 *
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ไม่งั้นต้องระบุเอง
 *
 * ขั้นที่ "อ่านอย่างเดียว" รันได้ทุก environment
 * ขั้นที่ "ยิงรับเข้า" (POST /ecom/new-arrivals) รันเฉพาะ local เพราะบน deployed มันบวกสต็อกในตาราง lot
 * ส่ง Kafka ไป OrderPicking และแจ้งร้านที่จอง pre-order จริง — จะรันบน environment อื่นต้องตั้ง
 * ALLOW_ARRIVAL_WRITE=<ชื่อ environment เดียวกับ E2E_ENV> และห้ามใช้กับ prod
 * แถวทดสอบใช้ LOT ขึ้นต้น "E2E <env>" — ไม่มี API ลบ ต้องลบจากตาราง new_arrival / lot ด้วยมือ (รายงานบอกเลข LOT)
 *
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/internal-new-arrivals-<env>-<timestamp>.md
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
const PRO_CODE = (process.env.PRO_CODE ?? '').trim();
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const CAN_WRITE =
  E2E_ENV !== 'prod' &&
  (E2E_ENV === 'local' || process.env.ALLOW_ARRIVAL_WRITE === E2E_ENV);

if (!TOKEN || !PRO_CODE || !E2E_ENV) {
  console.error(
    'ต้องตั้ง INTERNAL_API_TOKEN, PRO_CODE และ E2E_ENV เมื่อ BASE_URL ไม่ใช่ localhost',
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
const PATH = '/ecom/internal/new-arrivals';

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

const FIELDS = [
  'id',
  'pro_code',
  'received_at',
  'lot',
  'mfg',
  'exp',
  'amount',
  'unit',
];
const wellFormed = (row: any): boolean =>
  !!row &&
  Object.keys(row).sort().join() === [...FIELDS].sort().join() &&
  row.pro_code === PRO_CODE &&
  /^\d{4}-\d{2}-\d{2}$/.test(row.received_at) &&
  (row.amount === null || Number.isInteger(row.amount)) &&
  (row.unit === null || typeof row.unit === 'string');
const newestFirst = (rows: any[]): boolean =>
  rows.every(
    (row, i) =>
      i === 0 ||
      rows[i - 1].received_at > row.received_at ||
      (rows[i - 1].received_at === row.received_at && rows[i - 1].id > row.id),
  );

let testLot = '';

async function main() {
  const noToken = await http.get(PATH, { params: { pro_code: PRO_CODE } });
  const wrongToken = await http.get(PATH, {
    params: { pro_code: PRO_CODE },
    headers: { 'x-internal-token': `${TOKEN}x` },
  });
  check(
    'ไม่มี token หรือ token ผิด → 403 และไม่มีข้อมูลในคำตอบ',
    noToken.status === 403 &&
      wrongToken.status === 403 &&
      !Array.isArray(noToken.data) &&
      !Array.isArray(wrongToken.data),
    `HTTP ${noToken.status} / ${wrongToken.status}`,
  );

  const noCode = await http.get(PATH, internal);
  const blankCode = await http.get(PATH, {
    ...internal,
    params: { pro_code: '  ' },
  });
  check(
    'ไม่ส่ง pro_code หรือส่งค่าว่าง → 400',
    noCode.status === 400 && blankCode.status === 400,
    `HTTP ${noCode.status} / ${blankCode.status}`,
  );

  const unknown = await http.get(PATH, {
    ...internal,
    params: { pro_code: 'E2E-NO-SUCH-CODE' },
  });
  check(
    'รหัสสินค้าที่ไม่มีการรับเข้า → 200 และรายการว่าง',
    unknown.status === 200 &&
      Array.isArray(unknown.data) &&
      unknown.data.length === 0,
    `HTTP ${unknown.status} · ${Array.isArray(unknown.data) ? unknown.data.length : '-'} แถว`,
  );

  const writeSteps = [
    'ยิงรับเข้า 2 ครั้งต่างวัน → อ่านกลับได้จำนวน หน่วย LOT วันผลิต วันหมดอายุ ตรงกับที่ส่ง ใหม่สุดอยู่บน',
    'ยิงรายการเดิมซ้ำ → ไม่เกิดแถวเพิ่ม',
    'จำนวนที่ไม่ใช่ตัวเลข → ถูกปฏิเสธทั้งชุดโดยไม่มีแถวค้าง (พฤติกรรมเดิมของตาราง lot) หรือรับเข้าโดยจำนวนเป็น null',
  ];
  if (!CAN_WRITE) {
    for (const name of writeSteps) {
      skip(
        name,
        `ไม่ยิงรับเข้าบน ${E2E_ENV} (มีผลกับสต็อก Kafka และการแจ้ง pre-order จริง)`,
      );
    }
  } else {
    // LOT ยาวได้ 20 ตัวอักษร: "E2E <env> " + เวลา
    const stamp = Date.now().toString(36).toUpperCase();
    testLot = `E2E ${E2E_ENV} ${stamp}`.slice(0, 20);
    const arrival = (createdAt: string, amount: unknown, unit: string) => ({
      pro_code: PRO_CODE,
      LOT: testLot,
      MFG: '2026-09-01',
      EXP: '2028-08-31',
      createdAt,
      amount,
      unit,
    });
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const older = arrival(`${day(1)}T12:00:00`, 120, 'กล่อง');
    const newer = arrival(`${day(2)}T12:00:00`, 36, 'ขวด');
    const post = await http.post('/ecom/new-arrivals', [older, newer]);
    const mine = async () => {
      const res = await http.get(PATH, {
        ...internal,
        params: { pro_code: PRO_CODE, limit: 50 },
      });
      return (Array.isArray(res.data) ? res.data : []).filter(
        (row: any) => row.lot === testLot,
      );
    };
    const rows = await mine();
    check(
      writeSteps[0],
      post.status === 201 &&
        rows.length === 2 &&
        rows[0].received_at === day(2) &&
        rows[0].amount === 36 &&
        rows[0].unit === 'ขวด' &&
        rows[1].received_at === day(1) &&
        rows[1].amount === 120 &&
        rows[1].unit === 'กล่อง' &&
        rows.every(
          (row: any) => row.mfg === '2026-09-01' && row.exp === '2028-08-31',
        ),
      `HTTP ${post.status} · ${rows.map((row: any) => `${row.received_at} ${row.amount} ${row.unit}`).join(' , ')}`,
    );

    const again = await http.post('/ecom/new-arrivals', [older, newer]);
    const afterAgain = await mine();
    check(
      writeSteps[1],
      again.status === 201 && afterAgain.length === 2,
      `HTTP ${again.status} · ${afterAgain.length} แถว`,
    );

    const odd = await http.post('/ecom/new-arrivals', [
      arrival(`${day(3)}T12:00:00`, 'ไม่ใช่ตัวเลข', 'กล่อง'),
    ]);
    const afterOdd = await mine();
    // ตาราง lot รับจำนวนที่ไม่ใช่ตัวเลขไม่ได้อยู่เดิม: ถ้าทั้งชุดถูกปฏิเสธก็ต้องไม่มีแถวเพิ่ม
    check(
      writeSteps[2],
      (odd.status === 201 &&
        afterOdd.length === 3 &&
        afterOdd[0].amount === null) ||
        (odd.status >= 400 && afterOdd.length === 2),
      `HTTP ${odd.status} · ${afterOdd.length} แถว · จำนวนของแถวบนสุด=${String(afterOdd[0]?.amount)}`,
    );
  }

  const list = await http.get(PATH, {
    ...internal,
    params: { pro_code: PRO_CODE },
  });
  const rows: any[] = Array.isArray(list.data) ? list.data : [];
  const listStep =
    'สินค้าที่มีการรับเข้า → 200 ไม่เกิน 6 แถว (ค่าตั้งต้น) ครบทุกช่อง เรียงใหม่สุดก่อน';
  if (list.status === 200 && rows.length === 0) {
    skip(listStep, `สินค้า ${PRO_CODE} ยังไม่มีการรับเข้าใน environment นี้`);
  } else {
    check(
      listStep,
      list.status === 200 &&
        rows.length <= 6 &&
        rows.every(wellFormed) &&
        newestFirst(rows),
      `HTTP ${list.status} · ${rows.length} แถว · มีจำนวน ${rows.filter((row) => row.amount !== null).length} แถว`,
    );
  }

  const one = await http.get(PATH, {
    ...internal,
    params: { pro_code: PRO_CODE, limit: 1 },
  });
  const huge = await http.get(PATH, {
    ...internal,
    params: { pro_code: PRO_CODE, limit: 99999 },
  });
  const bad = await http.get(PATH, {
    ...internal,
    params: { pro_code: PRO_CODE, limit: 'abc' },
  });
  check(
    'limit: 1 → ไม่เกิน 1 แถว · เกินเพดาน → ไม่เกิน 50 แถว · ไม่ใช่ตัวเลข → ใช้ค่าตั้งต้น',
    one.status === 200 &&
      Array.isArray(one.data) &&
      one.data.length <= 1 &&
      huge.status === 200 &&
      Array.isArray(huge.data) &&
      huge.data.length <= 50 &&
      bad.status === 200 &&
      Array.isArray(bad.data) &&
      bad.data.length <= 6,
    `HTTP ${one.status} / ${huge.status} / ${bad.status} · ${one.data?.length ?? '-'} / ${huge.data?.length ?? '-'} / ${bad.data?.length ?? '-'} แถว`,
  );
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
    '# E2E — ประวัติรับเข้าของสินค้าสำหรับระบบภายใน (GET /ecom/internal/new-arrivals)',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **สินค้าที่ใช้:** \`${PRO_CODE}\``,
    `- **ข้อมูลทดสอบ:** ${testLot ? `แถวรับเข้า LOT \`${testLot}\` ของสินค้า \`${PRO_CODE}\` — **ยังอยู่ในตาราง new_arrival และ lot ต้องลบด้วยมือ**` : 'ไม่ได้สร้าง (อ่านอย่างเดียว)'}`,
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
  const name = `internal-new-arrivals-${E2E_ENV}-${stamp}.md`;
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
