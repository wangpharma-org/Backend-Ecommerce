/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * E2E: POST /ecom/auth/line-bind — ยืนยันตัวตนผ่าน LINE ต้องผูกกับร้านของผู้ที่ login อยู่เท่านั้น
 * ยิง API ที่รันอยู่จริง ซึ่งต่อกับ notification-service ของ environment เดียวกัน
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod USER_TOKEN=<jwt ของร้านทดสอบ> \
 *   LINE_USER_ID=U<32 hex ของบัญชี LINE ทดสอบ> npx ts-node scripts/e2e/line-bind.e2e.ts
 *
 * ตัวเลือก:
 *   EXPECT_ENFORCE=true      notification-service เปิด LINE_BIND_ENFORCE_PROOF แล้ว → ลิงก์รุ่นเก่า (LINE userId ดิบ) ต้องถูกปฏิเสธ
 *   LINK_TICKET_SECRET=...   ความลับที่ notification-service ใช้เซ็นตั๋ว → รันขั้นสำเร็จได้ (เขียนข้อมูล)
 *   NOTIFICATION_URL=...     ฐานของ notification-service → ตรวจว่าบัญชี LINE ถูกผูกกับร้านไหนหลังแต่ละขั้น
 *   ALLOW_WRITE=1            อนุญาตขั้นที่เขียนข้อมูลบน environment ที่ไม่ใช่ local
 *
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ไม่งั้นต้องระบุเอง
 * ขั้นสำเร็จผูกบัญชี LINE ทดสอบกับร้านของ USER_TOKEN — ใช้ร้านและบัญชี LINE ทดสอบเท่านั้น
 * notification-service ไม่มี endpoint ลบ ต้องลบแถวทดสอบเองหลังรัน (คำสั่งอยู่ในรายงาน)
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/line-bind-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { createHmac } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3021/api').replace(
  /\/+$/,
  '',
);
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const LINE_USER_ID = (process.env.LINE_USER_ID ?? '').trim();
const LINK_TICKET_SECRET = process.env.LINK_TICKET_SECRET ?? '';
const NOTIFICATION_URL = (process.env.NOTIFICATION_URL ?? '').replace(
  /\/+$/,
  '',
);
const EXPECT_ENFORCE = process.env.EXPECT_ENFORCE === 'true';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const ALLOW_WRITE = IS_LOCAL || process.env.ALLOW_WRITE === '1';

if (!USER_TOKEN || !/^U[0-9a-f]{32}$/.test(LINE_USER_ID) || !E2E_ENV) {
  console.error(
    'ต้องตั้ง USER_TOKEN, LINE_USER_ID (U ตามด้วย hex 32 ตัว) และ E2E_ENV เมื่อ BASE_URL ไม่ใช่ localhost',
  );
  process.exit(2);
}

