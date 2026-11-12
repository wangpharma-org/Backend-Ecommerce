/* eslint-disable no-console */
/**
 * E2E: ECWC-749 — เปิด/ปิด/ดูรายการ feature flag ได้เฉพาะ Admin หรือคนที่ได้เมนู "feature-flag"
 * และทุกการเปลี่ยนมีประวัติ (feature_flag_log)
 *
 * ใช้ (local — สคริปต์เซ็น token เองจาก ACCESS_TOKEN_SECRET ครบทุกบทบาท):
 *   BASE_URL=http://localhost:3051/api npx ts-node scripts/e2e/feature-flag-admin.e2e.ts
 * ใช้ (deployed):
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod SHOP_TOKEN=<ร้านทดสอบ> ADMIN_TOKEN=<Admin> \
 *   [SALES_TOKEN=<Sales ไม่มีเมนู feature-flag>] [MENU_TOKEN=<บัญชีที่ได้เมนู feature-flag>] \
 *   npx ts-node scripts/e2e/feature-flag-admin.e2e.ts
 *
 * ใช้ flag ทดสอบของตัวเอง `e2e-<env>-ecwc749` เท่านั้น ไม่เปลี่ยน flag จริง
 * (ขั้น "ร้านค้าแตะ flag all" ส่ง status=true ซึ่งเป็นค่าปัจจุบันบน prod — ถ้าช่องโหว่ยังอยู่ก็ไม่เปลี่ยนอะไร)
 * จบแล้ว flag ทดสอบถูกตั้งเป็นปิด · ลบแถวทิ้งไม่ได้ผ่าน API (local ลบด้วย DB เอง)
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/feature-flag-admin-<env>-<timestamp>.md
 */
import { JwtService } from '@nestjs/jwt';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? '').replace(/\/+$/, '');
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const FLAG = `e2e-${E2E_ENV}-ecwc749`;
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

if (!BASE_URL || !E2E_ENV) {
  console.error('ต้องตั้ง BASE_URL และ E2E_ENV เมื่อไม่ใช่ localhost');
  process.exit(2);
}
if (E2E_ENV === 'local' && !IS_LOCAL) {
  console.error('E2E_ENV=local แต่ BASE_URL ไม่ใช่ localhost');
  process.exit(2);
}

interface Tokens {
  shop: string;
  admin: string;
  sales?: string;
  menu?: string;
  reviewAdmin?: string;
}

async function tokens(): Promise<Tokens> {
  if (E2E_ENV !== 'local') {
    const shop = process.env.SHOP_TOKEN ?? '';
    const admin = process.env.ADMIN_TOKEN ?? '';
    if (!shop || !admin) {
      console.error('deployed ต้องตั้ง SHOP_TOKEN และ ADMIN_TOKEN');
      process.exit(2);
    }
    return {
      shop,
      admin,
      sales: process.env.SALES_TOKEN || undefined,
      menu: process.env.MENU_TOKEN || undefined,
    };
  }
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    console.error('local ต้องมี ACCESS_TOKEN_SECRET ใน env');
    process.exit(2);
  }
  const jwt = new JwtService({ secret });
  const sign = (p: Record<string, unknown>) =>
    jwt.signAsync(
      { name: `E2E ${E2E_ENV}`, price_option: 'C', ...p },
      { expiresIn: '15m' },
    );
  return {
    shop: await sign({
      mem_code: 'E2E-C01',
      username: 'E2E-C01',
      role: 'User',
      permission: false,
    }),
    sales: await sign({
      mem_code: 'E2E-S01',
      username: 'e2e-sales',
      role: 'Sales',
      permission: true,
      admin_features: [],
    }),
    menu: await sign({
      mem_code: 'E2E-S02',
      username: 'e2e-sales-menu',
      role: 'Sales',
      permission: true,
      admin_features: ['feature-flag'],
    }),
    admin: await sign({
      mem_code: 'E2E-A01',
      username: 'e2e-admin',
      role: 'Admin',
      permission: true,
    }),
    reviewAdmin: await sign({
      mem_code: 'E2E-A01',
      username: 'e2e-admin',
      role: 'Admin',
      permission: true,
      scope: 'review',
    }),
  };
}

const memOf = (token: string): string => {
  try {
    const p = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    ) as { mem_code?: unknown };
    return typeof p.mem_code === 'string' ? p.mem_code : '';
  } catch {
    return '';
  }
};

async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // ไม่ใช่ JSON
  }
  return { status: res.status, body: parsed };
}

