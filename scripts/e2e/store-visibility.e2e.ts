/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * E2E: ECWC-600/617 ความยินยอมแสดงชื่อร้าน (PDPA ม.19) — /ecom/store-visibility
 *
 * ใช้:
 *   BASE_URL=http://localhost:3021/api ADMIN_TOKEN=<jwt admin> \
 *   USER_TOKEN=<jwt ร้าน A> USER2_TOKEN=<jwt ร้าน B> \
 *   npx ts-node scripts/e2e/store-visibility.e2e.ts
 *
 * USER_TOKEN / USER2_TOKEN: ร้านที่ยังไม่เคยตอบ (status NOT_ASKED, asked_count 0) ทั้งคู่
 *   local: ไม่ส่งก็ได้ — สคริปต์ mint token ให้เองด้วย mem_code ใหม่ "E2E-SV-<เวลา>-A/B" ทุกครั้งที่รัน
 * E2E_ENV: ถ้า BASE_URL ไม่ใช่ localhost ต้องระบุเอง (dev / staging / prod) ไม่งั้นสคริปต์ไม่รัน
 *
 * สคริปต์สลับ flag store_name_consent (ปิด → เปิด) แล้วคืนค่าเดิมเมื่อจบ
 * local: เช็คแถวใน customer_store_visibility_log ตรงจาก DB ด้วย (.env) — log เป็นหลักฐาน เพิ่มอย่างเดียว
 *   สคริปต์จึงไม่ลบ แถวของ mem_code E2E-SV-* ค้างไว้ใน DB local
 * ไม่ครอบคลุม: ชื่อร้านใน order-status / delivery/latest-store (ต้องมี logistics-backend จริง — ดู unit test)
 * ผลลัพธ์เขียนลง docs/e2e/store-visibility-<env>-<timestamp>.md
 */
// ต้องโหลด .env ก่อน import jwtConstants — constants อ่าน ACCESS_TOKEN_SECRET ตอน import
import 'dotenv/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { sign } from 'jsonwebtoken';
import { createConnection, RowDataPacket } from 'mysql2/promise';
import { join } from 'path';
import { jwtConstants } from '../../src/auth/constants';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const FLAG = 'store_name_consent';
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

// local เท่านั้น: mint token ด้วย secret ของแอป — deployed ต้องส่ง token มาเอง
const RUN_ID = Date.now();
const mint = (mem_code: string, permission: boolean): string =>
  sign(
    { username: mem_code, name: `E2E ${E2E_ENV}`, mem_code, permission },
    jwtConstants.secret,
    { expiresIn: '1h' },
  );
const MEM_A = `E2E-SV-${RUN_ID}-A`;
const MEM_B = `E2E-SV-${RUN_ID}-B`;
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ??
  (IS_LOCAL ? mint(`E2E-SV-${RUN_ID}-ADMIN`, true) : '');
const USER_TOKEN =
  process.env.USER_TOKEN ?? (IS_LOCAL ? mint(MEM_A, false) : '');
const USER2_TOKEN =
  process.env.USER2_TOKEN ?? (IS_LOCAL ? mint(MEM_B, false) : '');

if (!ADMIN_TOKEN || !USER_TOKEN || !USER2_TOKEN) {
  console.error('ต้องตั้ง ADMIN_TOKEN, USER_TOKEN และ USER2_TOKEN');
  process.exit(2);
}

const client = (token?: string): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
    timeout: 20000,
  });
const admin = client(ADMIN_TOKEN);
const userA = client(USER_TOKEN);
const userB = client(USER2_TOKEN);
const anon = client();

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

const summary = (d: any): string =>
  d && typeof d === 'object' && 'status' in d
    ? `status=${d.status} show=${d.show_store_name} ask=${d.should_ask} asked=${d.asked_count} enabled=${d.enabled}`
    : JSON.stringify(d ?? '').slice(0, 160);

const setFlag = (status: boolean) =>
  admin.post('/ecom/feature-flag/update-flag', { flag: FLAG, status });

// local: อ่าน log ตรงจาก DB — API ไม่มีเส้นอ่าน log (หลังบ้าน export เป็นงานถัดไปใน ECWC-617)
async function readLogs(mem_code: string): Promise<RowDataPacket[] | null> {
  if (!IS_LOCAL) return null;
  const conn = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT action, consent_version, text_hash, channel FROM customer_store_visibility_log WHERE mem_code = ? ORDER BY log_id',
      [mem_code],
    );
    return rows;
  } finally {
    await conn.end();
  }
}

