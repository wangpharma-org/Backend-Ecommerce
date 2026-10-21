/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
/**
 * E2E: WGDD-427 สินค้าแถม/ขายพ่วงตามประเภทยา — /ecom/drug-type
 *
 * ใช้:
 *   BASE_URL=http://localhost:3021/api ADMIN_TOKEN=<jwt admin> USER_TOKEN=<jwt ร้าน> \
 *   npx ts-node scripts/e2e/drug-type-reward.e2e.ts
 *
 * local: ไม่ส่ง token ก็ได้ (mint เอง) + seed ประเภท "E2E-DT-<เวลา>" ลง DB ตรง (.env) แล้วผูกกับสินค้าจริง 1 ตัว
 *   (เลียนแบบข้อความ Kafka drug_type_upsert_ecom) จบแล้วลบประเภท + คืน drug_type_code เดิมของสินค้า
 * deployed (E2E_ENV=dev|staging|prod): ไม่ seed — ต้องส่ง PRO_CODE ของสินค้าที่มีประเภทยา + แถม/พ่วงอยู่แล้ว
 * สคริปต์สลับ flag drug_type_reward (ปิด → เปิด) แล้วคืนค่าเดิมเมื่อจบ
 * ไม่ครอบคลุม: การรับข้อความ Kafka จริง (ProductService → Kafka API → listener) — ดู unit test drug-type.service.spec.ts
 * ผลลัพธ์เขียนลง docs/e2e/drug-type-reward-<env>-<timestamp>.md
 */
// ต้องโหลด .env ก่อน import jwtConstants — constants อ่าน ACCESS_TOKEN_SECRET ตอน import
import 'dotenv/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { sign } from 'jsonwebtoken';
import { Connection, createConnection, RowDataPacket } from 'mysql2/promise';
import { join } from 'path';
import { jwtConstants } from '../../src/auth/constants';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const FLAG = 'drug_type_reward';
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
if (!IS_LOCAL && !process.env.PRO_CODE) {
  console.error(
    'deployed ต้องตั้ง PRO_CODE (สินค้าที่มีประเภทยา + แถม/พ่วงอยู่แล้ว)',
  );
  process.exit(2);
}

const RUN_ID = Date.now();
const TYPE_CODE = `E2E-DT-${RUN_ID}`;
const mint = (mem_code: string, permission: boolean): string =>
  sign(
    { username: mem_code, name: `E2E ${E2E_ENV}`, mem_code, permission },
    jwtConstants.secret,
    { expiresIn: '1h' },
  );
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ??
  (IS_LOCAL ? mint(`E2E-DT-${RUN_ID}-ADMIN`, true) : '');
const USER_TOKEN =
  process.env.USER_TOKEN ??
  (IS_LOCAL ? mint(`E2E-DT-${RUN_ID}-USER`, false) : '');
if (!ADMIN_TOKEN || !USER_TOKEN) {
  console.error('ต้องตั้ง ADMIN_TOKEN และ USER_TOKEN');
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
const user = client(USER_TOKEN);
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

const setFlag = (status: boolean) =>
  admin.post('/ecom/feature-flag/update-flag', { flag: FLAG, status });

const connect = (): Promise<Connection> =>
  createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

interface Seed {
  proCode: string;
  freeCode: string;
  previousTypeCode: string | null;
}

// local: เลียนแบบผลของข้อความ Kafka — ประเภท 1 ตัว (แถม 1 + พ่วงมีราคา 1) ผูกกับสินค้า 1 ตัว
async function seedLocal(): Promise<Seed> {
  const conn = await connect();
  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT pro_code, drug_type_code FROM product ORDER BY pro_code LIMIT 2',
    );
    if (rows.length < 2)
      throw new Error('DB local ต้องมีสินค้าอย่างน้อย 2 ตัว');
    const [main, free] = rows;
    await conn.query(
      'INSERT INTO drug_type (code, name, description, is_active) VALUES (?, ?, NULL, 1)',
      [TYPE_CODE, `E2E ${E2E_ENV} ประเภทยา`],
    );
    await conn.query(
      `INSERT INTO drug_type_reward
        (drug_type_code, reward_type, product_code, buy_qty, buy_unit, reward_qty, reward_unit, bundle_price, sort_order)
       VALUES (?, 'FREE', ?, 10, 'กล่อง', 1, 'ขวด', NULL, 0),
              (?, 'BUNDLE', ?, 5, NULL, 1, NULL, 25.50, 1)`,
      [TYPE_CODE, free.pro_code, TYPE_CODE, free.pro_code],
    );
    await conn.query(
      'UPDATE product SET drug_type_code = ? WHERE pro_code = ?',
      [TYPE_CODE, main.pro_code],
    );
    return {
      proCode: main.pro_code as string,
      freeCode: free.pro_code as string,
      previousTypeCode: (main.drug_type_code as string | null) ?? null,
    };
  } finally {
    await conn.end();
  }
}

async function cleanupLocal(seed: Seed): Promise<void> {
  const conn = await connect();
  try {
    await conn.query(
      'UPDATE product SET drug_type_code = ? WHERE pro_code = ?',
      [seed.previousTypeCode, seed.proCode],
    );
    await conn.query('DELETE FROM drug_type WHERE code = ?', [TYPE_CODE]);
  } finally {
    await conn.end();
  }
}