type Step = {
  name: string;
  result: 'ผ่าน' | 'ไม่ผ่าน' | 'ข้าม';
  observed: string;
};
const steps: Step[] = [];
const check = (name: string, ok: boolean, observed: string) => {
  steps.push({ name, result: ok ? 'ผ่าน' : 'ไม่ผ่าน', observed });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${observed}`);
};
const skip = (name: string, why: string) => {
  steps.push({ name, result: 'ข้าม', observed: why });
  console.log(`SKIP ${name} — ${why}`);
};
const flagValue = async () =>
  (await call('GET', `/ecom/feature-flag/${FLAG}`)).body;
const update = (token: string | undefined, body: unknown) =>
  call('POST', '/ecom/feature-flag/update-flag', token, body);

async function main() {
  const t = await tokens();
  const startedAt = new Date();

  // เตรียม flag ทดสอบให้มีอยู่และเปิด (GET สาธารณะสร้างให้เองเมื่อยังไม่มี)
  const pub = await call('GET', `/ecom/feature-flag/${FLAG}`);
  check(
    'อ่าน flag ตัวเดียวแบบไม่ล็อกอิน ยังได้ (หน้าเว็บลูกค้าใช้)',
    pub.status === 200,
    `HTTP ${pub.status} → ${JSON.stringify(pub.body)}`,
  );
  // จำ id ล่าสุดของประวัติก่อนเริ่ม — ไม่กรองด้วยเวลา เพราะ created_at มาจากเวลาของ DB
  // ซึ่งอาจคนละ timezone กับเครื่องที่รันสคริปต์ (เจอ +7 ชม. บน local)
  const before = await call(
    'GET',
    `/ecom/feature-flag-logs?flag=${encodeURIComponent(FLAG)}&limit=1`,
    t.admin,
  );
  const baselineId =
    Array.isArray(before.body) && before.body.length
      ? Number((before.body as Array<{ id: number }>)[0].id)
      : 0;
  const start = await update(t.admin, { flag: FLAG, status: true });
  check(
    'Admin ตั้ง flag ทดสอบเป็นเปิดก่อนเริ่ม',
    start.status < 300,
    `HTTP ${start.status}`,
  );

  const noAuth = await update(undefined, { flag: FLAG, status: false });
  check('ไม่มี token → 401', noAuth.status === 401, `HTTP ${noAuth.status}`);

  const shopUpd = await update(t.shop, { flag: FLAG, status: false });
  check(
    'token ร้านค้าเปลี่ยน flag → 403',
    shopUpd.status === 403,
    `HTTP ${shopUpd.status}`,
  );
  check(
    'flag ไม่เปลี่ยนหลังร้านค้าลอง',
    (await flagValue()) === true,
    `ค่า ${JSON.stringify(await flagValue())}`,
  );

  const shopAll = await update(t.shop, { flag: 'all', status: true });
  check(
    'token ร้านค้าแตะ flag "all" → 403',
    shopAll.status === 403,
    `HTTP ${shopAll.status}`,
  );

  const shopList = await call('GET', '/ecom/feature-flags', t.shop);
  check(
    'token ร้านค้าดูรายการ flag → 403',
    shopList.status === 403,
    `HTTP ${shopList.status}`,
  );
  const shopLogs = await call('GET', '/ecom/feature-flag-logs', t.shop);
  check(
    'token ร้านค้าดูประวัติ flag → 403',
    shopLogs.status === 403,
    `HTTP ${shopLogs.status}`,
  );

  if (t.sales) {
    const s = await update(t.sales, { flag: FLAG, status: false });
    check(
      'Sales ที่มีแค่ permission (ไม่มีเมนู feature-flag) → 403',
      s.status === 403,
      `HTTP ${s.status}`,
    );
  } else skip('Sales ที่มีแค่ permission → 403', 'ไม่ได้ตั้ง SALES_TOKEN');

  if (t.reviewAdmin) {
    const r = await update(t.reviewAdmin, { flag: FLAG, status: false });
    check(
      'token ขอบเขตจำกัด (review) แม้ role Admin → 403',
      r.status === 403,
      `HTTP ${r.status}`,
    );
  } else skip('token ขอบเขตจำกัด → 403', 'deployed ไม่มี token แบบนี้');

  if (t.menu) {
    const m = await update(t.menu, { flag: FLAG, status: false });
    check(
      'บัญชีที่ได้เมนู feature-flag เปลี่ยนได้',
      m.status < 300 && (await flagValue()) === false,
      `HTTP ${m.status} ค่าใหม่ ${JSON.stringify(await flagValue())}`,
    );
  } else
    skip('บัญชีที่ได้เมนู feature-flag เปลี่ยนได้', 'ไม่ได้ตั้ง MENU_TOKEN');

  const a = await update(t.admin, { flag: FLAG, status: false });
  const a2 = await update(t.admin, { flag: FLAG, status: true });
  check(
    'Admin เปลี่ยนได้ (ปิด → เปิด)',
    a.status < 300 && a2.status < 300 && (await flagValue()) === true,
    `HTTP ${a.status}/${a2.status}`,
  );

  const bad1 = await update(t.admin, { flag: FLAG, status: 'false' });
  const bad2 = await update(t.admin, { status: true });
  const bad3 = await update(t.admin, { flag: 'x'.repeat(256), status: true });
  check(
    'body ผิดรูป (status เป็นข้อความ / ไม่มี flag / flag ยาวเกิน) → 400',
    bad1.status === 400 && bad2.status === 400 && bad3.status === 400,
    `HTTP ${bad1.status}/${bad2.status}/${bad3.status}`,
  );

  const list = await call('GET', '/ecom/feature-flags', t.admin);
  const inList =
    Array.isArray(list.body) &&
    (list.body as Array<{ feature_key?: string }>).some(
      (f) => f.feature_key === FLAG,
    );
  check(
    'Admin ดูรายการ flag ได้ และมี flag ทดสอบ',
    list.status === 200 && inList,
    `HTTP ${list.status}`,
  );

  const logs = await call(
    'GET',
    `/ecom/feature-flag-logs?flag=${encodeURIComponent(FLAG)}&limit=20`,
    t.admin,
  );
  const rows = Array.isArray(logs.body)
    ? (logs.body as Array<Record<string, unknown>>)
    : [];
  const mine = rows.filter((r) => Number(r.id) > baselineId);
  const adminMem = memOf(t.admin);
  const latest = mine[0];
  check(
    'ประวัติ: รายการล่าสุดคือ Admin เปลี่ยน false → true',
    logs.status === 200 &&
      !!latest &&
      latest.actor_mem_code === adminMem &&
      latest.old_value === false &&
      latest.new_value === true,
    `HTTP ${logs.status} ล่าสุด ${JSON.stringify(latest ?? null)}`,
  );
  const expectedRows = 3 + (t.menu ? 1 : 0); // เริ่ม (เปิด) + Admin ปิด + Admin เปิด (+ เมนูปิด)
  check(
    `ประวัติครบ ${expectedRows} รายการของรอบนี้ และไม่มีรายการจากร้านค้า/บัญชีที่ถูกปฏิเสธ`,
    mine.length === expectedRows &&
      !mine.some((r) => r.actor_mem_code === memOf(t.shop)),
    `ได้ ${mine.length} รายการ: ${mine.map((r) => `${String(r.actor_mem_code)}:${String(r.old_value)}→${String(r.new_value)}`).join(', ')}`,
  );
  if (t.menu) {
    check(
      'ประวัติบันทึกคนที่ได้เมนู feature-flag ด้วย',
      mine.some(
        (r) => r.actor_mem_code === memOf(t.menu!) && r.new_value === false,
      ),
      '',
    );
  }
  const badLimit = await call(
    'GET',
    '/ecom/feature-flag-logs?limit=0',
    t.admin,
  );
  check('limit ผิด → 400', badLimit.status === 400, `HTTP ${badLimit.status}`);

  const end = await update(t.admin, { flag: FLAG, status: false });
  check('จบ: ตั้ง flag ทดสอบเป็นปิด', end.status < 300, `HTTP ${end.status}`);

  const passed = steps.filter((s) => s.result === 'ผ่าน').length;
  const failed = steps.filter((s) => s.result === 'ไม่ผ่าน').length;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(__dirname, '..', '..', 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `feature-flag-admin-${E2E_ENV}-${stamp}.md`);
  writeFileSync(
    file,
    [
      `# E2E feature-flag-admin (ECWC-749) — ${E2E_ENV}`,
      '',
      `- environment: **${E2E_ENV}**`,
      `- commit: \`${GIT_SHA}\``,
      `- เวลา: ${startedAt.toISOString()}`,
      `- BASE_URL: ${BASE_URL}`,
      `- flag ทดสอบ: \`${FLAG}\` (จบที่ปิด)`,
      `- ผล: **${passed} ผ่าน / ${failed} ไม่ผ่าน / ${steps.length - passed - failed} ข้าม**`,
      '',
      '| # | ขั้น | ผล | ที่เห็น |',
      '|---|---|---|---|',
      ...steps.map(
        (s, i) =>
          `| ${i + 1} | ${s.name} | ${s.result} | ${s.observed.replace(/\|/g, '\\|').slice(0, 300)} |`,
      ),
      '',
    ].join('\n'),
  );
  console.log(`\n${passed} passed, ${failed} failed → ${file}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
