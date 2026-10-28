/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * E2E: ECWC-751 ค้นหาสินค้ารวมทุกแหล่ง (ES + เว็บเก่า + DB) ไม่ซ้ำ — flag search_all_sources
 *
 * ใช้:
 *   BASE_URL=http://localhost:3024/api npx ts-node scripts/e2e/search-all-sources.e2e.ts
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod ADMIN_TOKEN=<jwt admin> USER_TOKEN=<jwt ร้าน> \
 *     npx ts-node scripts/e2e/search-all-sources.e2e.ts
 *
 * local: mint token เองด้วย secret ของแอป
 * ตัวเลือก:
 *   KEYWORD=<คำค้นที่เจอหลายตัว> (ค่าเริ่มต้น "พารา") · CATEGORY=<เลขหมวด> (ค่าเริ่มต้น 1)
 *   MISSING_PRO_CODE=<รหัสที่มีใน DB แต่ ES ไม่มี> — local หาให้เองจาก DB + ES (อ่านอย่างเดียว)
 *
 * อ่านอย่างเดียว ยกเว้น: สลับ flag search_all_sources แล้วคืนค่าเดิม และ search tracking ตามปกติของ endpoint
 * ผลเขียนลง docs/e2e/search-all-sources-<env>-<timestamp>.md
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

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3021/api').replace(
  /\/+$/,
  '',
);
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const FLAG = 'search_all_sources';
const KEYWORD = process.env.KEYWORD ?? 'พารา';
const CATEGORY = Number(process.env.CATEGORY ?? 1);
const PAGE_SIZE = 10;
const MAX_PAGES = 10;
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
if (!Number.isInteger(CATEGORY) || CATEGORY < 1) {
  console.error('CATEGORY ต้องเป็นเลขจำนวนเต็มบวก');
  process.exit(2);
}

const RUN_ID = Date.now();
const MEM_CODE = `E2E-SRCH-${RUN_ID}`;
const mint = (mem_code: string, permission: boolean): string =>
  sign(
    { username: mem_code, name: `E2E ${E2E_ENV}`, mem_code, permission },
    jwtConstants.secret,
    { expiresIn: '1h' },
  );
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ?? (IS_LOCAL ? mint(`${MEM_CODE}-ADMIN`, true) : '');
const USER_TOKEN =
  process.env.USER_TOKEN ?? (IS_LOCAL ? mint(MEM_CODE, false) : '');

if (!ADMIN_TOKEN || !USER_TOKEN) {
  console.error('ต้องตั้ง ADMIN_TOKEN และ USER_TOKEN');
  process.exit(2);
}

const client = (token?: string): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
    timeout: 60000,
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
const notes: string[] = [];

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

interface SearchPage {
  status: number;
  codes: string[];
  totalCount: number;
  ms: number;
}

async function searchPage(
  keyword: string,
  offset: number,
  limit: number,
): Promise<SearchPage> {
  const started = Date.now();
  const r = await user.post('/ecom/search-products', {
    keyword,
    offset,
    limit,
    mem_code: MEM_CODE,
  });
  return {
    status: r.status,
    codes: (r.data?.products ?? []).map((p: any) => p.pro_code),
    totalCount: Number(r.data?.totalCount ?? 0),
    ms: Date.now() - started,
  };
}

// เดินทุกหน้า (สูงสุด MAX_PAGES) เก็บรหัสทั้งหมด + รหัสที่ซ้ำข้ามหน้า
async function searchAllPages(keyword: string) {
  const all: string[] = [];
  let totalCount = 0;
  let status = 0;
  let slowest = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await searchPage(keyword, page * PAGE_SIZE, PAGE_SIZE);
    status = r.status;
    slowest = Math.max(slowest, r.ms);
    if (r.status >= 300) break;
    totalCount = r.totalCount;
    all.push(...r.codes);
    if (r.codes.length < PAGE_SIZE || all.length >= totalCount) break;
  }
  const seen = new Set<string>();
  const duplicates = all.filter((code) => {
    if (seen.has(code)) return true;
    seen.add(code);
    return false;
  });
  return { status, all, totalCount, duplicates, slowest };
}