const http = axios.create({ baseURL: BASE_URL, validateStatus: () => true });
const tokenShop = (() => {
  try {
    const payload = JSON.parse(
      Buffer.from(USER_TOKEN.split('.')[1], 'base64url').toString(),
    );
    return typeof payload.mem_code === 'string' ? payload.mem_code : '';
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

/** ตั๋วรูปแบบเดียวกับ notification-service (src/users/line-link-ticket.ts) */
function ticket(secret: string, expiresInMs = 3600 * 1000): string {
  const body = Buffer.from(
    JSON.stringify({ u: LINE_USER_ID, exp: Date.now() + expiresInMs }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update('lt1.' + body)
    .digest('base64url');
  return `lt1.${body}.${signature}`;
}

const bind = (
  body: Record<string, unknown>,
  token: string | null = USER_TOKEN,
) =>
  http.post('/ecom/auth/line-bind', body, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

/** ร้านที่บัญชี LINE ทดสอบผูกอยู่ — undefined = ไม่ได้ตั้ง NOTIFICATION_URL จึงตรวจไม่ได้ */
async function boundTo(): Promise<string | null | undefined> {
  if (!NOTIFICATION_URL) return undefined;
  const res = await axios.post(
    `${NOTIFICATION_URL}/api/notifications/line/verify-user-id`,
    { lineUserId: LINE_USER_ID },
    { validateStatus: () => true },
  );
  return res.status < 300 && typeof res.data?.mem_code === 'string'
    ? res.data.mem_code
    : null;
}

let wrote = false;

async function main() {
  if (!tokenShop) throw new Error('USER_TOKEN ไม่มี mem_code');
  const before = await boundTo();
  if (before) {
    throw new Error(
      `บัญชี LINE ทดสอบผูกกับร้าน ${before} อยู่แล้ว — ลบข้อมูลทดสอบหรือใช้บัญชีที่ยังไม่ผูก`,
    );
  }

  let res = await bind({ lineToken: LINE_USER_ID }, null);
  check('ไม่มี token ของร้าน → 401', res.status === 401, `HTTP ${res.status}`);

  res = await bind({ lineToken: LINE_USER_ID }, `${USER_TOKEN}x`);
  check('token ของร้านถูกแก้ → 401', res.status === 401, `HTTP ${res.status}`);

  res = await bind({});
  check(
    'ไม่มีค่า token จากลิงก์ → 400',
    res.status === 400,
    `HTTP ${res.status}`,
  );

  res = await bind({ lineToken: ticket('e2e-not-the-server-secret') });
  check(
    'ตั๋วเซ็นด้วยความลับอื่น → 400',
    res.status === 400,
    `HTTP ${res.status} — ${String(res.data?.message ?? '')}`,
  );

  if (EXPECT_ENFORCE) {
    res = await bind({ lineToken: LINE_USER_ID });
    check(
      'ลิงก์รุ่นเก่า (LINE userId ดิบ) → 400',
      res.status === 400,
      `HTTP ${res.status} — ${String(res.data?.message ?? '')}`,
    );
  } else {
    skip(
      'ลิงก์รุ่นเก่า (LINE userId ดิบ) → 400',
      'ไม่ได้ตั้ง EXPECT_ENFORCE=true (notification-service ยังรับแบบเดิม)',
    );
  }

  if (LINK_TICKET_SECRET) {
    res = await bind({ lineToken: ticket(LINK_TICKET_SECRET, -60000) });
    check(
      'ตั๋วหมดอายุ → 400 พร้อมข้อความให้ขอลิงก์ใหม่',
      res.status === 400 && /หมดอายุ/.test(String(res.data?.message ?? '')),
      `HTTP ${res.status} — ${String(res.data?.message ?? '')}`,
    );
  } else {
    skip('ตั๋วหมดอายุ → 400', 'ไม่ได้ตั้ง LINK_TICKET_SECRET');
  }

  const afterRejects = await boundTo();
  if (afterRejects === undefined) {
    skip(
      'หลังถูกปฏิเสธทั้งหมด บัญชี LINE ยังไม่ถูกผูก',
      'ไม่ได้ตั้ง NOTIFICATION_URL',
    );
  } else {
    check(
      'หลังถูกปฏิเสธทั้งหมด บัญชี LINE ยังไม่ถูกผูก',
      afterRejects === null,
      afterRejects === null ? 'ไม่พบการผูก' : `ผูกกับ ${afterRejects}`,
    );
  }

  const successStep =
    'ตั๋วถูกต้อง + token ของร้าน → 200 และผูกกับร้านใน token แม้ body ส่งรหัสร้านอื่นมา';
  if (!LINK_TICKET_SECRET) skip(successStep, 'ไม่ได้ตั้ง LINK_TICKET_SECRET');
  else if (!ALLOW_WRITE)
    skip(successStep, 'ไม่ได้ตั้ง ALLOW_WRITE=1 จึงไม่เขียนข้อมูล');
  else {
    res = await bind({
      lineToken: ticket(LINK_TICKET_SECRET),
      memCode: 'E2E-SOMEONE-ELSE',
      mem_code: 'E2E-SOMEONE-ELSE',
    });
    wrote = res.status === 200;
    const now = await boundTo();
    check(
      successStep,
      res.status === 200 &&
        res.data?.linked === true &&
        (now === undefined || now === tokenShop),
      `HTTP ${res.status}, ${now === undefined ? 'ไม่ได้ตรวจกับ notification-service' : `บัญชี LINE ผูกกับ ${now ?? '-'} (ร้านใน token: ${tokenShop})`}`,
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
    '# E2E — ยืนยันตัวตนผ่าน LINE ผ่าน backend (POST /ecom/auth/line-bind)',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **notification-service:** ${EXPECT_ENFORCE ? 'เปิด LINE_BIND_ENFORCE_PROOF' : 'ยังไม่บังคับหลักฐาน'}${NOTIFICATION_URL ? ` · ตรวจผลที่ ${NOTIFICATION_URL}` : ' · ไม่ได้ตรวจผลฝั่ง notification-service'}`,
    `- **ข้อมูลทดสอบ:** ${wrote ? `บัญชี LINE ทดสอบถูกผูกกับร้าน \`${tokenShop}\` ใน notification-service — ไม่มี endpoint ลบ ต้องลบเอง: \`DELETE l FROM user_line_id l JOIN users u ON u.id = l.user_id WHERE u.mem_code = '${tokenShop}'\`` : 'ไม่มีอะไรถูกเขียน'}`,
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
  const file = join(dir, `line-bind-${E2E_ENV}-${stamp}.md`);
  writeFileSync(file, lines.join('\n'));
  console.error(`รายงาน: docs/e2e/line-bind-${E2E_ENV}-${stamp}.md`);
  return ok;
}

main()
  .then(() => undefined)
  .catch((e: unknown) => {
    const failure = e instanceof Error ? e.message : String(e);
    console.error(`หยุดกลางทาง: ${failure}`);
    return failure;
  })
  .then((failure) => process.exit(writeReport(failure) ? 0 : 1));