async function main() {
  console.log(
    `E2E drug-type-reward env=${E2E_ENV} base=${BASE_URL} commit=${GIT_SHA}`,
  );
  const original = await admin.get(`/ecom/feature-flag/${FLAG}`);
  const originalFlag = original.data === true;
  const seed: Seed | null = IS_LOCAL ? await seedLocal() : null;
  const proCode = seed?.proCode ?? (process.env.PRO_CODE as string);

  try {
    // ---------- flag ปิด ----------
    await step('F0 ปิด flag drug_type_reward', async () => {
      const r = await setFlag(false);
      return {
        status: r.status,
        ok: r.status < 300,
        detail: `เดิม=${originalFlag}`,
      };
    });

    await step('F1 flag ปิด: GET product + POST products → 403', async () => {
      const [one, many] = await Promise.all([
        user.get(`/ecom/drug-type/product/${encodeURIComponent(proCode)}`),
        user.post('/ecom/drug-type/products', { pro_codes: [proCode] }),
      ]);
      return {
        status: one.status,
        ok: one.status === 403 && many.status === 403,
        detail: `GET=${one.status} POST=${many.status}`,
      };
    });

    // ---------- flag เปิด ----------
    await step('F2 เปิด flag drug_type_reward', async () => {
      const r = await setFlag(true);
      return { status: r.status, ok: r.status < 300 };
    });

    await step('A1 ไม่มี token → ถูกปฏิเสธ', async () => {
      const r = await anon.get(
        `/ecom/drug-type/product/${encodeURIComponent(proCode)}`,
      );
      return { status: r.status, ok: r.status === 401 || r.status === 403 };
    });

    await step('P1 หน้าสินค้า: ได้ประเภท + รายการแถม/พ่วง', async () => {
      const r = await user.get(
        `/ecom/drug-type/product/${encodeURIComponent(proCode)}`,
      );
      const dt = r.data?.drug_type;
      const rewards: any[] = dt?.rewards ?? [];
      const okLocal =
        !seed ||
        (dt?.code === TYPE_CODE &&
          rewards.length === 2 &&
          rewards[0].reward_type === 'FREE' &&
          rewards[0].buy_qty === 10 &&
          rewards[0].reward_unit === 'ขวด' &&
          rewards[0].bundle_price === null &&
          rewards[1].reward_type === 'BUNDLE' &&
          rewards[1].bundle_price === 25.5 &&
          rewards[1].product_code === seed.freeCode);
      return {
        status: r.status,
        ok: r.status === 200 && !!dt && rewards.length > 0 && okLocal,
        detail: `type=${dt?.code} rewards=${rewards.length}`,
      };
    });

    await step('P2 ตะกร้า: map เฉพาะสินค้าที่มีแถม/พ่วง', async () => {
      const r = await user.post('/ecom/drug-type/products', {
        pro_codes: [proCode, 'E2E-NOT-EXIST'],
      });
      const keys = Object.keys(r.data ?? {});
      return {
        status: r.status,
        ok: r.status < 300 && keys.length === 1 && keys[0] === proCode,
        detail: `keys=${keys.join(',')}`,
      };
    });

    await step('P3 สินค้าไม่มีประเภท → drug_type = null', async () => {
      const r = await user.get('/ecom/drug-type/product/E2E-NOT-EXIST');
      return {
        status: r.status,
        ok: r.status === 200 && r.data?.drug_type === null,
      };
    });

    await step('V1 body ผิด (ไม่ใช่ array) → 400', async () => {
      const r = await user.post('/ecom/drug-type/products', { pro_codes: 'x' });
      return { status: r.status, ok: r.status === 400 };
    });

    if (seed) {
      await step('L1 ประเภทปิดใช้งาน → ไม่แสดง', async () => {
        const conn = await connect();
        try {
          await conn.query(
            'UPDATE drug_type SET is_active = 0 WHERE code = ?',
            [TYPE_CODE],
          );
        } finally {
          await conn.end();
        }
        const r = await user.get(
          `/ecom/drug-type/product/${encodeURIComponent(proCode)}`,
        );
        return {
          status: r.status,
          ok: r.status === 200 && r.data?.drug_type === null,
        };
      });
    }
  } finally {
    // ---------- คืนค่า ----------
    await step(`Z1 คืนค่า flag ${FLAG} = ${originalFlag}`, async () => {
      const r = await setFlag(originalFlag);
      return { status: r.status, ok: r.status < 300 };
    });
    if (seed) {
      await step(
        'Z2 ลบประเภททดสอบ + คืน drug_type_code ของสินค้า',
        async () => {
          await cleanupLocal(seed);
          return {
            status: 0,
            ok: true,
            detail: `${TYPE_CODE} / ${seed.proCode}`,
          };
        },
      );
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Drug type rewards (WGDD-427) E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- สินค้าทดสอบ: ${proCode}${seed ? ` (seed ประเภท ${TYPE_CODE} ลง DB แล้วลบเมื่อจบ)` : ' (ข้อมูลจริง ไม่ seed)'}`,
    `- flag ${FLAG}: เดิม ${originalFlag} → คืนค่าแล้ว`,
    `- ไม่ครอบคลุม: การรับข้อความ Kafka จริง (ดู unit test drug-type.service.spec.ts)`,
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
  const file = join(dir, `drug-type-reward-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
