/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * E2E: token ที่ได้จากลิงก์รีวิวทาง LINE (POST /ecom/auth/line-login-by-id) ใช้ได้เฉพาะการรีวิว
 * ยิง API ที่รันอยู่จริง ซึ่งต่อกับ notification-service ของ environment เดียวกัน
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod \
 *   LINE_LOGIN_VALUE=<ค่า line_user_id จากลิงก์รีวิวของบัญชี LINE ทดสอบที่ผูกกับร้านทดสอบ> \
 *   npx ts-node scripts/e2e/line-link-login-scope.e2e.ts
 *
 * ตัวเลือก:
 *   USER_TOKEN=<jwt ปกติของร้านทดสอบ (login ด้วยรหัสผ่าน)>  → ยืนยันว่าเส้นทางที่ถูกปฏิเสธ ไม่ได้ถูกปฏิเสธเพราะเหตุอื่น
 *
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ไม่งั้นต้องระบุเอง
 * สคริปต์อ่านอย่างเดียว ยกเว้นการ login เอง (สร้าง refresh token ของร้านทดสอบ 2 แถว — หมดอายุเองใน 18 ชั่วโมง)
 * ลิงก์รีวิวใช้ซ้ำได้ในช่วงสั้น ๆ หลังใช้ครั้งแรก — ใช้ลิงก์ใหม่ทุกครั้งที่รัน
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/line-link-login-scope-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3021/api').replace(
  /\/+$/,
  '',
);
const LINE_LOGIN_VALUE = process.env.LINE_LOGIN_VALUE ?? '';
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');

if (!LINE_LOGIN_VALUE || !E2E_ENV) {
  console.error(
    'ต้องตั้ง LINE_LOGIN_VALUE และ E2E_ENV เมื่อ BASE_URL ไม่ใช่ localhost',
  );
  process.exit(2);
}

const http = axios.create({ baseURL: BASE_URL, validateStatus: () => true });
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const claims = (token: string): Record<string, unknown> => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  } catch {
    return {};
  }
};

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

/** เส้นทางที่หน้ารีวิวเรียก — ต้องไม่ถูกปฏิเสธด้วยขอบเขต */
const reviewRoutes = (memCode: string) => [
  '/ecom/rating/config/select',
  '/ecom/rating/config/questionnaire',
  `/ecom/review-request/pending/${encodeURIComponent(memCode)}`,
];
/** เส้นทางที่ต้องมี token ของร้านแต่ไม่เกี่ยวกับการรีวิว (อ่านอย่างเดียว) */
const otherRoutes = (memCode: string) => [
  `/ecom/session/user-sessions/${encodeURIComponent(memCode)}`,
  '/ecom/products/flashsale-procode',
  '/ecom/admin/rating',
  '/ecom/admin/rating/stats',
];
const statuses = async (routes: string[], token: string) => {
  const results: number[] = [];
  for (const route of routes) {
    results.push((await http.get(route, { headers: bearer(token) })).status);
  }
  return results;
};

async function main() {
  const login = await http.post('/ecom/auth/line-login-by-id', {
    lineUserId: LINE_LOGIN_VALUE,
  });
  const token: string = login.data?.token ?? '';
  const refreshToken: string = login.data?.refresh_token ?? '';
  const payload = claims(token);
  const memCode = typeof payload.mem_code === 'string' ? payload.mem_code : '';
  check(
    'เข้าสู่ระบบด้วยค่าจากลิงก์รีวิว → token ขอบเขต review ไม่มีสิทธิ์ผู้ดูแล',
    login.status === 201 &&
      !!memCode &&
      payload.scope === 'review' &&
      payload.permission === false &&
      payload.admin_features === null &&
      claims(refreshToken).scope === 'review',
    `HTTP ${login.status} · scope=${String(payload.scope)} · permission=${String(payload.permission)} · refresh scope=${String(claims(refreshToken).scope)}`,
  );
  if (!token || !memCode) throw new Error('ไม่ได้ token จากลิงก์รีวิว');

  const review = await statuses(reviewRoutes(memCode), token);
  check(
    'เส้นทางของการรีวิวใช้ได้',
    review.every((status) => status === 200),
    `HTTP ${review.join(' / ')}`,
  );

  const other = await statuses(otherRoutes(memCode), token);
  const logoutAll = await http.post(
    '/ecom/session/logout-all',
    { mem_code: 'E2E-NOT-A-SHOP' },
    { headers: bearer(token) },
  );
  check(
    'เส้นทางอื่นของร้านและของผู้ดูแล → 403',
    other.every((status) => status === 403) && logoutAll.status === 403,
    `HTTP ${other.join(' / ')} · logout-all ${logoutAll.status}`,
  );

  const refreshed = await http.post('/ecom/refresh_token', {
    token: refreshToken,
  });
  const newToken: string = refreshed.data?.token ?? '';
  const afterRefresh = newToken
    ? await statuses(
        [otherRoutes(memCode)[1], reviewRoutes(memCode)[0]],
        newToken,
      )
    : [];
  check(
    'ต่ออายุ token → ยังเป็นขอบเขต review และยังใช้เส้นทางอื่นไม่ได้',
    refreshed.status === 201 &&
      claims(newToken).scope === 'review' &&
      claims(newToken).permission === false &&
      claims(refreshed.data?.refresh_token ?? '').scope === 'review' &&
      afterRefresh[0] === 403 &&
      afterRefresh[1] === 200,
    `HTTP ${refreshed.status} · scope=${String(claims(newToken).scope)} · เส้นทางอื่น ${afterRefresh[0]} · เส้นทางรีวิว ${afterRefresh[1]}`,
  );

  const controlStep =
    'token ปกติของร้านเดียวกัน (login ด้วยรหัสผ่าน) ไม่ถูกปฏิเสธด้วยขอบเขตที่เส้นทางเดียวกัน';
  if (!USER_TOKEN) skip(controlStep, 'ไม่ได้ตั้ง USER_TOKEN');
  else {
    const control = await statuses(
      otherRoutes(memCode).slice(0, 2),
      USER_TOKEN,
    );
    check(
      controlStep,
      control.every((status) => status !== 403 && status !== 401),
      `HTTP ${control.join(' / ')}`,
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
    '# E2E — token จากลิงก์รีวิวทาง LINE ใช้ได้เฉพาะการรีวิว',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    '- **ข้อมูลทดสอบ:** สคริปต์อ่านอย่างเดียว ยกเว้น refresh token ของร้านทดสอบที่เกิดจากการ login (หมดอายุเอง)',
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
  const name = `line-link-login-scope-${E2E_ENV}-${stamp}.md`;
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
