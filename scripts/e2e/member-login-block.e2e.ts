/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * E2E: SSN0-273 sale ระงับการเข้าใช้งาน E-commerce รายร้าน — /ecom/internal/members/:mem_code/login-block
 *
 * ใช้ (local เท่านั้น — สคริปต์ seed ร้านทดสอบลงตาราง users เอง):
 *   BASE_URL=http://localhost:3023/api npx ts-node scripts/e2e/member-login-block.e2e.ts
 *
 * ต้องมีใน .env: INTERNAL_API_TOKEN, ACCESS_TOKEN_SECRET, DB_* (DB local)
 * สคริปต์สร้างร้าน "E2E-LB-<เวลา>" (รหัสผ่านสุ่ม) แล้วเดิน: login → block → token เดิมใช้ไม่ได้ →
 * refresh ไม่ได้ → login ใหม่ไม่ได้ → unblock → login ได้ · สลับ flag member_login_block แล้วคืนค่าเดิม
 * เก็บกวาด: ลบร้านทดสอบ + refresh token + session + สถานะ + log ของ mem_code นั้นเมื่อจบ
 * ไม่ครอบคลุม: LINE login / LINE link login (ต้องมี notification-service จริง — ใช้ helper เดียวกับ password login)
 * ผลลัพธ์เขียนลง docs/e2e/member-login-block-local-<timestamp>.md
 */
// ต้องโหลด .env ก่อน import jwtConstants — constants อ่าน ACCESS_TOKEN_SECRET ตอน import
import 'dotenv/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import * as bcrypt from 'bcrypt';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { sign } from 'jsonwebtoken';
import { Connection, createConnection, RowDataPacket } from 'mysql2/promise';
import { join } from 'path';
import { jwtConstants } from '../../src/auth/constants';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const FLAG = 'member_login_block';
const INTERNAL = process.env.INTERNAL_API_TOKEN ?? '';
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

if (!IS_LOCAL || process.env.DB_HOST !== 'localhost') {
  console.error(
    'สคริปต์นี้ seed ลง DB — รันได้เฉพาะ BASE_URL + DB_HOST localhost',
  );
  process.exit(2);
}
if (!INTERNAL) {
  console.error('ต้องตั้ง INTERNAL_API_TOKEN ใน .env');
  process.exit(2);
}

const RUN_ID = Date.now();
const MEM = `E2E-LB-${RUN_ID}`;
const PASSWORD = randomBytes(9).toString('base64url');
const REASON = '[TEST] ค้างชำระเกินกำหนด';
const ACTOR = { actor_emp_code: 'E2E001', actor_name: 'E2E local sale' };
const ADMIN_TOKEN = sign(
  {
    username: `${MEM}-ADMIN`,
    name: 'E2E local',
    mem_code: `${MEM}-ADMIN`,
    permission: true,
  },
  jwtConstants.secret,
  { expiresIn: '1h' },
);

const client = (headers: Record<string, string> = {}): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    headers,
    validateStatus: () => true,
    timeout: 20000,
  });
const bearer = (token: string) => client({ Authorization: `Bearer ${token}` });
const internal = client({ 'x-internal-token': INTERNAL });
const admin = bearer(ADMIN_TOKEN);
const anon = client();
const blockPath = (mem = MEM) =>
  `/ecom/internal/members/${encodeURIComponent(mem)}/login-block`;

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

const short = (d: unknown): string => JSON.stringify(d ?? '').slice(0, 180);
const isBlocked = (d: any) => d?.code === 'LOGIN_BLOCKED';

async function count(db: Connection, sql: string): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(sql, [MEM]);
  return Number(rows[0]?.n ?? -1);
}