// local: หารหัสที่อยู่ใน DB (ผ่านตัวกรองค้นหา + มีหน่วย) แต่ ES ไม่มี — อ่านอย่างเดียวทั้ง DB และ ES
async function findDbOnlyProduct(): Promise<{
  pro_code: string;
  pro_name: string;
} | null> {
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
      `SELECT p.pro_code, p.pro_name FROM product p
       WHERE p.pro_priceA > 1 AND p.pro_priceB > 1 AND p.pro_priceC > 1
         AND p.pro_priceA < 10000000 AND p.invisible_id IS NULL
         AND (p.pro_hidden = 0 OR p.pro_hidden IS NULL)
         AND (p.pro_l16_only = 0 OR p.pro_l16_only IS NULL)
         AND p.pro_code NOT LIKE '@%' AND p.pro_name NOT LIKE '%ฟรี%'
         AND p.pro_name NOT LIKE 'FREE/%' AND p.pro_name NOT LIKE 'ค่า%'
         AND EXISTS (SELECT 1 FROM product_unit u WHERE u.pro_code = p.pro_code)
       ORDER BY p.pro_code LIMIT 2000`,
    );
    if (!rows.length) return null;
    const es = axios.create({
      baseURL: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'password',
      },
      timeout: 30000,
    });
    const mget = await es.post('/products/_mget', {
      ids: rows.map((row) => row.pro_code),
      _source: false,
    });
    const inEs = new Set(
      (mget.data?.docs ?? [])
        .filter((doc: any) => doc.found)
        .map((doc: any) => doc._id),
    );
    const missing = rows.filter((row) => !inEs.has(row.pro_code));
    notes.push(
      `DB ตัวอย่าง ${rows.length} รหัส · ไม่มีใน ES ${missing.length} รหัส`,
    );
    return (missing[0] as { pro_code: string; pro_name: string }) ?? null;
  } finally {
    await conn.end();
  }
}

