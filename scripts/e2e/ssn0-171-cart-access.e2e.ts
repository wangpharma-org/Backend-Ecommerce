/**
 * E2E: ordinary customer cart ownership gate (SSN0-171).
 * This does not cover the Sale -> Ecommerce internal read path; that needs
 * assigned and unassigned Sale users plus the shared internal token.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000/api USER_TOKEN=<customer JWT> OTHER_MEM_CODE=<other customer> \
 *     npx ts-node scripts/e2e/ssn0-171-cart-access.e2e.ts
 *
 * For a non-local BASE_URL, set E2E_ENV explicitly (dev|staging|prod).
 * The script never prints the token. It derives USER_TOKEN's mem_code from
 * its JWT payload only to validate setup and call the authenticated own-cart
 * count route. A Markdown report is written only after an actual run.
 */
import axios, { type AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const OTHER_MEM_CODE = process.env.OTHER_MEM_CODE ?? '';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(
  BASE_URL,
);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');

interface JwtCustomerClaims {
  mem_code: string;
}

interface StepResult {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
}

function decodeCustomerClaims(token: string): JwtCustomerClaims | undefined {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return undefined;

    const parsed: unknown = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('mem_code' in parsed) ||
      typeof parsed.mem_code !== 'string' ||
      parsed.mem_code.length === 0
    ) {
      return undefined;
    }

    return { mem_code: parsed.mem_code };
  } catch {
    return undefined;
  }
}

function getCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function makeClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${USER_TOKEN}` },
    validateStatus: () => true,
    timeout: 15000,
  });
}

async function main(): Promise<void> {
  if (!USER_TOKEN || !OTHER_MEM_CODE) {
    process.stderr.write('ต้องตั้ง USER_TOKEN และ OTHER_MEM_CODE\n');
    process.exitCode = 2;
    return;
  }
  if (!E2E_ENV) {
    process.stderr.write(
      `BASE_URL=${BASE_URL} ไม่ใช่ localhost ต้องตั้ง E2E_ENV=dev|staging|prod ให้ชัดว่ายิงที่ไหน\n`,
    );
    process.exitCode = 2;
    return;
  }
  if (E2E_ENV === 'local' && !IS_LOCAL) {
    process.stderr.write(
      `E2E_ENV=local แต่ BASE_URL=${BASE_URL} ไม่ใช่ localhost\n`,
    );
    process.exitCode = 2;
    return;
  }

  const ownMemCode = decodeCustomerClaims(USER_TOKEN)?.mem_code;
  if (!ownMemCode) {
    process.stderr.write(
      'USER_TOKEN ไม่มี mem_code ที่อ่านได้ใน JWT payload\n',
    );
    process.exitCode = 2;
    return;
  }
  if (ownMemCode === OTHER_MEM_CODE) {
    process.stderr.write(
      'การตั้งค่าไม่ถูกต้อง: OTHER_MEM_CODE ต้องต่างจากผู้ใช้ใน USER_TOKEN\n',
    );
    process.exitCode = 2;
    return;
  }

  const user = makeClient();
  const results: StepResult[] = [];

  async function step(
    name: string,
    request: () => Promise<{ status: number }>,
    expectedStatus: number,
  ): Promise<void> {
    try {
      const response = await request();
      const ok = response.status === expectedStatus;
      results.push({
        step: name,
        ok,
        status: response.status,
        detail: `expected HTTP ${expectedStatus}`,
      });
      process.stdout.write(
        `${ok ? 'PASS' : 'FAIL'}  ${name}  [${response.status}] expected ${expectedStatus}\n`,
      );
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'Request failed';
      results.push({ step: name, ok: false, detail });
      process.stdout.write(`FAIL  ${name}  ${detail}\n`);
    }
  }

  process.stdout.write(
    `env=${E2E_ENV} base=${BASE_URL} commit=${getCommitSha()} distinct_customers=true\n`,
  );

  await step(
    'Customer A can read their own ordinary cart count',
    async () => user.get(`/ecom/cart/count/${encodeURIComponent(ownMemCode)}`),
    200,
  );
  await step(
    'Customer A cannot read customer B ordinary cart count',
    async () =>
      user.get(`/ecom/cart/count/${encodeURIComponent(OTHER_MEM_CODE)}`),
    403,
  );
  await step(
    'Customer A cannot add a product to customer B cart',
    async () =>
      user.post('/ecom/product-add-cart', {
        mem_code: OTHER_MEM_CODE,
        pro_code: '',
        pro_unit: '',
        amount: 0,
        flashsale_end: '',
      }),
    403,
  );
  await step(
    'Customer A cannot check all products in customer B cart',
    async () =>
      user.post('/ecom/product-check-all-cart', {
        mem_code: OTHER_MEM_CODE,
        type: '',
      }),
    403,
  );
  await step(
    'Customer A cannot delete a product from customer B cart',
    async () =>
      user.post('/ecom/product-delete-cart', {
        mem_code: OTHER_MEM_CODE,
        pro_code: '',
      }),
    403,
  );
  await step(
    'Customer A cannot check a product in customer B cart',
    async () =>
      user.post('/ecom/product-check-cart', {
        mem_code: OTHER_MEM_CODE,
        pro_code: '',
        type: '',
      }),
    403,
  );

  const passed = results.filter((result) => result.ok).length;
  const report = [
    '# SSN0-171 Cart Access E2E Report',
    '',
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (local)' : ' (deployed)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${getCommitSha()}`,
    `- run at: ${new Date().toISOString()}`,
    '- customer setup: two distinct member codes (identifiers omitted)',
    `- result: **${passed}/${results.length} passed**`,
    '',
    '| # | step | status | result | detail |',
    '|---|------|--------|--------|--------|',
    ...results.map(
      (result, index) =>
        `| ${index + 1} | ${result.step} | ${result.status ?? ''} | ${result.ok ? 'PASS' : 'FAIL'} | ${result.detail ?? ''} |`,
    ),
  ].join('\n');
  const reportDirectory = join(process.cwd(), 'docs', 'e2e');
  mkdirSync(reportDirectory, { recursive: true });
  const reportPath = join(
    reportDirectory,
    `ssn0-171-cart-access-${E2E_ENV}-${Date.now()}.md`,
  );
  writeFileSync(reportPath, report);
  process.stdout.write(
    `\n${passed}/${results.length} passed → ${reportPath}\n`,
  );
  process.exitCode = passed === results.length ? 0 : 1;
}

void main();
