/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * E2E: endpoint ของ session จัดการได้เฉพาะ session ของร้านตัวเอง (ผู้ดูแลจัดการของร้านอื่นได้)
 * ยิง API ที่รันอยู่จริง
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod \
 *   USER_TOKEN=<jwt ของร้านทดสอบ ก> OTHER_TOKEN=<jwt ของร้านทดสอบ ข> \
 *   npx ts-node scripts/e2e/session-own-shop.e2e.ts
 *
 * ตัวเลือก: ADMIN_TOKEN=<jwt ของบัญชีผู้ดูแล> → ยืนยันว่าผู้ดูแลยังดู session ของร้านอื่นได้ (อ่านอย่างเดียว)
 *
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ไม่งั้นต้องระบุเอง
 * ใช้ **ร้านทดสอบสองร้านเท่านั้น** สคริปต์สร้าง session ของแต่ละร้านหนึ่งรายการ (อุปกรณ์ชื่อ "E2E <env>")
 * แล้วปิดเองเมื่อจบ — ไม่แตะ session อื่นของร้าน
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/session-own-shop-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3021/api').replace(
  /\/+$/,
  '',
);
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const OTHER_TOKEN = process.env.OTHER_TOKEN ?? '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');

const memCodeOf = (token: string): string => {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );
    return typeof payload.mem_code === 'string' ? payload.mem_code : '';
  } catch {
    return '';
  }
};
const shopA = memCodeOf(USER_TOKEN);
const shopB = memCodeOf(OTHER_TOKEN);
if (!shopA || !shopB || shopA === shopB || !E2E_ENV) {
  console.error(
    'ต้องตั้ง USER_TOKEN และ OTHER_TOKEN ของร้านทดสอบสองร้านที่ต่างกัน และ E2E_ENV เมื่อ BASE_URL ไม่ใช่ localhost',
  );
  process.exit(2);
}

const http = axios.create({ baseURL: BASE_URL, validateStatus: () => true });
const as = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

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

const createSession = (token: string) =>
  http.post(
    '/ecom/session/create',
    {
      session_token: token,
      ip_address: '127.0.0.1',
      user_agent: `E2E ${E2E_ENV} session-own-shop`,
      device_type: `E2E ${E2E_ENV}`,
    },
    as(token),
  );
const isValid = async (token: string) =>
  (await http.get(`/ecom/session/validate/${token}`, as(token))).data?.is_valid;
let created = false;

async function main() {
  const a = await createSession(USER_TOKEN);
  const b = await createSession(OTHER_TOKEN);
  created = a.status === 201 || b.status === 201;
  if (a.status !== 201 || b.status !== 201) {
    throw new Error(
      `สร้าง session ทดสอบไม่ได้ (HTTP ${a.status} / ${b.status})`,
    );
  }

  const ownList = await http.get(
    `/ecom/session/user-sessions/${shopA}`,
    as(USER_TOKEN),
  );
  const ownCount = await http.get(
    `/ecom/session/count/${shopA}`,
    as(USER_TOKEN),
  );
  check(
    'ร้าน ก ดูรายการและจำนวน session ของตัวเองได้',
    ownList.status === 200 &&
      Array.isArray(ownList.data) &&
      ownList.data.length >= 1 &&
      ownCount.status === 200 &&
      ownCount.data?.active_sessions_count >= 1,
    `HTTP ${ownList.status} (${Array.isArray(ownList.data) ? ownList.data.length : '-'} รายการ) / ${ownCount.status}`,
  );

  const otherList = await http.get(
    `/ecom/session/user-sessions/${shopB}`,
    as(USER_TOKEN),
  );
  const otherCount = await http.get(
    `/ecom/session/count/${shopB}`,
    as(USER_TOKEN),
  );
  const otherActive = await http.get(
    `/ecom/session/active/${OTHER_TOKEN}`,
    as(USER_TOKEN),
  );
  check(
    'ร้าน ก ดู session ของร้าน ข ไม่ได้ (รายการ / จำนวน / รายละเอียด) → 403',
    otherList.status === 403 &&
      otherCount.status === 403 &&
      otherActive.status === 403,
    `HTTP ${otherList.status} / ${otherCount.status} / ${otherActive.status}`,
  );

  const logoutAll = await http.post(
    '/ecom/session/logout-all',
    { mem_code: shopB },
    as(USER_TOKEN),
  );
  const logoutRecent = await http.post(
    '/ecom/session/logout-recent',
    { mem_code: shopB },
    as(USER_TOKEN),
  );
  const logoutOne = await http.post(
    '/ecom/session/logout',
    { session_token: OTHER_TOKEN },
    as(USER_TOKEN),
  );
  const stillValid = await isValid(OTHER_TOKEN);
  check(
    'ร้าน ก ปิด session ของร้าน ข ไม่ได้ (ทั้งหมด / ที่ใช้งานอยู่ / ทีละรายการ) — session ของร้าน ข ยังใช้ได้',
    logoutAll.status === 403 &&
      logoutRecent.status === 403 &&
      stillValid === true,
    `HTTP ${logoutAll.status} / ${logoutRecent.status} / ${logoutOne.status} · session ร้าน ข ยังใช้ได้=${String(stillValid)}`,
  );

  const ownActive = await http.get(
    `/ecom/session/active/${USER_TOKEN}`,
    as(USER_TOKEN),
  );
  check(
    'รายละเอียด session ของตัวเอง: ได้ และไม่มีรหัสผ่านของร้านในคำตอบ',
    ownActive.status === 200 &&
      ownActive.data?.mem_code === shopA &&
      !JSON.stringify(ownActive.data).includes('mem_password'),
    `HTTP ${ownActive.status} · มี mem_password=${JSON.stringify(ownActive.data ?? {}).includes('mem_password')}`,
  );

  const adminStep = 'ผู้ดูแลยังดู session ของร้านอื่นได้';
  if (!ADMIN_TOKEN) skip(adminStep, 'ไม่ได้ตั้ง ADMIN_TOKEN');
  else {
    const adminList = await http.get(
      `/ecom/session/user-sessions/${shopB}`,
      as(ADMIN_TOKEN),
    );
    check(
      adminStep,
      adminList.status === 200 && Array.isArray(adminList.data),
      `HTTP ${adminList.status}`,
    );
  }

  const outA = await http.post(
    '/ecom/session/logout',
    { session_token: USER_TOKEN },
    as(USER_TOKEN),
  );
  const outB = await http.post(
    '/ecom/session/logout',
    { session_token: OTHER_TOKEN },
    as(OTHER_TOKEN),
  );
  const afterA = await isValid(USER_TOKEN);
  const afterB = await isValid(OTHER_TOKEN);
  created = afterA === true || afterB === true;
  check(
    'แต่ละร้านปิด session ของตัวเองได้ (เก็บกวาด)',
    outA.status === 201 &&
      outB.status === 201 &&
      afterA === false &&
      afterB === false,
    `HTTP ${outA.status} / ${outB.status} · ยังใช้ได้=${String(afterA)} / ${String(afterB)}`,
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
    '# E2E — endpoint ของ session จัดการได้เฉพาะร้านของตัวเอง',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **ข้อมูลทดสอบ:** session ของร้านทดสอบ \`${shopA}\` และ \`${shopB}\` ร้านละหนึ่งรายการ (อุปกรณ์ "E2E ${E2E_ENV}") — ${created ? '**ยังเปิดค้างอยู่ ต้องปิดด้วยมือ**' : 'ปิดแล้ว'}`,
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
  const name = `session-own-shop-${E2E_ENV}-${stamp}.md`;
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