async function main() {
  console.log(
    `E2E store-visibility env=${E2E_ENV} base=${BASE_URL} commit=${GIT_SHA}`,
  );
  const original = await admin.get(`/ecom/feature-flag/${FLAG}`);
  const originalFlag = original.data === true;

  // ---------- flag ปิด ----------
  await step('F0 ปิด flag store_name_consent', async () => {
    const r = await setFlag(false);
    return {
      status: r.status,
      ok: r.status < 300,
      detail: `เดิม=${originalFlag}`,
    };
  });

  await step(
    'F1 flag ปิด: GET → enabled=false, ไม่ถาม, ไม่แสดงชื่อ',
    async () => {
      const r = await userA.get('/ecom/store-visibility');
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.enabled === false &&
          r.data?.should_ask === false &&
          r.data?.show_store_name === false,
        detail: summary(r.data),
      };
    },
  );

  await step('F2 flag ปิด: PUT / POST asked → 403', async () => {
    const [put, asked] = await Promise.all([
      userA.put('/ecom/store-visibility', { show_store_name: true }),
      userA.post('/ecom/store-visibility/asked', {}),
    ]);
    return {
      status: put.status,
      ok: put.status === 403 && asked.status === 403,
      detail: `PUT=${put.status} asked=${asked.status}`,
    };
  });

  // ---------- flag เปิด ----------
  await step('F3 เปิด flag store_name_consent', async () => {
    const r = await setFlag(true);
    return { status: r.status, ok: r.status < 300 };
  });

  await step('A1 ไม่มี token → ถูกปฏิเสธ', async () => {
    const r = await anon.get('/ecom/store-visibility');
    return {
      status: r.status,
      ok: r.status === 401 || r.status === 403,
    };
  });

  await step(
    'S1 ร้านใหม่: NOT_ASKED, ควรถาม, มีข้อความ consent จาก server',
    async () => {
      const r = await userA.get('/ecom/store-visibility');
      const c = r.data?.consent;
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.enabled === true &&
          r.data?.status === 'NOT_ASKED' &&
          r.data?.should_ask === true &&
          r.data?.show_store_name === false &&
          Number.isInteger(c?.version) &&
          typeof c?.title === 'string' &&
          c.title.length > 0 &&
          typeof c?.description === 'string',
        detail: `${summary(r.data)} consent.v=${c?.version}`,
      };
    },
  );

  await step('S2 ปัดทิ้ง 3 ครั้ง → asked_count=3 แล้วหยุดถาม', async () => {
    const counts: number[] = [];
    let last: any;
    for (let i = 0; i < 3; i++) {
      last = await userA.post('/ecom/store-visibility/asked', {});
      counts.push(last.data?.asked_count);
    }
    return {
      status: last.status,
      ok:
        last.status === 201 &&
        counts.join(',') === '1,2,3' &&
        last.data?.should_ask === false &&
        last.data?.status === 'NOT_ASKED',
      detail: `counts=${counts.join(',')} ${summary(last.data)}`,
    };
  });

  await step('S3 ปัดครั้งที่ 4 → ไม่นับเพิ่ม (เพดาน 3)', async () => {
    const r = await userA.post('/ecom/store-visibility/asked', {});
    return {
      status: r.status,
      ok: r.status === 201 && r.data?.asked_count === 3,
      detail: summary(r.data),
    };
  });

  await step(
    'S4 ครบเพดานแล้วยังเปิดเองจากหน้าตั้งค่าได้ → GRANTED',
    async () => {
      const r = await userA.put('/ecom/store-visibility', {
        show_store_name: true,
      });
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.status === 'GRANTED' &&
          r.data?.show_store_name === true &&
          r.data?.should_ask === false,
        detail: summary(r.data),
      };
    },
  );

  await step('S5 กดเปิดซ้ำ → ค่าเดิม (ไม่เขียน log ซ้ำ)', async () => {
    const r = await userA.put('/ecom/store-visibility', {
      show_store_name: true,
    });
    return {
      status: r.status,
      ok: r.status === 200 && r.data?.status === 'GRANTED',
      detail: summary(r.data),
    };
  });

  await step(
    'S6 เปิดแล้วปิด (ถอน) จากแอป → DECLINED, ไม่แสดงชื่อ, ไม่ถามอีก',
    async () => {
      const r = await userA.put('/ecom/store-visibility', {
        show_store_name: false,
        channel: 'APP',
      });
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data?.status === 'DECLINED' &&
          r.data?.show_store_name === false &&
          r.data?.should_ask === false,
        detail: summary(r.data),
      };
    },
  );

  await step(
    'S7 ร้าน B กด "ไม่เปิด" ตั้งแต่แรก → DECLINED และปัดทิ้งไม่นับ',
    async () => {
      const put = await userB.put('/ecom/store-visibility', {
        show_store_name: false,
      });
      const asked = await userB.post('/ecom/store-visibility/asked', {});
      return {
        status: put.status,
        ok:
          put.status === 200 &&
          put.data?.status === 'DECLINED' &&
          put.data?.should_ask === false &&
          asked.data?.asked_count === 0,
        detail: `${summary(put.data)} · asked→${asked.data?.asked_count}`,
      };
    },
  );

  // ---------- validation ----------
  await step('V1 show_store_name ไม่ใช่ boolean / ไม่ส่ง → 400', async () => {
    const [str, empty, num] = await Promise.all([
      userB.put('/ecom/store-visibility', { show_store_name: 'true' }),
      userB.put('/ecom/store-visibility', {}),
      userB.put('/ecom/store-visibility', { show_store_name: 1 }),
    ]);
    return {
      status: str.status,
      ok: str.status === 400 && empty.status === 400 && num.status === 400,
      detail: `"true"=${str.status} {}=${empty.status} 1=${num.status}`,
    };
  });

  await step('V2 channel นอก WEB/APP → 400', async () => {
    const [put, asked] = await Promise.all([
      userB.put('/ecom/store-visibility', {
        show_store_name: true,
        channel: 'SALE',
      }),
      userB.post('/ecom/store-visibility/asked', { channel: 'toString' }),
    ]);
    return {
      status: put.status,
      ok: put.status === 400 && asked.status === 400,
      detail: `PUT=${put.status} asked=${asked.status}`,
    };
  });

  await step(
    'A2 ส่ง mem_code ของร้านอื่นใน body → ถูกตัดทิ้ง แก้ได้แค่ร้านตัวเอง',
    async () => {
      const put = await userB.put('/ecom/store-visibility', {
        show_store_name: true,
        mem_code: MEM_A,
      });
      const a = await userA.get('/ecom/store-visibility');
      // คืนร้าน B เป็น DECLINED เหมือนเดิม
      await userB.put('/ecom/store-visibility', { show_store_name: false });
      return {
        status: put.status,
        ok:
          put.status === 200 &&
          put.data?.status === 'GRANTED' &&
          a.data?.status === 'DECLINED',
        detail: `B=${put.data?.status} A ยังเป็น ${a.data?.status}`,
      };
    },
  );

  // ---------- หลักฐาน (local) ----------
  if (IS_LOCAL && !process.env.USER_TOKEN) {
    await step(
      'L1 log ร้าน A ครบทุกการกด เพิ่มอย่างเดียว (ASKED×3, GRANTED, WITHDRAWN)',
      async () => {
        const rows = (await readLogs(MEM_A)) ?? [];
        const actions = rows.map((r) => r.action).join(',');
        return {
          status: 0,
          ok:
            actions === 'ASKED,ASKED,ASKED,GRANTED,WITHDRAWN' &&
            rows.every((r) => /^[0-9a-f]{64}$/.test(r.text_hash)) &&
            rows[rows.length - 1]?.channel === 'APP',
          detail: `actions=${actions} channel(last)=${rows[rows.length - 1]?.channel}`,
        };
      },
    );
    await step('L2 log ร้าน B: DECLINED → GRANTED → WITHDRAWN', async () => {
      const rows = (await readLogs(MEM_B)) ?? [];
      const actions = rows.map((r) => r.action).join(',');
      return {
        status: 0,
        ok: actions === 'DECLINED,GRANTED,WITHDRAWN',
        detail: `actions=${actions}`,
      };
    });
  }

  // ---------- คืนค่า ----------
  await step(`Z คืนค่า flag ${FLAG} = ${originalFlag}`, async () => {
    const r = await setFlag(originalFlag);
    return { status: r.status, ok: r.status < 300 };
  });

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Store visibility consent (ECWC-600/617) E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- mem_code ทดสอบ: ${process.env.USER_TOKEN ? '(จาก token ที่ส่งมา)' : `${MEM_A}, ${MEM_B} (log ค้างใน DB ตามหลัก append-only)`}`,
    `- flag ${FLAG}: เดิม ${originalFlag} → คืนค่าแล้ว`,
    `- ไม่ครอบคลุม: ชื่อร้าน/พิกัดใน order-status และ delivery/latest-store (ต้องมี logistics-backend จริง)`,
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
  const file = join(dir, `store-visibility-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
