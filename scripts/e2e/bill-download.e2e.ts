/**
 * E2E: ECWC-767 ดาวน์โหลดบิล PDF (บิล ecommerce + legacy) ในหน้าสถานะคำสั่งจอง + ย้อนหลัง 6 เดือน
 *
 * ใช้:
 *   BASE_URL=http://localhost:3021/api MEM_CODE=<ร้านที่มีบิลออกแล้ว> SH_RUNNING=<เลขใบสั่งจองที่ออกบิลแล้ว> \
 *   USER_TOKEN=<jwt ร้าน MEM_CODE> OTHER_TOKEN=<jwt ร้านอื่น> \
 *   npx ts-node scripts/e2e/bill-download.e2e.ts
 *
 * local: ไม่ส่ง token ก็ได้ — สคริปต์ mint ให้เองด้วย secret ของแอป
 *   ต้องรัน bill-management-service + หน้า bill-render และตั้ง BILL_API_URL / BILL_API_KEY ให้ backend แล้ว
 * E2E_ENV: ถ้า BASE_URL ไม่ใช่ localhost ต้องระบุเอง (dev / staging / prod) ไม่งั้นสคริปต์ไม่รัน
 * อ่านอย่างเดียว ไม่สร้าง/แก้ข้อมูล
 * ผลลัพธ์เขียนลง docs/e2e/bill-download-<env>-<timestamp>.md
 */
// ต้องโหลด .env ก่อน import jwtConstants — constants อ่าน ACCESS_TOKEN_SECRET ตอน import
import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { sign } from 'jsonwebtoken';
import { join } from 'path';
import { jwtConstants } from '../../src/auth/constants';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3021/api';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const MEM_CODE = process.env.MEM_CODE ?? '';
const SH_RUNNING = process.env.SH_RUNNING ?? '';
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
if (!MEM_CODE || !SH_RUNNING) {
  console.error('ต้องระบุ MEM_CODE และ SH_RUNNING ของบิลที่ออกแล้ว');
  process.exit(2);
}

// local เท่านั้น: mint token ด้วย secret ของแอป — deployed ต้องส่ง token มาเอง
const mint = (mem_code: string): string =>
  sign(
    { username: mem_code, name: `E2E ${E2E_ENV}`, mem_code },
    jwtConstants.secret,
    { expiresIn: '1h' },
  );
const USER_TOKEN = process.env.USER_TOKEN ?? (IS_LOCAL ? mint(MEM_CODE) : '');
const OTHER_TOKEN =
  process.env.OTHER_TOKEN ?? (IS_LOCAL ? mint(`E2E-BILL-${Date.now()}`) : '');
if (!USER_TOKEN || !OTHER_TOKEN) {
  console.error('deployed ต้องส่ง USER_TOKEN และ OTHER_TOKEN');
  process.exit(2);
}

const client = (token?: string): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    timeout: 90000,
    validateStatus: () => true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

interface StepResult {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
}
const results: StepResult[] = [];

async function step(
  name: string,
  fn: () => Promise<{ ok: boolean; status: number; detail?: string }>,
): Promise<void> {
  try {
    const r = await fn();
    results.push({ step: name, ok: r.ok, status: r.status, detail: r.detail });
    console.log(
      `${r.ok ? 'PASS' : 'FAIL'}  ${name}  [${r.status}] ${r.detail ?? ''}`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ step: name, ok: false, detail: message });
    console.log(`FAIL  ${name}  ${message}`);
  }
}

interface BillRow {
  soh_running: string;
  bill_invoice_no?: string | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const pdfPath = (mem: string, running: string) =>
  `/ecom/v2/order-bill-pdf/${encodeURIComponent(mem)}/${encodeURIComponent(running)}`;

async function main() {
  const user = client(USER_TOKEN);
  let invoiceNo: string | null = null;

  await step(
    'T1 ตาราง 6 เดือน: ไม่ถูกตัดช่วง + บิลที่ออกแล้วมีเลขบิล',
    async () => {
      const to = new Date();
      const from = new Date(to);
      from.setMonth(from.getMonth() - 6);
      const r = await user.get<{
        date_from: string;
        orders: BillRow[];
      }>('/ecom/v2/order-status-table', {
        params: { date_from: ymd(from), date_to: ymd(to) },
      });
      const row = r.data.orders?.find((o) => o.soh_running === SH_RUNNING);
      invoiceNo = row?.bill_invoice_no ?? null;
      const allTyped = (r.data.orders ?? []).every(
        (o) =>
          o.bill_invoice_no === null || typeof o.bill_invoice_no === 'string',
      );
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data.date_from === ymd(from) &&
          !!invoiceNo &&
          allTyped,
        detail: `date_from=${r.data.date_from} orders=${r.data.orders?.length} ${SH_RUNNING}=${invoiceNo}`,
      };
    },
  );

  await step(
    'T2 การ์ด order-list: ทุกใบมี bill_invoice_no (string|null)',
    async () => {
      const r = await user.get<{ data: BillRow[] }>(
        `/ecom/v2/order-list/${encodeURIComponent(MEM_CODE)}`,
        { params: { page: 1, pageSize: 10 } },
      );
      const cards = r.data.data ?? [];
      const ok = cards.every(
        (c) =>
          c.bill_invoice_no === null || typeof c.bill_invoice_no === 'string',
      );
      return {
        status: r.status,
        ok: r.status === 200 && ok,
        detail: `cards=${cards.length} withBill=${cards.filter((c) => c.bill_invoice_no).length}`,
      };
    },
  );

  await step('P1 ดาวน์โหลด PDF ร้านตัวเอง → application/pdf', async () => {
    const r = await user.get<ArrayBuffer>(pdfPath(MEM_CODE, SH_RUNNING), {
      responseType: 'arraybuffer',
    });
    const buf = Buffer.from(r.data);
    const type = String(r.headers['content-type'] ?? '');
    const disposition = String(r.headers['content-disposition'] ?? '');
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        type.startsWith('application/pdf') &&
        buf.subarray(0, 5).toString() === '%PDF-' &&
        (!invoiceNo || disposition.includes(`${invoiceNo}.pdf`)),
      detail: `${type} ${disposition} ${buf.length} bytes`,
    };
  });

  await step('P2 token ร้านอื่นขอบิลร้านนี้ → 403', async () => {
    const r = await client(OTHER_TOKEN).get(pdfPath(MEM_CODE, SH_RUNNING));
    return { status: r.status, ok: r.status === 403 };
  });

  await step('P3 ใบสั่งจองที่ยังไม่มีบิล → 404 ยังไม่มีบิล', async () => {
    const r = await user.get<{ message?: string }>(
      pdfPath(MEM_CODE, 'E2E-NO-BILL'),
    );
    return {
      status: r.status,
      ok: r.status === 404,
      detail: r.data?.message,
    };
  });

  await step('P4 ไม่มี token → 401', async () => {
    const r = await client().get(pdfPath(MEM_CODE, SH_RUNNING));
    return { status: r.status, ok: r.status === 401 };
  });

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Bill PDF download (ECWC-767) E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ local ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- ร้าน/บิลทดสอบ: ${MEM_CODE} / ${SH_RUNNING}`,
    `- อ่านอย่างเดียว ไม่สร้าง/แก้ข้อมูล`,
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
  const file = join(dir, `bill-download-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