async function main() {
  const db = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [flagRows] = await db.query<RowDataPacket[]>(
    'SELECT is_enabled FROM feature_flag WHERE feature_key = ?',
    [FLAG],
  );
  const originalFlag = Boolean(flagRows[0]?.is_enabled);
  await db.query(
    'INSERT INTO users (mem_code, mem_username, mem_password, mem_nameSite) VALUES (?, ?, ?, ?)',
    [MEM, MEM, await bcrypt.hash(PASSWORD, 10), '[TEST] E2E login block'],
  );
  const setFlag = (status: boolean) =>
    admin.post('/ecom/feature-flag/update-flag', { flag: FLAG, status });
  const login = (password = PASSWORD) =>
    anon.post('/ecom/login', { username: MEM, password });

  let token = '';
  let refresh = '';
  try {
    // ---------- flag ปิด ----------
    await step('F1 flag ปิด: GET สถานะ enabled=false', async () => {
      await setFlag(false);
      const r = await internal.get(blockPath());
      return {
        status: r.status,
        ok: r.status === 200 && r.data.enabled === false,
        detail: `enabled=${r.data.enabled}`,
      };
    });
    await step('F2 flag ปิด: block → 403 FEATURE_DISABLED', async () => {
      const r = await internal.post(blockPath(), { reason: REASON, ...ACTOR });
      return {
        status: r.status,
        ok: r.status === 403 && r.data.code === 'FEATURE_DISABLED',
        detail: short(r.data),
      };
    });
    await step('F3 เปิด flag', async () => {
      const r = await setFlag(true);
      return { status: r.status, ok: r.status < 300 };
    });

    // ---------- internal guard ----------
    await step('G1 ไม่มี x-internal-token → 403', async () => {
      const r = await anon.post(blockPath(), { reason: REASON, ...ACTOR });
      return { status: r.status, ok: r.status === 403 };
    });
    await step('G2 x-internal-token ผิด → 403', async () => {
      const r = await client({ 'x-internal-token': 'wrong' }).get(blockPath());
      return { status: r.status, ok: r.status === 403 };
    });
    await step(
      'G3 token ลูกค้า (Bearer) เรียก internal route ไม่ได้ → 403',
      async () => {
        const r = await admin.post(blockPath(), { reason: REASON, ...ACTOR });
        return { status: r.status, ok: r.status === 403 };
      },
    );

    // ---------- ก่อนระงับ ----------
    await step('A1 login ด้วยรหัสผ่าน → 200', async () => {
      const r = await login();
      token = r.data?.token ?? '';
      refresh = r.data?.refresh_token ?? '';
      return { status: r.status, ok: r.status < 300 && !!token && !!refresh };
    });
    await step('A2 สร้าง session', async () => {
      const r = await bearer(token).post('/ecom/session/create', {
        session_token: token,
        ip_address: '127.0.0.1',
        user_agent: 'e2e',
        device_type: 'Desktop | e2e',
      });
      return { status: r.status, ok: r.status < 300 };
    });
    await step(
      'A3 token ใช้ API ที่ต้อง login ได้ (GET store-visibility)',
      async () => {
        const r = await bearer(token).get('/ecom/store-visibility');
        return { status: r.status, ok: r.status === 200 };
      },
    );

    // ---------- validation ----------
    await step('V1 block ไม่มีเหตุผล → 400', async () => {
      const r = await internal.post(blockPath(), { reason: '   ', ...ACTOR });
      return {
        status: r.status,
        ok: r.status === 400,
        detail: short(r.data.message),
      };
    });
    await step('V2 block ไม่มีผู้ทำรายการ → 400', async () => {
      const r = await internal.post(blockPath(), { reason: REASON });
      return { status: r.status, ok: r.status === 400 };
    });
    await step('V3 เหตุผลยาวเกิน 500 → 400', async () => {
      const r = await internal.post(blockPath(), {
        reason: 'x'.repeat(501),
        ...ACTOR,
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step('V4 ร้านที่ไม่มีบัญชี → 404', async () => {
      const r = await internal.post(blockPath(`${MEM}-X`), {
        reason: REASON,
        ...ACTOR,
      });
      return {
        status: r.status,
        ok: r.status === 404,
        detail: short(r.data.message),
      };
    });
    await step('V5 GET ร้านที่ไม่มีบัญชี → has_account=false', async () => {
      const r = await internal.get(blockPath(`${MEM}-X`));
      return {
        status: r.status,
        ok: r.status === 200 && r.data.has_account === false,
      };
    });
    await step('V6 รหัสร้านยาวเกิน 30 → 400', async () => {
      const r = await internal.get(blockPath('X'.repeat(31)));
      return { status: r.status, ok: r.status === 400 };
    });

    // ---------- ระงับ ----------
    await step(
      'B1 block → 200 changed=true พร้อมผู้ทำรายการ + log',
      async () => {
        const r = await internal.post(blockPath(), {
          reason: `  ${REASON}\n `,
          ...ACTOR,
        });
        const d = r.data;
        return {
          status: r.status,
          ok:
            r.status === 200 &&
            d.changed === true &&
            d.is_blocked === true &&
            d.reason === REASON &&
            d.blocked_by_emp_code === ACTOR.actor_emp_code &&
            d.logs?.[0]?.action === 'BLOCK',
          detail: `reason=${d.reason} by=${d.blocked_by_emp_code}`,
        };
      },
    );
    await step('B2 token เดิมถูกเตะทันที → 403 LOGIN_BLOCKED', async () => {
      const r = await bearer(token).get('/ecom/store-visibility');
      return {
        status: r.status,
        ok: r.status === 403 && isBlocked(r.data),
        detail: short(r.data.message),
      };
    });
    await step('B3 refresh token เดิม → 403 LOGIN_BLOCKED', async () => {
      const r = await anon.post('/ecom/refresh_token', { token: refresh });
      return { status: r.status, ok: r.status === 403 && isBlocked(r.data) };
    });
    await step(
      'B4 DB: refresh token ของร้านถูกลบ + session ถูกปิดหมด',
      async () => {
        const tokens = await count(
          db,
          'SELECT COUNT(*) n FROM `reflesh-token` WHERE mem_code = ?',
        );
        const active = await count(
          db,
          'SELECT COUNT(*) n FROM `user-sessions` WHERE mem_code = ? AND is_active = 1',
        );
        return {
          status: 0,
          ok: tokens === 0 && active === 0,
          detail: `refresh=${tokens} activeSessions=${active}`,
        };
      },
    );
    await step(
      'B5 login ใหม่ (รหัสถูก) → 403 LOGIN_BLOCKED พร้อมเหตุผล',
      async () => {
        const r = await login();
        return {
          status: r.status,
          ok:
            r.status === 403 &&
            isBlocked(r.data) &&
            String(r.data.message).includes(REASON),
          detail: short(r.data.message),
        };
      },
    );
    await step('B6 login รหัสผิด → 401 (ไม่บอกสถานะระงับ)', async () => {
      const r = await login('wrong-password');
      return { status: r.status, ok: r.status === 401 && !isBlocked(r.data) };
    });
    await step('B7 block ซ้ำ → changed=false ไม่มี log เพิ่ม', async () => {
      const r = await internal.post(blockPath(), { reason: REASON, ...ACTOR });
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data.changed === false &&
          r.data.logs?.length === 1,
        detail: `logs=${r.data.logs?.length}`,
      };
    });

    // ---------- ยกเลิกระงับ ----------
    await step('U1 unblock → 200 changed=true ล้างเหตุผล', async () => {
      const r = await internal.post(`${blockPath()}/unblock`, {
        reason: '[TEST] ชำระแล้ว',
        ...ACTOR,
      });
      const d = r.data;
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          d.changed === true &&
          d.is_blocked === false &&
          d.reason === null,
        detail: `logs=${d.logs?.map((l: any) => l.action).join(',')}`,
      };
    });
    await step('U2 login ได้ตามปกติ', async () => {
      const r = await login();
      token = r.data?.token ?? '';
      return { status: r.status, ok: r.status < 300 && !!token };
    });
    await step('U3 token ใหม่ใช้ API ได้', async () => {
      const r = await bearer(token).get('/ecom/store-visibility');
      return { status: r.status, ok: r.status === 200 };
    });
    await step(
      'U4 ประวัติ: UNBLOCK, BLOCK (ใหม่สุดก่อน) พร้อมผู้ทำรายการ',
      async () => {
        const r = await internal.get(blockPath());
        const logs = r.data.logs ?? [];
        return {
          status: r.status,
          ok:
            logs.map((l: any) => l.action).join(',') === 'UNBLOCK,BLOCK' &&
            logs.every((l: any) => l.actor_emp_code === ACTOR.actor_emp_code),
          detail: logs.map((l: any) => `${l.action}:${l.reason}`).join(' | '),
        };
      },
    );
  } finally {
    // ---------- คืนค่า + เก็บกวาด ----------
    await step(`Z1 คืนค่า flag ${FLAG} = ${originalFlag}`, async () => {
      const r = await setFlag(originalFlag);
      return { status: r.status, ok: r.status < 300 };
    });
    await step(`Z2 ลบข้อมูลทดสอบของ ${MEM}`, async () => {
      for (const table of [
        'member_login_block_log',
        'member_login_block',
        'reflesh-token',
        'user-sessions',
        'users',
      ]) {
        await db.query(`DELETE FROM \`${table}\` WHERE mem_code = ?`, [MEM]);
      }
      const left = await count(
        db,
        'SELECT COUNT(*) n FROM users WHERE mem_code = ?',
      );
      return { status: 0, ok: left === 0 };
    });
    await db.end();
  }

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Member login block (SSN0-273) E2E report`,
    ``,
    `- environment: **local** (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- mem_code ทดสอบ: ${MEM} (ลบแล้วเมื่อจบ)`,
    `- ไม่ครอบคลุม: LINE login / LINE link login (ต้องมี notification-service จริง)`,
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
  const file = join(dir, `member-login-block-local-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