async function main() {
  const original = await admin.get(`/ecom/feature-flag/${FLAG}`);
  const originalFlag = original.data === true;

  let dbOnly: { pro_code: string; pro_name?: string } | null = process.env
    .MISSING_PRO_CODE
    ? { pro_code: process.env.MISSING_PRO_CODE }
    : null;
  if (!dbOnly) {
    try {
      dbOnly = await findDbOnlyProduct();
    } catch (e) {
      notes.push(`หาสินค้าที่ ES ไม่มีไม่ได้: ${(e as Error).message}`);
    }
  }

  try {
    // ---------- กติกาพื้นฐาน ----------
    await step('A1 ไม่มี token → 401', async () => {
      const r = await anon.post('/ecom/search-products', {
        keyword: KEYWORD,
        offset: 0,
        limit: 5,
      });
      return { status: r.status, ok: r.status === 401 };
    });

    // ---------- flag ปิด = แบบเดิม ----------
    await step('B1 ปิด flag', async () => {
      const r = await setFlag(false);
      return {
        status: r.status,
        ok: r.status < 300,
        detail: `เดิม=${originalFlag}`,
      };
    });
    const off = await searchAllPages(KEYWORD);
    await step(`B2 flag ปิด ค้น "${KEYWORD}" ยังทำงาน`, async () => ({
      status: off.status,
      ok: off.status < 300 && off.all.length > 0,
      detail: `total=${off.totalCount} ได้ ${off.all.length} รหัส ช้าสุด ${off.slowest}ms`,
    }));

    let offDbOnly: SearchPage | null = null;
    if (dbOnly) {
      offDbOnly = await searchPage(dbOnly.pro_code, 0, 20);
    }

    // ---------- flag เปิด = รวมทุกแหล่ง ----------
    await step('C1 เปิด flag', async () => {
      const r = await setFlag(true);
      return { status: r.status, ok: r.status < 300 };
    });
    const on = await searchAllPages(KEYWORD);
    await step(
      `C2 flag เปิด ค้น "${KEYWORD}" ทุกหน้าไม่มีรหัสซ้ำ`,
      async () => ({
        status: on.status,
        ok: on.status < 300 && on.all.length > 0 && on.duplicates.length === 0,
        detail: `total=${on.totalCount} ได้ ${on.all.length} รหัส ซ้ำ=${on.duplicates.join(',') || '-'} ช้าสุด ${on.slowest}ms`,
      }),
    );

    await step(
      'C3 ผลแบบเดิมอยู่ในผลรวมครบ และ total ไม่น้อยกว่าเดิม',
      async () => {
        const onSet = new Set(on.all);
        // เทียบเฉพาะช่วงที่เดินครบทั้งสองฝั่ง — ถ้าถูกตัดที่ MAX_PAGES ให้ดู total
        const comparable =
          off.all.length >= off.totalCount && on.all.length >= on.totalCount;
        const lost = comparable
          ? off.all.filter((code) => !onSet.has(code))
          : [];
        return {
          status: on.status,
          ok: on.totalCount >= off.totalCount && lost.length === 0,
          detail: `total เดิม=${off.totalCount} รวม=${on.totalCount}${comparable ? ` หาย=${lost.join(',') || '-'}` : ' (เกิน MAX_PAGES เทียบแค่ total)'} · เพิ่มขึ้น ${on.all.filter((code) => !off.all.includes(code)).length} รหัส`,
        };
      },
    );

    if (on.all[0]) {
      const exact = on.all[0];
      await step(
        `C4 ค้นด้วยรหัสตรง "${exact}" ได้ตัวนั้นเป็นอันดับแรก`,
        async () => {
          const r = await searchPage(exact, 0, 10);
          return {
            status: r.status,
            ok: r.status < 300 && r.codes[0] === exact,
            detail: `อันดับแรก=${r.codes[0] ?? '-'}`,
          };
        },
      );
    }

    if (dbOnly) {
      const target = dbOnly;
      await step(
        `C5 สินค้าที่มีใน DB แต่ ES ไม่มี (${target.pro_code}) ค้นด้วยรหัสเจอและอยู่อันดับแรก`,
        async () => {
          const r = await searchPage(target.pro_code, 0, 20);
          return {
            status: r.status,
            ok: r.status < 300 && r.codes[0] === target.pro_code,
            detail: `flag ปิดเจอ=${offDbOnly?.codes.includes(target.pro_code) ?? '-'} (total ${offDbOnly?.totalCount ?? '-'}) · flag เปิดอันดับแรก=${r.codes[0] ?? '-'} total=${r.totalCount}`,
          };
        },
      );
    } else {
      notes.push(
        'ไม่มีสินค้าที่ ES ไม่มีให้ทดสอบ C5 (deployed: ส่ง MISSING_PRO_CODE)',
      );
    }

    await step(
      `C6 หมวด ${CATEGORY} + คำค้น ไม่ซ้ำ และไม่น้อยกว่าแบบเดิม`,
      async () => {
        const body = {
          keyword: KEYWORD,
          category: CATEGORY,
          offset: 0,
          limit: 100,
          mem_code: MEM_CODE,
        };
        const rOn = await user.post('/ecom/category-products', body);
        await setFlag(false);
        const rOff = await user.post('/ecom/category-products', body);
        await setFlag(true);
        const codes: string[] = (rOn.data?.products ?? []).map(
          (p: any) => p.pro_code,
        );
        const totalOn = Number(rOn.data?.totalCount ?? 0);
        const totalOff = Number(rOff.data?.totalCount ?? 0);
        return {
          status: rOn.status,
          ok:
            rOn.status < 300 &&
            rOff.status < 300 &&
            new Set(codes).size === codes.length &&
            totalOn >= totalOff,
          detail: `total เดิม=${totalOff} รวม=${totalOn}`,
        };
      },
    );

    await step('C7 autocomplete ไม่ซ้ำ ไม่เกิน 20', async () => {
      const r = await user.get('/ecom/product-search-autocomplete', {
        params: { search: KEYWORD },
      });
      const codes: string[] = Array.isArray(r.data)
        ? r.data.map((p: any) => p.pro_code)
        : [];
      return {
        status: r.status,
        ok:
          r.status < 300 &&
          codes.length > 0 &&
          codes.length <= 20 &&
          new Set(codes).size === codes.length,
        detail: `${codes.length} รายการ`,
      };
    });

    await step('C8 คำค้นว่างได้ผลว่าง', async () => {
      const r = await searchPage('   ', 0, 10);
      return {
        status: r.status,
        ok: r.status < 300 && r.codes.length === 0 && r.totalCount === 0,
      };
    });
  } finally {
    await step(`Z คืนค่า flag ${FLAG} = ${originalFlag}`, async () => {
      const r = await setFlag(originalFlag);
      return { status: r.status, ok: r.status < 300 };
    });
  }

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Search all sources (ECWC-751) E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- คำค้น: "${KEYWORD}" · หมวด ${CATEGORY} · สินค้าที่ ES ไม่มี: ${dbOnly ? `${dbOnly.pro_code} ${dbOnly.pro_name ?? ''}` : '-'}`,
    `- flag ${FLAG}: เดิม ${originalFlag} → คืนค่าแล้ว`,
    ...notes.map((note) => `- หมายเหตุ: ${note}`),
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
  const file = join(dir, `search-all-sources-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
